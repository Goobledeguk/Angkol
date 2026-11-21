type Step = [method: string, ...args: unknown[]];

type ExpectedCall = {
  steps: Step[];
  data: unknown;
  error: { message: string } | null;
};

export function createSupabaseFake() {
  const expected = {
    table: new Map<string, ExpectedCall[]>(),
    rpc: new Map<string, ExpectedCall[]>(),
  };

  function enqueue(
    kind: keyof typeof expected,
    name: string,
    steps: Step[],
    data: unknown,
    error?: string,
  ) {
    const entries = expected[kind].get(name) ?? [];
    entries.push({
      steps,
      data,
      error: error === undefined ? null : { message: error },
    });
    expected[kind].set(name, entries);
  }

  function consume(kind: keyof typeof expected, name: string) {
    const call = expected[kind].get(name)?.shift();
    if (!call) {
      throw new Error(`Unexpected Supabase ${kind}: ${name}`);
    }
    return call;
  }

  const auth = {
    getUser: jest.fn().mockResolvedValue({ data: { user: { id: "rider" } } }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    getSession: jest.fn(),
    setSession: jest.fn(),
    updateUser: jest.fn(),
  };

  const client = {
    auth,
    from: jest.fn((table: string) => {
      const { steps: expectedSteps, data, error } = consume("table", table);
      const steps: Step[] = [];
      const pending = () => {
        expect(steps).toStrictEqual(expectedSteps);
        return { data, error };
      };
      const builder = {
        then: (
          resolve: (result: {
            data: unknown;
            error: ExpectedCall["error"];
          }) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve().then(pending).then(resolve, reject),
        ...Object.fromEntries(
          [
            "select",
            "insert",
            "upsert",
            "update",
            "delete",
            "eq",
            "in",
            "is",
            "ilike",
            "order",
            "limit",
            "single",
            "maybeSingle",
          ].map((method) => [
            method,
            (...args: unknown[]) => {
              steps.push([method, ...args]);
              return builder;
            },
          ]),
        ),
      };
      return builder;
    }),
    rpc: jest.fn(async (name: string, ...args: unknown[]) => {
      const { steps, data, error } = consume("rpc", name);
      expect([["rpc", ...args]]).toStrictEqual(steps);
      return { data, error };
    }),
  };

  return {
    client,
    table: (
      name: string,
      steps: Step[],
      data: unknown = null,
      error?: string,
    ) => enqueue("table", name, steps, data, error),
    rpc: (
      name: string,
      args: [] | [Record<string, unknown>],
      data: unknown = null,
      error?: string,
    ) => enqueue("rpc", name, [["rpc", ...args]], data, error),
    verify() {
      const remaining = Object.entries(expected).flatMap(([kind, calls]) =>
        [...calls.entries()]
          .filter(([, entries]) => entries.length)
          .map(([name]) => `${kind} ${name}`),
      );
      expect(remaining).toEqual([]);
    },
  };
}

export type SupabaseFake = ReturnType<typeof createSupabaseFake>;

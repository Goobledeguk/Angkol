type Step = [method: string, ...args: unknown[]];
type FakeError = {
  message: string;
  code?: string;
  status?: number;
  statusCode?: string;
};

type ExpectedCall = {
  steps: Step[];
  data: unknown;
  error: FakeError | null;
};

export function createSupabaseFake() {
  const expected = {
    table: new Map<string, ExpectedCall[]>(),
    rpc: new Map<string, ExpectedCall[]>(),
    storage: new Map<string, ExpectedCall[]>(),
  };

  function enqueue(
    kind: keyof typeof expected,
    name: string,
    steps: Step[],
    data: unknown,
    error?: string | FakeError,
  ) {
    const entries = expected[kind].get(name) ?? [];
    entries.push({
      steps,
      data,
      error: typeof error === "string" ? { message: error } : (error ?? null),
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
    storage: {
      from: jest.fn((bucket: string) => {
        const call = async (method: string, ...args: unknown[]) => {
          const { steps, data, error } = consume("storage", bucket);
          expect([[method, ...args]]).toStrictEqual(steps);
          return { data, error };
        };
        return {
          upload: (...args: unknown[]) => call("upload", ...args),
          createSignedUrl: (...args: unknown[]) => call("createSignedUrl", ...args),
          remove: (...args: unknown[]) => call("remove", ...args),
        };
      }),
    },
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
      error?: string | FakeError,
    ) => enqueue("table", name, steps, data, error),
    rpc: (
      name: string,
      args: [] | [Record<string, unknown>],
      data: unknown = null,
      error?: string | FakeError,
    ) => enqueue("rpc", name, [["rpc", ...args]], data, error),
    storage: (
      bucket: string,
      step: Step,
      data: unknown = null,
      error?: string | FakeError,
    ) => enqueue("storage", bucket, [step], data, error),
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

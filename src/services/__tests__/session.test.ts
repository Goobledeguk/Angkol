import { createURL } from "expo-linking";
import {
  getSession,
  openRecoveryLink,
  registerAccount,
  requestPasswordReset,
  signInAccount,
  signOutAccount,
  updatePassword,
} from "../../auth/session";
import type { Registration } from "../../auth/session";
import { db } from "../supabase";
import { createSupabaseFake, type SupabaseFake } from "./supabaseFake";

jest.mock("../supabase", () => ({ db: jest.fn() }));
jest.mock("expo-linking", () => ({ createURL: jest.fn() }));

const registration: Registration = {
  name: "  Jo  ",
  email: " Jo@Example.Test ",
  password: "long-password",
  role: "Passenger",
};
const session = { access_token: "fake-access", refresh_token: "fake-refresh" };
let fake: SupabaseFake;

beforeEach(() => {
  fake = createSupabaseFake();
  jest
    .mocked(db)
    .mockReturnValue(fake.client as unknown as ReturnType<typeof db>);
  jest.mocked(createURL).mockReset().mockReturnValue("angkol://reset-password");
});

afterEach(() => {
  fake.verify();
});

function profile(data: unknown, error?: string) {
  fake.table(
    "users",
    [
      ["select", "assigned_roles,admin_level"],
      ["eq", "user_id", "rider"],
      ["maybeSingle"],
    ],
    data,
    error,
  );
}

describe("sign-in and portal roles", () => {
  beforeEach(() => {
    fake.client.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: "rider" } },
      error: null,
    });
  });

  test.each([
    [["Passenger"], false],
    [["Tricycle driver"], false],
    [[], false],
    [undefined, false],
    [["Administrator"], true],
    [["Vehicle Owner / Operator"], true],
  ])(
    "signs in role %p with portal flag %p and normalizes credentials",
    async (assigned_roles, administrator) => {
      profile({ assigned_roles });
      await expect(
        signInAccount(" JO@Example.Test ", " keep spaces ", administrator),
      ).resolves.toBeUndefined();
      expect(fake.client.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "jo@example.test",
        password: " keep spaces ",
      });
      expect(fake.client.auth.signOut).not.toHaveBeenCalled();
    },
  );

  test.each([
    [
      "Passenger",
      true,
      "Use an administrator or vehicle owner account for this portal.",
    ],
    [
      "Administrator",
      false,
      "Use the web portal to sign in as an administrator.",
    ],
    [
      "Vehicle Owner / Operator",
      false,
      "Use the web portal to sign in as an administrator.",
    ],
  ])(
    "signs out role %s when the portal flag is %p",
    async (role, administrator, message) => {
      profile({ assigned_roles: [role] });
      await expect(
        signInAccount(registration.email, registration.password, administrator),
      ).rejects.toThrow(message);
      expect(fake.client.auth.signOut).toHaveBeenCalledTimes(1);
    },
  );

  it("signs out when the account has no profile", async () => {
    profile(null);
    await expect(
      signInAccount(registration.email, registration.password),
    ).rejects.toThrow("This account has no profile yet.");
    expect(fake.client.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("signs out when the profile lookup fails", async () => {
    profile(null, "profile offline");
    await expect(
      signInAccount(registration.email, registration.password),
    ).rejects.toThrow("profile offline");
    expect(fake.client.auth.signOut).toHaveBeenCalledTimes(1);
  });

  test.each([
    [
      "INVALID LOGIN CREDENTIALS",
      "Invalid email or password. Please try again.",
    ],
    ["Network unavailable", "Network unavailable"],
  ])("reports sign-in failure %p as %p", async (upstream, message) => {
    fake.client.auth.signInWithPassword.mockResolvedValueOnce({
      error: { message: upstream },
    });
    await expect(
      signInAccount(registration.email, registration.password),
    ).rejects.toThrow(message);
    expect(fake.client.from).not.toHaveBeenCalled();
  });
});

describe("registration", () => {
  it("sends normalized metadata and reports when confirmation is needed", async () => {
    fake.client.auth.signUp.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    await expect(
      registerAccount({
        ...registration,
        role: "Tricycle driver",
        birthday: " 05-06-1990 ",
        phone: "0917",
        consent: true,
        license: "LICENSE",
        association: "Co-op",
        plate: "ABC",
        permitNo: "P1",
        capacity: 4,
        franchiseName: "City franchise",
        licenseDocAttached: true,
      }),
    ).resolves.toEqual({ needsConfirmation: true });
    expect(fake.client.auth.signUp).toHaveBeenCalledWith({
      email: "jo@example.test",
      password: "long-password",
      options: {
        data: {
          name: "Jo",
          birthday: "1990-05-06",
          phone: "0917",
          consent: true,
          role: "Tricycle driver",
          license: "LICENSE",
          association: "Co-op",
          plate: "ABC",
          permit_no: "P1",
          capacity: 4,
          franchise_name: "City franchise",
          license_doc_attached: true,
        },
      },
    });
  });

  test.each([
    [undefined, ""],
    [" 1990-05-06 ", "1990-05-06"],
    [" edit me ", "edit me"],
  ])(
    "uses optional defaults and normalizes birthday %p to %p",
    async (birthday, expectedBirthday) => {
      fake.client.auth.signUp.mockResolvedValue({
        data: { session },
        error: null,
      });
      await expect(
        registerAccount({ ...registration, birthday }),
      ).resolves.toEqual({ needsConfirmation: false });
      expect(fake.client.auth.signUp).toHaveBeenCalledWith({
        email: "jo@example.test",
        password: "long-password",
        options: {
          data: {
            name: "Jo",
            birthday: expectedBirthday,
            phone: "",
            consent: false,
            role: "Passenger",
            license: "",
            association: "",
            plate: "",
            permit_no: "",
            capacity: 3,
            franchise_name: "",
            license_doc_attached: false,
          },
        },
      });
    },
  );

  test.each([
    [
      "User already registered",
      "This email already has an account. Sign in instead.",
    ],
    [
      "Password should be at least 10 characters",
      "Use at least 10 characters for your password.",
    ],
  ])("translates registration error %p to %p", async (upstream, message) => {
    fake.client.auth.signUp.mockResolvedValue({ error: { message: upstream } });
    await expect(registerAccount(registration)).rejects.toThrow(message);
  });
});

describe("password recovery and session helpers", () => {
  it("requests a reset using the normalized address and Expo recovery URL", async () => {
    fake.client.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    await expect(
      requestPasswordReset(registration.email),
    ).resolves.toBeUndefined();
    expect(createURL).toHaveBeenCalledWith("reset-password");
    expect(fake.client.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "jo@example.test",
      { redirectTo: "angkol://reset-password" },
    );
  });

  it("returns a user-facing reset email error", async () => {
    fake.client.auth.resetPasswordForEmail.mockResolvedValue({
      error: { message: "rate limited" },
    });
    await expect(requestPasswordReset(registration.email)).rejects.toThrow(
      "Could not send the password reset email.",
    );
  });

  it("decodes the tokens from a recovery fragment", async () => {
    fake.client.auth.setSession.mockResolvedValue({ error: null });
    await expect(
      openRecoveryLink(
        "angkol://reset-password#access_token=fake%2Baccess&refresh_token=fake%2Frefresh",
      ),
    ).resolves.toBeUndefined();
    expect(fake.client.auth.setSession).toHaveBeenCalledWith({
      access_token: "fake+access",
      refresh_token: "fake/refresh",
    });
    expect(fake.client.auth.getSession).not.toHaveBeenCalled();
  });

  it("prioritizes the decoded recovery error over the tokens", async () => {
    await expect(
      openRecoveryLink(
        "angkol://reset-password#access_token=a&refresh_token=b&error_description=Link%20expired",
      ),
    ).rejects.toThrow("Link expired");
    expect(fake.client.auth.setSession).not.toHaveBeenCalled();
    expect(fake.client.auth.getSession).not.toHaveBeenCalled();
  });

  it("allows an existing session to open a recovery URL without tokens", async () => {
    fake.client.auth.getSession.mockResolvedValue({ data: { session } });
    await expect(
      openRecoveryLink("angkol://reset-password"),
    ).resolves.toBeUndefined();
    expect(fake.client.auth.getSession).toHaveBeenCalledTimes(1);
    expect(fake.client.auth.setSession).not.toHaveBeenCalled();
  });

  test.each(["", "#access_token=fake", "#refresh_token=fake"])(
    "rejects a missing token and session for fragment %p",
    async (fragment) => {
      fake.client.auth.getSession.mockResolvedValue({
        data: { session: null },
      });
      await expect(
        openRecoveryLink(`angkol://reset-password${fragment}`),
      ).rejects.toThrow("This reset link is not valid or has expired.");
      expect(fake.client.auth.setSession).not.toHaveBeenCalled();
    },
  );

  it("reports a rejected setSession as expired", async () => {
    fake.client.auth.setSession.mockResolvedValue({
      error: { message: "unknown session" },
    });
    await expect(
      openRecoveryLink(
        "angkol://reset-password#access_token=a&refresh_token=b",
      ),
    ).rejects.toThrow("This reset link has expired.");
  });

  test.each(["", "123456789"])(
    "rejects the short password %p",
    async (password) => {
      await expect(updatePassword(password)).rejects.toThrow(
        "Use at least 10 characters for your password.",
      );
      expect(fake.client.auth.updateUser).not.toHaveBeenCalled();
    },
  );

  it("sends a password of exactly ten characters", async () => {
    fake.client.auth.updateUser.mockResolvedValue({ error: null });
    await expect(updatePassword("1234567890")).resolves.toBeUndefined();
    expect(fake.client.auth.updateUser).toHaveBeenCalledWith({
      password: "1234567890",
    });
  });

  it("translates an updateUser error", async () => {
    fake.client.auth.updateUser.mockResolvedValue({
      error: { message: "Password should be at least 12 characters" },
    });
    await expect(updatePassword("1234567890")).rejects.toThrow(
      "Use at least 10 characters for your password.",
    );
  });

  test.each([session, null])(
    "returns the current session payload %p",
    async (currentSession) => {
      fake.client.auth.getSession.mockResolvedValue({
        data: { session: currentSession },
      });
      await expect(getSession()).resolves.toBe(currentSession);
      expect(fake.client.auth.getSession).toHaveBeenCalledTimes(1);
    },
  );

  it("delegates sign-out to Supabase", async () => {
    await expect(signOutAccount()).resolves.toBeUndefined();
    expect(fake.client.auth.signOut).toHaveBeenCalledTimes(1);
  });
});

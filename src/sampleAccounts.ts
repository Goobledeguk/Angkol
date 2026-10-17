import { api, selectDemo } from "./api";
import type { Role } from "./types";

type SampleAccount = {
  email: string;
  password: string;
  name: string;
  role: Role;
};

// Fictional credentials for this static prototype. Nothing is persisted or sent.
const accounts = new Map<string, SampleAccount>(
  [
    {
      email: "isabella@angkol.example",
      name: "Isabella Reyes",
      role: "Passenger",
    },
    {
      email: "miguel@angkol.example",
      name: "Miguel Santos",
      role: "Tricycle driver",
    },
    {
      email: "rafael@angkol.example",
      name: "Rafael Mendoza",
      role: "PUJ / PUV driver",
    },
    {
      email: "patricia@angkol.example",
      name: "Patricia Villanueva",
      role: "Administrator",
    },
  ].map((account) => [
    account.email,
    { ...account, role: account.role as Role, password: "Angkol123!" },
  ]),
);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function openAccount(account: SampleAccount) {
  selectDemo(account.role);
  await api("/profile", { name: account.name, email: account.email }, "PATCH");
}

export async function signInSampleAccount(
  email: string,
  password: string,
  administrator = false,
) {
  const account = accounts.get(normalizeEmail(email));
  if (!account || account.password !== password) {
    throw new Error("Email or password does not match a sample account.");
  }
  if ((account.role === "Administrator") !== administrator) {
    throw new Error(
      administrator
        ? "Use an administrator account for this portal."
        : "Use the web portal to sign in as an administrator.",
    );
  }
  await openAccount(account);
}

export async function registerSampleAccount(account: SampleAccount) {
  const email = normalizeEmail(account.email);
  if (accounts.has(email)) {
    throw new Error(
      "This email already has a sample account. Sign in instead.",
    );
  }
  if (account.role === "Administrator") {
    throw new Error("Administrator registration is not available.");
  }
  const sample = { ...account, email };
  accounts.set(email, sample);
  await openAccount(sample);
}

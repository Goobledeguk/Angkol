import { api, selectDemo } from "../services/api";
import type { AdminLevel, Role } from "../types/types";

export type SampleAccount = {
  email: string;
  password: string;
  name: string;
  role: Role;
  adminLevel?: AdminLevel;
  ownerVehicleIds?: string[];
  badge?: string;
  description?: string;
  phone?: string;
  license?: string;
  association?: string;
  franchiseName?: string;
  plate?: string;
  permitNo?: string;
  capacity?: number;
};

// Fictional credentials for this static prototype with Role-Based Access Control (RBAC).
export const sampleAccountsList: SampleAccount[] = [
  {
    email: "april@angkol.example",
    name: "April Lentejas",
    role: "Passenger",
    password: "Angkol123!",
    badge: "Commuter",
    description: "Book point-to-point tricycle rides, view fares & transit corridors",
  },
  {
    email: "meynard@angkol.example",
    name: "Meynard Salem",
    role: "Tricycle driver",
    password: "Angkol123!",
    badge: "Tricycle Driver",
    description: "Accept and manage on-demand ride hail requests",
  },
  {
    email: "limuel@angkol.example",
    name: "Limuel Rosino",
    role: "PUJ / PUV driver",
    password: "Angkol123!",
    badge: "PUJ Driver",
    description: "Operate corridor routes, count stops & passengers",
  },
  {
    email: "shaina@angkol.example",
    name: "Shaina Moriles",
    role: "Administrator",
    adminLevel: "Technical Team",
    password: "Angkol123!",
    badge: "Tech Team (Level A)",
    description: "Full system-wide access: health, latency, audit logs & fleet tracking",
  },
  {
    email: "kent@angkol.example",
    name: "Kent Ferrer",
    role: "Administrator",
    adminLevel: "Franchise Owner",
    ownerVehicleIds: ["sample-driver-1", "sample-driver-3"],
    password: "Angkol123!",
    badge: "Vehicle Owner (Level B)",
    description: "Franchise owner: monitor assigned PUJ fleet, status, drivers & routes",
  },
];

const accounts = new Map<string, SampleAccount>(
  sampleAccountsList.map((account) => [account.email.toLowerCase(), account]),
);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function openAccount(account: SampleAccount) {
  selectDemo(account.role, account.adminLevel);
  await api(
    "/profile",
    {
      name: account.name,
      email: account.email,
      phone: account.phone,
      license: account.license,
      association: account.association,
      franchiseName: account.franchiseName,
      plate: account.plate,
      permitNo: account.permitNo,
      capacity: account.capacity,
      adminLevel: account.adminLevel,
      ownerVehicleIds: account.ownerVehicleIds,
    },
    "PATCH",
  );
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
  const isAccountAdmin = account.role === "Administrator" || account.role === "Vehicle Owner / Operator";
  if (isAccountAdmin !== administrator) {
    throw new Error(
      administrator
        ? "Use an administrator or vehicle owner account for this portal."
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
  if (account.role === "Administrator" || account.role === "Vehicle Owner / Operator") {
    throw new Error("Administrator registration is not available.");
  }
  const sample = { ...account, email };
  accounts.set(email, sample);
  await openAccount(sample);
}

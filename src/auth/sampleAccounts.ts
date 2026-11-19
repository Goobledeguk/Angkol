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
    phone: "0917 123 4567",
  },
  {
    email: "meynard@angkol.example",
    name: "Meynard Salem",
    role: "Tricycle driver",
    password: "Angkol123!",
    badge: "Tricycle Driver",
    description: "Accept and manage on-demand ride hail requests",
    phone: "0918 234 5678",
    license: "N01-23-456780",
    association: "Magsaysay TODA",
    plate: "AB-12345",
    permitNo: "PRK-2026-0142",
    capacity: 3,
  },
  {
    email: "limuel@angkol.example",
    name: "Limuel Rosino",
    role: "PUJ / PUV driver",
    password: "Angkol123!",
    badge: "PUJ Driver",
    description: "Operate corridor routes, count stops & passengers",
    phone: "0919 345 6789",
    license: "N01-23-456781",
    association: "Calbayog Transport Cooperative",
    franchiseName: "Calbayog Metro Express",
    plate: "ABC 1231",
    capacity: 18,
  },
  {
    email: "shaina@angkol.example",
    name: "Shaina Moriles",
    role: "Administrator",
    adminLevel: "Technical Team",
    password: "Angkol123!",
    badge: "Tech Team (Level A)",
    description: "Full system-wide access: health, latency, audit logs & fleet tracking",
    phone: "0920 456 7890",
  },
  {
    email: "kent@angkol.example",
    name: "Kent Ferrer",
    role: "Administrator",
    adminLevel: "Franchise Owner",
    ownerVehicleIds: ["sample-driver-1", "sample-driver-3"],
    franchiseName: "Calbayog Metro Express",
    password: "Angkol123!",
    badge: "Vehicle Owner (Level B)",
    description: "Franchise owner: Kent Ferrer (Calbayog Metro Express) — reviews and accepts/declines PUJ/PUV driver applications; monitors assigned fleet, status, drivers & routes",
    phone: "0921 567 8901",
  },
];

const accounts = new Map<string, SampleAccount>(
  sampleAccountsList.map((account) => [account.email.toLowerCase(), account]),
);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function openAccount(account: SampleAccount) {
  await selectDemo(account.role, account.adminLevel);
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
    throw new Error("Invalid email or password. Please try again.");
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
      "This email already has a registered account. Please sign in or use a different email address.",
    );
  }
  if (account.role === "Administrator" || account.role === "Vehicle Owner / Operator") {
    throw new Error("Administrator registration is not available.");
  }
  const sample = { ...account, email };
  accounts.set(email, sample);
  await openAccount(sample);
}

import { db } from "../services/supabase";
import type { Role } from "../types/types";

export type Registration = {
  email: string;
  password: string;
  name: string;
  role: Role;
  phone?: string;
  birthday?: string;
  consent?: boolean;
  license?: string;
  association?: string;
  plate?: string;
  permitNo?: string;
  franchiseName?: string;
  capacity?: number;
  licenseDocAttached?: boolean;
};

function isoBirthday(value?: string) {
  if (!value) {return "";}
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) {return value.trim();}
  return `${match[3]}-${match[1]}-${match[2]}`;
}

function friendly(message: string) {
  if (/invalid login credentials/i.test(message)) {
    return "Invalid email or password. Please try again.";
  }
  if (/already registered/i.test(message)) {
    return "This email already has an account. Sign in instead.";
  }
  if (/password should be at least/i.test(message)) {
    return "Use at least 10 characters for your password.";
  }
  return message;
}

export async function signInAccount(
  email: string,
  password: string,
  administrator = false,
) {
  const { data, error } = await db().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) {throw new Error(friendly(error.message));}

  const { data: profile, error: profileError } = await db()
    .from("users")
    .select("assigned_roles,admin_level")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (profileError) {
    await db().auth.signOut();
    throw new Error(profileError.message);
  }
  if (!profile) {
    await db().auth.signOut();
    throw new Error("This account has no profile. Run supabase/schema.sql first.");
  }

  const role = (profile.assigned_roles?.[0] ?? "Passenger") as Role;
  const isAdminPortal =
    role === "Administrator" || role === "Vehicle Owner / Operator";
  if (isAdminPortal !== administrator) {
    await db().auth.signOut();
    throw new Error(
      administrator
        ? "Use an administrator or vehicle owner account for this portal."
        : "Use the web portal to sign in as an administrator.",
    );
  }
}

export async function registerAccount(input: Registration) {
  const { data, error } = await db().auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: {
        name: input.name.trim(),
        birthday: isoBirthday(input.birthday),
        phone: input.phone ?? "",
        consent: !!input.consent,
        role: input.role,
        license: input.license ?? "",
        association: input.association ?? "",
        plate: input.plate ?? "",
        permit_no: input.permitNo ?? "",
        capacity: input.capacity ?? 3,
        franchise_name: input.franchiseName ?? "",
        license_doc_attached: !!input.licenseDocAttached,
      },
    },
  });
  if (error) {throw new Error(friendly(error.message));}
  if (!data.session) {
    throw new Error("Account created. Confirm your email, then sign in.");
  }
}

export async function signOutAccount() {
  await db().auth.signOut();
}

export async function getSession() {
  const { data } = await db().auth.getSession();
  return data.session;
}

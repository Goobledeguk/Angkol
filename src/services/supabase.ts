import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True when both Supabase values look real (not the blank template). */
export const isSupabaseConfigured =
  /^https?:\/\/.+/i.test(url.trim()) && anonKey.trim().length > 20;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url.trim(), anonKey.trim(), {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export function db(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env, then restart Expo.",
    );
  }
  return supabase;
}

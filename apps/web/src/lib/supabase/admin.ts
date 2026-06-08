import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS and can call the Auth Admin API
 * (listUsers, updateUserById, etc.). NEVER import this from a Client Component.
 *
 * Always gate usage behind requireAdmin() so only company admins can reach it.
 */
export function createAdminClient() {
  // Defence-in-depth: the service-role key must never run in the browser.
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient() нь зөвхөн серверт ажиллана.");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Service-role тохиргоо дутуу (SUPABASE_SERVICE_ROLE_KEY).");
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

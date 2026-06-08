"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export type LoginState = {
  error?: string;
};

export type ResetState = {
  error?: string;
  success?: string;
};

/** Derive the public origin (proto://host) from the incoming request headers. */
async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function loginAction(
  _prev: LoginState | undefined,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/") || "/";

  if (!email || !password) {
    return { error: "И-мэйл болон нууц үгээ оруулна уу" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: error?.message || "Нэвтрэх боломжгүй байна" };
  }

  // Check user has company role
  const { data: uc, error: ucError } = await supabase
    .from("user_companies")
    .select("company_id, role")
    .eq("user_id", data.user.id)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ucError || !uc) {
    await supabase.auth.signOut();
    return {
      error: "Энэ хэрэглэгчид компанийн эрх олгогдоогүй байна. Админд хандана уу.",
    };
  }

  redirect(next.startsWith("/") ? next : "/");
}

// ---------------------------------------------------------------------------
// FORGOT PASSWORD — send a reset email
// ---------------------------------------------------------------------------
export async function requestPasswordReset(
  _prev: ResetState | undefined,
  formData: FormData,
): Promise<ResetState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) return { error: "И-мэйлээ оруулна уу" };

  const supabase = await createClient();
  const origin = await getOrigin();
  // Point straight at the update-password page. Supabase recovery links carry
  // the token either as `?code=` (PKCE) or in the URL `#hash` (implicit). A
  // server route can't read the hash, so the landing page is a CLIENT page
  // whose browser client auto-detects both forms (detectSessionInUrl).
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/update-password`,
  });

  if (error) {
    // Rate-limit / transport errors are worth surfacing
    return { error: error.message };
  }
  // Do NOT reveal whether the email exists — always show the same message.
  return {
    success:
      "Хэрэв энэ и-мэйл бүртгэлтэй бол нууц үг сэргээх холбоосыг илгээлээ. И-мэйлээ шалгана уу.",
  };
}

// NOTE: setting the new password happens CLIENT-side in
// /auth/update-password (UpdatePasswordForm) because the recovery token may
// arrive in the URL hash, which never reaches the server. See that component.

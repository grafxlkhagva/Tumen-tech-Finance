"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/company";
import { actionError, type ActionResult } from "@/lib/rpc";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// ---------------------------------------------------------------------------
// Send a password-reset email to a user (admin-triggered)
// ---------------------------------------------------------------------------
export async function adminSendReset(email: string): Promise<ActionResult> {
  await requireAdmin();
  const clean = email.trim().toLowerCase();
  if (!clean) return { error: "Имэйл буруу" };

  // Use the normal (anon) client so it sends the configured Mongolian recovery
  // template, landing on the client-side /auth/update-password page.
  const supabase = await createClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(clean, {
    redirectTo: `${origin}/auth/update-password`,
  });
  if (error) return { error: error.message };
  return { success: `${clean} рүү сэргээх имэйл илгээлээ` };
}

// ---------------------------------------------------------------------------
// Set a user's password directly (admin-triggered, service role)
// ---------------------------------------------------------------------------
export async function adminSetPassword(
  userId: string,
  newPassword: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (!userId) return { error: "Хэрэглэгч заагдаагүй" };
  if (newPassword.length < 8) return { error: "Нууц үг доод тал нь 8 тэмдэгт байх ёстой" };

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
      email_confirm: true,
    });
    if (error) return { error: error.message };
    revalidatePath("/admin/users");
    return { success: "Нууц үг шинэчлэгдлээ" };
  } catch (e) {
    return actionError(e);
  }
}

// ---------------------------------------------------------------------------
// Invite a brand-new user by email (sends Supabase invite email)
// ---------------------------------------------------------------------------
export async function adminInviteUser(email: string): Promise<ActionResult> {
  await requireAdmin();
  const clean = email.trim().toLowerCase();
  if (!clean || !clean.includes("@")) return { error: "Имэйл буруу" };

  try {
    const admin = createAdminClient();
    const origin = await getOrigin();
    const { error } = await admin.auth.admin.inviteUserByEmail(clean, {
      redirectTo: `${origin}/auth/update-password`,
    });
    if (error) return { error: error.message };
    revalidatePath("/admin/users");
    return { success: `${clean} рүү урилга илгээлээ. (Компанийн эрхийг тусад нь олгоно уу.)` };
  } catch (e) {
    return actionError(e);
  }
}

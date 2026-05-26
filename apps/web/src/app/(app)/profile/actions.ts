"use server";

import { createClient } from "@/lib/supabase/server";

export type PwState = { error?: string; success?: string };

export async function changePasswordAction(
  _prev: PwState | undefined,
  formData: FormData,
): Promise<PwState> {
  const current  = String(formData.get("current_password") || "");
  const next     = String(formData.get("new_password")     || "");
  const confirm  = String(formData.get("confirm_password") || "");

  if (!current || !next) return { error: "Бүх талбарыг бөглөнө үү" };
  if (next !== confirm)   return { error: "Шинэ нууц үгүүд таарахгүй байна" };
  if (next.length < 8)    return { error: "Шинэ нууц үг 8+ тэмдэгт байх ёстой" };
  if (next === current)   return { error: "Шинэ нууц үг хуучнаасаа ялгаатай байх ёстой" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Хэрэглэгч олдсонгүй" };

  // Verify current password by re-signing in
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  });
  if (signInErr) return { error: "Одоогийн нууц үг буруу байна" };

  const { error: updateErr } = await supabase.auth.updateUser({ password: next });
  if (updateErr) return { error: updateErr.message };

  return { success: "Нууц үг амжилттай солигдлоо" };
}

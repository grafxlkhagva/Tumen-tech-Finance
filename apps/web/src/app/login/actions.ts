"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type LoginState = {
  error?: string;
};

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

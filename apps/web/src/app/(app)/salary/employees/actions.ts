"use server";

import { createClient } from "@/lib/supabase/server";
import { actionError, type ActionResult } from "@/lib/rpc";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function upsertEmployee(
  id: string | null,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const firstName  = String(formData.get("first_name") || "").trim();
  const lastName   = String(formData.get("last_name") || "").trim() || null;
  const tin        = String(formData.get("tin") || "").trim() || null;
  const phone      = String(formData.get("phone") || "").trim() || null;
  const email      = String(formData.get("email") || "").trim() || null;
  const title      = String(formData.get("title") || "").trim() || null;
  const department = String(formData.get("department") || "").trim() || null;
  const hireDate   = String(formData.get("hire_date") || "").trim() || null;
  const baseSalary = Number(formData.get("base_salary") || 0);
  const phoneAllowance = Number(formData.get("phone_allowance") || 0);
  const bankName   = String(formData.get("bank_name") || "").trim() || null;
  const bankAccount = String(formData.get("bank_account") || "").trim() || null;
  const isActive   = formData.get("is_active") === "1";

  if (!firstName) return { error: "Нэр заавал бөглөнө" };
  if (baseSalary < 0) return { error: "Цалин эерэг байх ёстой" };

  const supabase = await createClient();
  const { data: uc } = await supabase.from("user_companies").select("company_id").order("is_default", { ascending: false }).limit(1).maybeSingle();
  if (!uc?.company_id) return { error: "Компани олдсонгүй" };

  try {
    const payload = {
      company_id: uc.company_id,
      first_name: firstName, last_name: lastName, tin, phone, email,
      title, department, hire_date: hireDate,
      base_salary: baseSalary, phone_allowance: phoneAllowance,
      bank_name: bankName, bank_account: bankAccount,
      is_active: id ? isActive : true,
    };
    if (id) {
      const { error } = await supabase.from("employees").update(payload).eq("id", id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("employees").insert(payload);
      if (error) {
        if (error.code === "23505") return { error: "Энэ ТТД-тэй ажилтан аль хэдийн бий" };
        return { error: error.message };
      }
    }
    revalidatePath("/salary/employees");
    redirect(`/salary/employees?flash=${encodeURIComponent(id ? "Шинэчлэгдсэн" : "Үүсгэгдсэн")}&type=success`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return actionError(e);
  }
}

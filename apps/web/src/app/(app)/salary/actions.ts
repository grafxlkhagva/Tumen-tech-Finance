"use server";

import { createClient } from "@/lib/supabase/server";
import { actionError, type ActionResult } from "@/lib/rpc";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Run calculate_payroll (RPC) — bulk recompute for month
// ---------------------------------------------------------------------------
export async function recalcPayrollMonth(
  year: number,
  month: number,
): Promise<ActionResult<{ count: number }>> {
  const supabase = await createClient();
  const { data: uc } = await supabase.from("user_companies").select("company_id").order("is_default", { ascending: false }).limit(1).maybeSingle();
  if (!uc?.company_id) return { error: "Компани олдсонгүй" };

  try {
    const { data, error } = await supabase.rpc("calculate_payroll", {
      p_company_id: uc.company_id, p_year: year, p_month: month,
    });
    if (error) return { error: error.message };
    revalidatePath("/salary");
    const count = (data ?? []).length;
    return { success: `${count} ажилтны цалин тооцоологдсон`, data: { count } };
  } catch (e) {
    const err = actionError(e);
    return { error: err.error };
  }
}

// ---------------------------------------------------------------------------
// Update single salary cell (worked_hours, phone_allowance, sales_bonus, etc.)
// ---------------------------------------------------------------------------
export async function updateSalaryCell(
  recordId: string,
  field: string,
  value: number,
): Promise<ActionResult> {
  const ALLOWED = [
    "worked_hours", "phone_allowance", "sales_bonus", "leave_pay",
    "bod_salary", "advance", "other_deduction", "notes",
  ];
  if (!ALLOWED.includes(field)) return { error: "Талбар буруу" };

  const supabase = await createClient();
  try {
    const { error } = await supabase
      .from("salary_records")
      .update({ [field]: value })
      .eq("id", recordId);
    if (error) return { error: error.message };
    revalidatePath("/salary");
    return { success: "Хадгалагдсан" };
  } catch (e) {
    return actionError(e);
  }
}

// ---------------------------------------------------------------------------
// Approve a month — bulk-set draft → approved
// ---------------------------------------------------------------------------
export async function approveMonth(year: number, month: number): Promise<ActionResult<{ count: number }>> {
  const supabase = await createClient();
  const { data: uc } = await supabase.from("user_companies").select("company_id").order("is_default", { ascending: false }).limit(1).maybeSingle();
  if (!uc?.company_id) return { error: "Компани олдсонгүй" };

  try {
    const { error, data } = await supabase
      .from("salary_records")
      .update({ status: "approved" })
      .eq("company_id", uc.company_id).eq("year", year).eq("month", month).eq("status", "draft")
      .select("id");
    if (error) return { error: error.message };
    const count = data?.length ?? 0;
    revalidatePath("/salary");
    return { success: `${count} баталсан`, data: { count } };
  } catch (e) {
    const err = actionError(e);
    return { error: err.error };
  }
}

// ---------------------------------------------------------------------------
// Post salary batch (RPC) — creates posted journal
// ---------------------------------------------------------------------------
export async function postSalaryBatch(
  year: number,
  month: number,
  salaryExpense: string,
  salaryPayable: string,
  emndshPayable: string,
  hhoatPayable: string,
): Promise<ActionResult<{ count: number }>> {
  const supabase = await createClient();
  const { data: uc } = await supabase.from("user_companies").select("company_id").order("is_default", { ascending: false }).limit(1).maybeSingle();
  if (!uc?.company_id) return { error: "Компани олдсонгүй" };

  try {
    const { data, error } = await supabase.rpc("post_salary_batch", {
      p_company_id: uc.company_id, p_year: year, p_month: month,
      p_salary_expense_acc: salaryExpense,
      p_salary_payable_acc: salaryPayable,
      p_emndsh_payable_acc: emndshPayable,
      p_hhoat_payable_acc: hhoatPayable,
    });
    if (error) return { error: error.message };
    revalidatePath("/salary");
    revalidatePath("/journals");
    return { success: `${data ?? 0} цалин журналд оруулсан`, data: { count: data as number } };
  } catch (e) {
    const err = actionError(e);
    return { error: err.error };
  }
}

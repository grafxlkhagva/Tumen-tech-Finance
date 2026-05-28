"use server";

import { createClient } from "@/lib/supabase/server";
import { actionError, type ActionResult } from "@/lib/rpc";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Update category for a cash row
// ---------------------------------------------------------------------------
export async function updateCashCategory(
  id: string,
  category: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  try {
    const { error } = await supabase
      .from("cash_transactions")
      .update({ category: category || null })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/cash");
    return { success: "Category шинэчлэгдсэн" };
  } catch (e) {
    return actionError(e);
  }
}

// ---------------------------------------------------------------------------
// Update contra account
// ---------------------------------------------------------------------------
export async function updateCashContraAccount(
  id: string,
  contraAccountId: string | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  try {
    const { error } = await supabase
      .from("cash_transactions")
      .update({ contra_account_id: contraAccountId })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/cash");
    return { success: "Account шинэчлэгдсэн" };
  } catch (e) {
    return actionError(e);
  }
}

// ---------------------------------------------------------------------------
// Update partner
// ---------------------------------------------------------------------------
export async function updateCashPartner(
  id: string,
  partnerId: string | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  try {
    const { error } = await supabase
      .from("cash_transactions")
      .update({ partner_id: partnerId })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/cash");
    return { success: "Харилцагч шинэчлэгдсэн" };
  } catch (e) {
    return actionError(e);
  }
}

// ---------------------------------------------------------------------------
// Run auto-link (RPC)
// ---------------------------------------------------------------------------
export async function runAutoLink(): Promise<ActionResult<{
  linked_count: number;
  partner_matched_count: number;
}>> {
  const supabase = await createClient();
  const { data: uc } = await supabase
    .from("user_companies")
    .select("company_id")
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!uc?.company_id) return { error: "Компани олдсонгүй" };

  try {
    const { data, error } = await supabase.rpc("auto_link_cash_transactions", {
      p_company_id: uc.company_id,
    });
    if (error) return { error: error.message };
    revalidatePath("/cash");
    const result = data?.[0] ?? { linked_count: 0, partner_matched_count: 0 };
    return {
      success: `${result.linked_count} cash txn auto-linked, ${result.partner_matched_count} partner матчинг`,
      data: result,
    };
  } catch (e) {
    const err = actionError(e);
    return { error: err.error };
  }
}

// ---------------------------------------------------------------------------
// Create batch journal for a month (RPC)
// ---------------------------------------------------------------------------
export async function createBatchJournal(
  year: number,
  month: number,
): Promise<ActionResult<{ journal_id: string }>> {
  const supabase = await createClient();
  const { data: uc } = await supabase
    .from("user_companies")
    .select("company_id")
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!uc?.company_id) return { error: "Компани олдсонгүй" };

  try {
    const { data, error } = await supabase.rpc("cash_batch_journal", {
      p_company_id: uc.company_id,
      p_year: year,
      p_month: month,
    });
    if (error) return { error: error.message };
    revalidatePath("/cash");
    revalidatePath("/journals");
    return {
      success: `${year}-${String(month).padStart(2, "0")} сарын batch journal үүссэн`,
      data: { journal_id: data as string },
    };
  } catch (e) {
    const err = actionError(e);
    return { error: err.error };
  }
}

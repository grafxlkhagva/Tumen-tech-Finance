"use server";

import { createClient } from "@/lib/supabase/server";
import { actionError, reconcileInvoicePayment, type ActionResult } from "@/lib/rpc";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------
export async function createReceivable(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const partnerId  = String(formData.get("partner_id") || "").trim();
  const arAccountId = String(formData.get("ar_account_id") || "").trim();
  const incomeAccountId = String(formData.get("income_account_id") || "").trim() || null;
  const invoiceNo  = String(formData.get("invoice_no") || "").trim() || null;
  const invoiceDate = String(formData.get("invoice_date") || "").trim();
  const dueDate    = String(formData.get("due_date") || "").trim() || null;
  const amount     = Number(formData.get("amount") || 0);
  const vatAmount  = Number(formData.get("vat_amount") || 0);
  const description = String(formData.get("description") || "").trim() || null;
  const responsible = String(formData.get("responsible") || "").trim() || null;

  if (!partnerId) return { error: "Харилцагч сонгоно уу" };
  if (!arAccountId) return { error: "Авлагын данс сонгоно уу" };
  if (!invoiceDate) return { error: "Огноо заавал бөглөнө" };
  if (amount <= 0) return { error: "Дүн 0-ээс их байх ёстой" };

  const totalAmount = amount + vatAmount;

  const supabase = await createClient();
  const { data: uc } = await supabase.from("user_companies").select("company_id").order("is_default", { ascending: false }).limit(1).maybeSingle();
  if (!uc?.company_id) return { error: "Компани олдсонгүй" };

  try {
    const { data, error } = await supabase
      .from("receivables")
      .insert({
        company_id: uc.company_id,
        partner_id: partnerId, ar_account_id: arAccountId, income_account_id: incomeAccountId,
        invoice_no: invoiceNo, invoice_date: invoiceDate, due_date: dueDate,
        amount, vat_amount: vatAmount, total_amount: totalAmount,
        description, responsible,
        status: "open",
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return { error: `Нэхэмжлэхийн дугаар "${invoiceNo}" аль хэдийн бий` };
      return { error: error.message };
    }
    revalidatePath("/receivables");
    redirect(`/receivables?flash=${encodeURIComponent("Авлага үүсгэгдсэн")}&type=success`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return actionError(e);
  }
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------
export async function updateReceivable(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const invoiceNo  = String(formData.get("invoice_no") || "").trim() || null;
  const invoiceDate = String(formData.get("invoice_date") || "").trim();
  const dueDate    = String(formData.get("due_date") || "").trim() || null;
  const amount     = Number(formData.get("amount") || 0);
  const vatAmount  = Number(formData.get("vat_amount") || 0);
  const description = String(formData.get("description") || "").trim() || null;
  const responsible = String(formData.get("responsible") || "").trim() || null;
  const status     = String(formData.get("status") || "open");

  if (!invoiceDate || amount <= 0) return { error: "Заавал талбар дутуу" };
  const totalAmount = amount + vatAmount;

  const supabase = await createClient();
  try {
    const { error } = await supabase
      .from("receivables")
      .update({
        invoice_no: invoiceNo, invoice_date: invoiceDate, due_date: dueDate,
        amount, vat_amount: vatAmount, total_amount: totalAmount,
        description, responsible,
        status: status as "draft" | "open" | "partial" | "paid" | "overdue" | "cancelled" | "written_off",
      })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/receivables");
    revalidatePath(`/receivables/${id}/edit`);
    redirect(`/receivables?flash=${encodeURIComponent("Шинэчлэгдсэн")}&type=success`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return actionError(e);
  }
}

// ---------------------------------------------------------------------------
// PAY — link receivable to cash txn via RPC
// ---------------------------------------------------------------------------
export async function payReceivable(
  receivableId: string,
  cashTxnId: string,
  amount: number,
): Promise<ActionResult<{ payment_id: string }>> {
  const supabase = await createClient();
  try {
    const paymentId = await reconcileInvoicePayment(supabase, receivableId, cashTxnId, amount);
    revalidatePath("/receivables");
    revalidatePath(`/receivables/${receivableId}/edit`);
    return { success: "Төлбөр бичигдсэн", data: { payment_id: paymentId } };
  } catch (e) {
    const err = actionError(e);
    return { error: err.error };
  }
}

// ---------------------------------------------------------------------------
// AUTO MATCH — partner-wide RPC
// ---------------------------------------------------------------------------
export async function autoMatchByPartner(partnerId: string): Promise<ActionResult<{ matched: number }>> {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase.rpc("partner_reconcile_auto_match", {
      p_partner_id: partnerId,
    });
    if (error) return { error: error.message };
    revalidatePath("/receivables");
    return {
      success: `${(data ?? []).length} нэхэмжлэл матчлогдсон`,
      data: { matched: (data ?? []).length },
    };
  } catch (e) {
    const err = actionError(e);
    return { error: err.error };
  }
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { actionError, type ActionResult } from "@/lib/rpc";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------
export async function createPayable(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const partnerId  = String(formData.get("partner_id") || "").trim();
  const apAccountId = String(formData.get("ap_account_id") || "").trim();
  const expenseAccountId = String(formData.get("expense_account_id") || "").trim() || null;
  const invoiceNo  = String(formData.get("invoice_no") || "").trim() || null;
  const invoiceDate = String(formData.get("invoice_date") || "").trim();
  const dueDate    = String(formData.get("due_date") || "").trim() || null;
  const amount     = Number(formData.get("amount") || 0);
  const vatAmount  = Number(formData.get("vat_amount") || 0);
  const description = String(formData.get("description") || "").trim() || null;
  const responsible = String(formData.get("responsible") || "").trim() || null;

  if (!partnerId) return { error: "Харилцагч сонгоно уу" };
  if (!apAccountId) return { error: "Өглөгийн данс сонгоно уу" };
  if (!invoiceDate) return { error: "Огноо заавал бөглөнө" };
  if (amount <= 0) return { error: "Дүн 0-ээс их байх ёстой" };

  const totalAmount = amount + vatAmount;

  const supabase = await createClient();
  const { data: uc } = await supabase.from("user_companies").select("company_id").order("is_default", { ascending: false }).limit(1).maybeSingle();
  if (!uc?.company_id) return { error: "Компани олдсонгүй" };

  try {
    const { error } = await supabase
      .from("payables")
      .insert({
        company_id: uc.company_id,
        partner_id: partnerId, ap_account_id: apAccountId, expense_account_id: expenseAccountId,
        invoice_no: invoiceNo, invoice_date: invoiceDate, due_date: dueDate,
        amount, vat_amount: vatAmount, total_amount: totalAmount,
        description, responsible,
        status: "open",
      });
    if (error) {
      if (error.code === "23505") return { error: `Нэхэмжлэхийн дугаар "${invoiceNo}" аль хэдийн бий` };
      return { error: error.message };
    }
    revalidatePath("/payables");
    redirect(`/payables?flash=${encodeURIComponent("Өглөг үүсгэгдсэн")}&type=success`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return actionError(e);
  }
}

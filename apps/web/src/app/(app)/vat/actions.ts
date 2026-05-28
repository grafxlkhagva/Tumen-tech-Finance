"use server";

import { createClient } from "@/lib/supabase/server";
import { actionError, type ActionResult } from "@/lib/rpc";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const VAT_DIRECTIONS = ["inbound", "outbound"] as const;
const TAX_TYPES = ["standard", "zero", "reduced", "exempt"] as const;

// ---------------------------------------------------------------------------
// CREATE — manual VAT record
// ---------------------------------------------------------------------------
export async function createVat(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const direction = String(formData.get("direction") || "outbound") as typeof VAT_DIRECTIONS[number];
  const taxType   = String(formData.get("tax_type") || "standard") as typeof TAX_TYPES[number];
  const date      = String(formData.get("date") || "").trim();
  const ddtd      = String(formData.get("ddtd") || "").trim() || null;
  const invoiceNo = String(formData.get("invoice_no") || "").trim() || null;
  const partnerId = String(formData.get("partner_id") || "").trim() || null;
  const partnerName = String(formData.get("partner_name") || "").trim() || null;
  const partnerRegister = String(formData.get("partner_register") || "").trim() || null;
  const amount    = Number(formData.get("amount") || 0);
  const vatAmount = Number(formData.get("vat_amount") || 0);

  if (!date) return { error: "Огноо заавал бөглөнө" };
  if (amount <= 0) return { error: "Дүн 0-ээс их байх ёстой" };
  if (!VAT_DIRECTIONS.includes(direction)) return { error: "Чиглэл буруу" };
  if (!TAX_TYPES.includes(taxType)) return { error: "Татварын төрөл буруу" };

  const totalAmount = amount + vatAmount;

  const supabase = await createClient();
  const { data: uc } = await supabase
    .from("user_companies")
    .select("company_id")
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!uc?.company_id) return { error: "Компани олдсонгүй" };

  try {
    const { data, error } = await supabase
      .from("vat_records")
      .insert({
        company_id: uc.company_id,
        direction, tax_type: taxType, date, ddtd, invoice_no: invoiceNo,
        partner_id: partnerId, partner_name: partnerName, partner_register: partnerRegister,
        amount, vat_amount: vatAmount, total_amount: totalAmount,
        source: "manual",
        status: partnerId ? "matched" : "pending",
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return { error: `ДДТД "${ddtd}" аль хэдийн бий` };
      return { error: error.message };
    }
    revalidatePath("/vat");
    redirect(`/vat?flash=${encodeURIComponent("НӨАТ үүсгэгдсэн")}&type=success`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return actionError(e);
  }
}

// ---------------------------------------------------------------------------
// Toggle direction
// ---------------------------------------------------------------------------
export async function toggleVatDirection(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  try {
    const { data: row } = await supabase.from("vat_records").select("direction").eq("id", id).maybeSingle();
    if (!row) return { error: "Олдсонгүй" };
    const next = row.direction === "outbound" ? "inbound" : "outbound";
    const { error } = await supabase.from("vat_records").update({ direction: next }).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/vat");
    return { success: `Чиглэл солигдсон: ${next}` };
  } catch (e) {
    return actionError(e);
  }
}

// ---------------------------------------------------------------------------
// Link partner to VAT (after manual matching)
// ---------------------------------------------------------------------------
export async function linkVatPartner(id: string, partnerId: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  try {
    const { error } = await supabase
      .from("vat_records")
      .update({ partner_id: partnerId, status: partnerId ? "matched" : "pending" })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/vat");
    revalidatePath("/vat/unmatched");
    return { success: partnerId ? "Партнер холбогдсон" : "Партнер салгагдсан" };
  } catch (e) {
    return actionError(e);
  }
}

// ---------------------------------------------------------------------------
// Bulk make invoices (RPC)
// ---------------------------------------------------------------------------
export async function bulkMakeInvoices(
  vatIds: string[],
  partnerId: string,
  arAccountId: string,
  incomeAccountId: string,
  vatAccountId: string,
): Promise<ActionResult<{ ok: number; failed: number; errors: string[] }>> {
  if (!vatIds.length) return { error: "Сонгох мөр алга" };
  if (!partnerId || !arAccountId || !incomeAccountId || !vatAccountId) {
    return { error: "Бүх дансыг сонгоно уу" };
  }

  const supabase = await createClient();
  try {
    const { data, error } = await supabase.rpc("vat_bulk_make_invoices", {
      p_vat_ids: vatIds,
      p_partner_id: partnerId,
      p_ar_account: arAccountId,
      p_income_account: incomeAccountId,
      p_vat_account: vatAccountId,
    });
    if (error) return { error: error.message };

    const rows = (data ?? []) as Array<{ vat_id: string; status: string; error: string | null }>;
    const ok = rows.filter((r) => r.status === "ok").length;
    const failed = rows.filter((r) => r.status === "failed");
    revalidatePath("/vat");
    revalidatePath("/journals");
    revalidatePath("/receivables");
    return {
      success: `${ok}/${rows.length} нэхэмжлэл үүссэн`,
      data: { ok, failed: failed.length, errors: failed.map((f) => f.error ?? "?") },
    };
  } catch (e) {
    const err = actionError(e);
    return { error: err.error };
  }
}

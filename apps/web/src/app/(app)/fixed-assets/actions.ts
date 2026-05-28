"use server";

import { createClient } from "@/lib/supabase/server";
import { actionError, calculateDepreciation, type ActionResult } from "@/lib/rpc";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function upsertAsset(
  id: string | null,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const code        = String(formData.get("code") || "").trim() || null;
  const name        = String(formData.get("name") || "").trim();
  const category    = String(formData.get("category") || "").trim() || null;
  const purchaseDate = String(formData.get("purchase_date") || "").trim();
  const purchaseAmount = Number(formData.get("purchase_amount") || 0);
  const usefulLifeMonths = Number(formData.get("useful_life_months") || 0);
  const salvageValue = Number(formData.get("salvage_value") || 0);
  const accumulatedDepreciation = Number(formData.get("accumulated_depreciation") || 0);
  const assetAccountId = String(formData.get("asset_account_id") || "").trim();
  const depreciationAccountId = String(formData.get("depreciation_account_id") || "").trim() || null;
  const expenseAccountId = String(formData.get("expense_account_id") || "").trim() || null;
  const location    = String(formData.get("location") || "").trim() || null;
  const responsiblePerson = String(formData.get("responsible_person") || "").trim() || null;
  const notes       = String(formData.get("notes") || "").trim() || null;
  const status      = String(formData.get("status") || "active");

  if (!name) return { error: "Нэр заавал бөглөнө" };
  if (!purchaseDate) return { error: "Огноо заавал бөглөнө" };
  if (purchaseAmount <= 0) return { error: "Худалдан авах үнэ 0-ээс их байх ёстой" };
  if (usefulLifeMonths <= 0) return { error: "Ашиглалтын хугацаа 0-ээс их байх ёстой" };
  if (salvageValue >= purchaseAmount) return { error: "Үлдэгдэл үнэ < худалдан авах үнэ" };
  if (!assetAccountId) return { error: "Хөрөнгийн данс сонгоно уу" };

  const supabase = await createClient();
  const { data: uc } = await supabase.from("user_companies").select("company_id").order("is_default", { ascending: false }).limit(1).maybeSingle();
  if (!uc?.company_id) return { error: "Компани олдсонгүй" };

  try {
    const payload = {
      company_id: uc.company_id,
      code, name, category, purchase_date: purchaseDate, purchase_amount: purchaseAmount,
      useful_life_months: usefulLifeMonths, salvage_value: salvageValue,
      accumulated_depreciation: accumulatedDepreciation,
      asset_account_id: assetAccountId,
      depreciation_account_id: depreciationAccountId,
      expense_account_id: expenseAccountId,
      location, responsible_person: responsiblePerson, notes,
      status: status as "active" | "inactive" | "disposed" | "written_off",
    };
    if (id) {
      const { error } = await supabase.from("fixed_assets").update(payload).eq("id", id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("fixed_assets").insert(payload);
      if (error) {
        if (error.code === "23505") return { error: `Код "${code}" аль хэдийн бий` };
        return { error: error.message };
      }
    }
    revalidatePath("/fixed-assets");
    redirect(`/fixed-assets?flash=${encodeURIComponent(id ? "Шинэчлэгдсэн" : "Үүсгэгдсэн")}&type=success`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return actionError(e);
  }
}

// Run monthly depreciation for a period (RPC)
export async function runDepreciation(periodId: string): Promise<ActionResult<{ count: number }>> {
  const supabase = await createClient();
  try {
    const results = await calculateDepreciation(supabase, periodId);
    revalidatePath("/fixed-assets");
    revalidatePath("/journals");
    return {
      success: `${results.length} хөрөнгийн элэгдэл тооцоологдсон`,
      data: { count: results.length },
    };
  } catch (e) {
    const err = actionError(e);
    return { error: err.error };
  }
}

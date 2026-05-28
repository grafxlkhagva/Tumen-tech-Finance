"use server";

import { createClient } from "@/lib/supabase/server";
import { actionError, type ActionResult } from "@/lib/rpc";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const VALID_TYPES = ["asset", "liability", "equity", "income", "expense"] as const;
type AccountType = (typeof VALID_TYPES)[number];

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------
export async function createAccount(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const code      = String(formData.get("code") || "").trim();
  const name      = String(formData.get("name") || "").trim();
  const type      = String(formData.get("type") || "") as AccountType;
  const parentId  = String(formData.get("parent_id") || "") || null;
  const isPostable = formData.get("is_postable") === "1";
  const currency  = String(formData.get("currency") || "MNT").trim() || "MNT";
  const notes     = String(formData.get("notes") || "").trim() || null;

  if (!code) return { error: "Дансны код заавал бөглөнө" };
  if (!name) return { error: "Дансны нэр заавал бөглөнө" };
  if (!VALID_TYPES.includes(type)) return { error: "Дансны төрөл буруу" };

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
      .from("accounts")
      .insert({
        company_id: uc.company_id,
        code,
        name,
        type,
        parent_id: parentId,
        is_postable: isPostable,
        currency,
        notes,
      })
      .select("id")
      .single();
    if (error) {
      // Common case: unique violation (duplicate code)
      if (error.code === "23505") return { error: `Код "${code}" аль хэдийн ашиглагдсан` };
      return { error: error.message };
    }
    revalidatePath("/accounts");
    redirect(`/accounts?flash=${encodeURIComponent(`Данс үүсгэсэн: ${code}`)}&type=success`);
  } catch (e) {
    // redirect() throws a special error that Next.js handles — re-throw it
    if (e && typeof e === "object" && "digest" in e) throw e;
    return actionError(e);
  }
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------
export async function updateAccount(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const code      = String(formData.get("code") || "").trim();
  const name      = String(formData.get("name") || "").trim();
  const type      = String(formData.get("type") || "") as AccountType;
  const parentId  = String(formData.get("parent_id") || "") || null;
  const isPostable = formData.get("is_postable") === "1";
  const isActive  = formData.get("is_active") === "1";
  const notes     = String(formData.get("notes") || "").trim() || null;

  if (!code) return { error: "Код заавал бөглөнө" };
  if (!name) return { error: "Нэр заавал бөглөнө" };
  if (!VALID_TYPES.includes(type)) return { error: "Төрөл буруу" };

  const supabase = await createClient();
  try {
    const { error } = await supabase
      .from("accounts")
      .update({ code, name, type, parent_id: parentId, is_postable: isPostable, is_active: isActive, notes })
      .eq("id", id);
    if (error) {
      if (error.code === "23505") return { error: `Код "${code}" аль хэдийн ашиглагдсан` };
      return { error: error.message };
    }
    revalidatePath("/accounts");
    revalidatePath(`/accounts/${id}/edit`);
    redirect(`/accounts?flash=${encodeURIComponent(`Дансны мэдээлэл шинэчлэгдсэн`)}&type=success`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return actionError(e);
  }
}

// ---------------------------------------------------------------------------
// SOFT DELETE (set deleted_at)
// ---------------------------------------------------------------------------
export async function softDeleteAccount(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  try {
    // Check usage in journal_lines first
    const { count: usedIn } = await supabase
      .from("journal_lines")
      .select("id", { count: "exact", head: true })
      .eq("account_id", id);
    if (usedIn && usedIn > 0) {
      return { error: `Энэ дансанд ${usedIn} гүйлгээний мөр бичигдсэн — устгах боломжгүй. Идэвхгүй болгох уу?` };
    }

    const { error } = await supabase
      .from("accounts")
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/accounts");
    return { success: "Данс устгагдсан" };
  } catch (e) {
    return actionError(e);
  }
}

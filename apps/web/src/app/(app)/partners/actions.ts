"use server";

import { createClient } from "@/lib/supabase/server";
import { actionError, type ActionResult } from "@/lib/rpc";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const VALID_TYPES = ["customer", "supplier", "both", "employee", "other"] as const;
type PartnerType = (typeof VALID_TYPES)[number];

function parseAliases(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------
export async function createPartner(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const name      = String(formData.get("name") || "").trim();
  const code      = String(formData.get("code") || "").trim() || null;
  const register  = String(formData.get("register") || "").trim() || null;
  const tin       = String(formData.get("tin") || "").trim() || null;
  const type      = String(formData.get("type") || "customer") as PartnerType;
  const phone     = String(formData.get("phone") || "").trim() || null;
  const email     = String(formData.get("email") || "").trim() || null;
  const address   = String(formData.get("address") || "").trim() || null;
  const aliasesRaw = String(formData.get("aliases") || "");
  const isVatPayer = formData.get("is_vat_payer") === "1";
  const notes     = String(formData.get("notes") || "").trim() || null;

  if (!name) return { error: "Нэр заавал бөглөнө" };
  if (!VALID_TYPES.includes(type)) return { error: "Төрөл буруу" };

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
      .from("partners")
      .insert({
        company_id: uc.company_id,
        code,
        name,
        register,
        tin,
        type,
        phone,
        email,
        address,
        aliases: parseAliases(aliasesRaw),
        is_vat_payer: isVatPayer,
        notes,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return { error: `Код "${code}" аль хэдийн бий` };
      return { error: error.message };
    }
    revalidatePath("/partners");
    redirect(`/partners/${data.id}?flash=${encodeURIComponent(`Харилцагч үүсгэсэн: ${name}`)}&type=success`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return actionError(e);
  }
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------
export async function updatePartner(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const name      = String(formData.get("name") || "").trim();
  const code      = String(formData.get("code") || "").trim() || null;
  const register  = String(formData.get("register") || "").trim() || null;
  const tin       = String(formData.get("tin") || "").trim() || null;
  const type      = String(formData.get("type") || "customer") as PartnerType;
  const phone     = String(formData.get("phone") || "").trim() || null;
  const email     = String(formData.get("email") || "").trim() || null;
  const address   = String(formData.get("address") || "").trim() || null;
  const aliasesRaw = String(formData.get("aliases") || "");
  const isVatPayer = formData.get("is_vat_payer") === "1";
  const isActive  = formData.get("is_active") === "1";
  const notes     = String(formData.get("notes") || "").trim() || null;

  if (!name) return { error: "Нэр заавал бөглөнө" };
  if (!VALID_TYPES.includes(type)) return { error: "Төрөл буруу" };

  const supabase = await createClient();
  try {
    const { error } = await supabase
      .from("partners")
      .update({
        code, name, register, tin, type, phone, email, address,
        aliases: parseAliases(aliasesRaw),
        is_vat_payer: isVatPayer, is_active: isActive, notes,
      })
      .eq("id", id);
    if (error) {
      if (error.code === "23505") return { error: `Код "${code}" аль хэдийн бий` };
      return { error: error.message };
    }
    revalidatePath("/partners");
    revalidatePath(`/partners/${id}`);
    redirect(`/partners/${id}?flash=${encodeURIComponent("Харилцагч шинэчлэгдсэн")}&type=success`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return actionError(e);
  }
}

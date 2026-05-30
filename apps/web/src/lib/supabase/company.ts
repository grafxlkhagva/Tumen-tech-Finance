import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Тухайн нэвтэрсэн user-ийн default компани (`is_default = true`)-г буцаана.
 * RLS-ийн дагуу `user_companies`-аас зөвхөн өөрийнх нь membership шүүгдэнэ —
 * email/uid тус бүрд давтан filter хийх шаардлагагүй.
 *
 * Хуудас + Excel route-ууд (balance-sheet, cashflow, trial-balance гм) нэг ижил
 * lookup-аар нь хийдгийг refactor хийгээд "single source of truth" болгож байна.
 */
export type CompanyMeta = {
  name: string;
  register: string | null;
  tin: string | null;
};

export type CurrentCompany = {
  companyId: string;
  meta: CompanyMeta | null;
};

export async function getCurrentCompany(
  supabase: SupabaseClient,
): Promise<CurrentCompany | null> {
  const { data, error } = await supabase
    .from("user_companies")
    .select("company_id, companies(name, register, tin)")
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.company_id) return null;

  // Supabase nested-select буцаагдсан утга нь FK cardinality-аас хамаараад
  // object эсвэл array байж болно. Хоёр нөхцөлд адил гарцыг өгнө.
  const raw = data.companies as unknown;
  const obj = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
  const meta: CompanyMeta | null = obj
    ? {
        name: String((obj as Record<string, unknown>).name ?? ""),
        register: ((obj as Record<string, unknown>).register as string | null) ?? null,
        tin: ((obj as Record<string, unknown>).tin as string | null) ?? null,
      }
    : null;

  return { companyId: data.company_id, meta };
}

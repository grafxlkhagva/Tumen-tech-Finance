import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/partners/suggest?q=...
 *
 * Cyrillic-aware fuzzy partner search:
 *   - If q is non-empty: calls find_partner_by_name RPC (uses pg_trgm + unaccent
 *     so Cyrillic/Latin/alias variants all match).
 *   - If q is empty: returns first 20 partners ordered by name.
 *
 * Used by PartnerPicker combobox.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";

  const supabase = await createClient();

  if (!q) {
    const { data, error } = await supabase
      .from("partners")
      .select("id, name, register, type")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name")
      .limit(20);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ partners: data ?? [] });
  }

  // Resolve company_id from current user (RLS will filter, but the RPC requires it)
  const { data: ucData, error: ucError } = await supabase
    .from("user_companies")
    .select("company_id")
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ucError || !ucData?.company_id) {
    return NextResponse.json({ partners: [] });
  }

  // Try fuzzy match via RPC
  const { data: matches, error: rpcErr } = await supabase.rpc("find_partner_by_name", {
    p_company_id: ucData.company_id,
    p_search: q,
    p_threshold: 0.3,
  });

  if (rpcErr) {
    // Fallback: simple ilike if RPC fails
    const { data } = await supabase
      .from("partners")
      .select("id, name, register, type")
      .is("deleted_at", null)
      .ilike("name", `%${q}%`)
      .limit(20);
    return NextResponse.json({ partners: data ?? [] });
  }

  if (!matches || matches.length === 0) {
    return NextResponse.json({ partners: [] });
  }

  // Hydrate partner rows from match ids (preserve similarity ranking)
  const partnerIds = matches.map((m: { partner_id: string }) => m.partner_id);
  const { data: partners } = await supabase
    .from("partners")
    .select("id, name, register, type")
    .in("id", partnerIds);

  // Re-order to preserve RPC's similarity ordering, dedupe by id
  const seen = new Set<string>();
  const ordered: Array<{ id: string; name: string; register: string | null; type: string; similarity: number }> = [];
  for (const m of matches as { partner_id: string; similarity: number }[]) {
    if (seen.has(m.partner_id)) continue;
    seen.add(m.partner_id);
    const p = partners?.find((x) => x.id === m.partner_id);
    if (p) ordered.push({ ...p, similarity: m.similarity });
  }

  return NextResponse.json({ partners: ordered });
}

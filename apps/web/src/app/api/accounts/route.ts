import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/accounts?q=...&type=...&postable=1
 *
 * Returns accounts for the user's company, filtered by:
 *   - q: matches code OR name (case-insensitive)
 *   - type: asset | liability | equity | income | expense
 *   - postable: "1" → only is_postable=true
 *
 * Used by AccountPicker combobox.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const type = searchParams.get("type")?.trim() || "";
  const postableOnly = searchParams.get("postable") === "1";

  const supabase = await createClient();

  let query = supabase
    .from("accounts")
    .select("id, code, name, type")
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("code")
    .limit(50);

  if (q) {
    // Match code prefix OR name substring (case-insensitive)
    query = query.or(`code.ilike.${q}%,name.ilike.%${q}%`);
  }

  if (type && ["asset", "liability", "equity", "income", "expense"].includes(type)) {
    query = query.eq("type", type as "asset" | "liability" | "equity" | "income" | "expense");
  }

  if (postableOnly) {
    query = query.eq("is_postable", true);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ accounts: data ?? [] });
}

import { createClient } from "@/lib/supabase/server";
import { buildXlsxResponse } from "@/lib/xlsx-helpers";
import {
  type RawBalance,
  buildBalanceSheet,
  parseAsOf,
  defaultPrevDate,
} from "@/lib/reports/balance-sheet";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asOf = parseAsOf(url.searchParams.get("as_of") ?? undefined);
  const prev = url.searchParams.get("prev")
    ? parseAsOf(url.searchParams.get("prev") ?? undefined)
    : defaultPrevDate(asOf);

  const supabase = await createClient();
  const { data: uc } = await supabase
    .from("user_companies")
    .select("company_id, companies(name, register, tin)")
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  const companyId = uc?.company_id ?? null;
  if (!companyId) return new Response("No company", { status: 403 });
  const company = (Array.isArray(uc?.companies) ? uc?.companies[0] : uc?.companies) ?? null;

  const [curRes, prvRes] = await Promise.all([
    supabase.rpc("fn_account_balance_at", { p_company_id: companyId, p_as_of: asOf }),
    supabase.rpc("fn_account_balance_at", { p_company_id: companyId, p_as_of: prev }),
  ]);

  const bs = buildBalanceSheet(
    (curRes.data ?? []) as RawBalance[],
    (prvRes.data ?? []) as RawBalance[],
  );

  const sheet: (string | number | null)[][] = [];

  // Header block matching the form
  sheet.push(["Сангийн Сайдын 2017 оны 361 дугаар тушаалын 2 дугаар хавсралт"]);
  sheet.push(["САНХҮҮ БАЙДЛЫН ТАЙЛАН"]);
  sheet.push([`"${company?.name ?? "Тумэн"}" ХХК · ${asOf}-ний байдлаар`]);
  if (company?.register || company?.tin) {
    sheet.push([
      `${company.register ? `Регистр: ${company.register}` : ""} ${
        company.tin ? `| ХРГ: ${company.tin}` : ""
      } | (төгрөгөөр)`,
    ]);
  }
  sheet.push([]);

  // Table header
  sheet.push(["Мөр", "Үзүүлэлт", `${asOf}`, `${prev}`]);
  sheet.push(["1. ХӨРӨНГӨ"]);
  for (const row of bs.assets) sheet.push([row.code, row.label, row.current, row.previous]);
  sheet.push(["1.X", "ХӨРӨНГИЙН НИЙТ ДҮН", bs.totals.asset_total.current, bs.totals.asset_total.previous]);
  sheet.push([]);
  sheet.push(["2. ӨР ТӨЛБӨР + ЭЗДИЙН ӨМЧ"]);
  for (const row of bs.liabilities) sheet.push([row.code, row.label, row.current, row.previous]);
  sheet.push(["2.2", "Өр төлбөрийн нийт дүн", bs.totals.liability_total.current, bs.totals.liability_total.previous]);
  for (const row of bs.equity) sheet.push([row.code, row.label, row.current, row.previous]);
  sheet.push(["2.X", "ӨР + ЭЗНИЙ ӨМЧИЙН НИЙТ", bs.totals.liab_equity_total.current, bs.totals.liab_equity_total.previous]);

  return buildXlsxResponse(`balance-sheet-${asOf}.xlsx`, [
    { name: asOf.slice(0, 31), data: sheet },
  ]);
}

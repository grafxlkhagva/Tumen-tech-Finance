import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/supabase/company";
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
  const prevParam = url.searchParams.get("prev");
  const prev = prevParam && /^\d{4}-\d{2}-\d{2}$/.test(prevParam)
    ? prevParam
    : defaultPrevDate(asOf);

  const supabase = await createClient();
  const company = await getCurrentCompany(supabase);
  if (!company) return new Response("No company", { status: 403 });

  const [curRes, prvRes] = await Promise.all([
    supabase.rpc("fn_account_balance_at", { p_company_id: company.companyId, p_as_of: asOf }),
    supabase.rpc("fn_account_balance_at", { p_company_id: company.companyId, p_as_of: prev }),
  ]);

  if (curRes.error || prvRes.error) {
    return new Response(
      `RPC error: ${curRes.error?.message || prvRes.error?.message}`,
      { status: 500 },
    );
  }

  const bs = buildBalanceSheet(
    (curRes.data ?? []) as RawBalance[],
    (prvRes.data ?? []) as RawBalance[],
  );

  const companyName = company.meta?.name ?? "(Байгууллага сонгогдоогүй)";
  const sheet: (string | number | null)[][] = [];

  // Header block matching the form
  sheet.push(["Сангийн Сайдын 2017 оны 361 дугаар тушаалын 2 дугаар хавсралт"]);
  sheet.push(["САНХҮҮ БАЙДЛЫН ТАЙЛАН"]);
  sheet.push([`"${companyName}" ХХК · ${asOf}-ний байдлаар`]);
  if (company.meta?.register || company.meta?.tin) {
    sheet.push([
      `${company.meta.register ? `Регистр: ${company.meta.register}` : ""} ${
        company.meta.tin ? `| ХРГ: ${company.meta.tin}` : ""
      } | (төгрөгөөр)`,
    ]);
  }

  // Surface chart-of-accounts mistype warnings at the top of the export.
  if (bs.warnings.length > 0) {
    sheet.push([]);
    sheet.push(["⚠ Дансны тохиргооны анхааруулга:"]);
    for (const w of bs.warnings) sheet.push([w.message]);
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
    { name: `Баланс-${asOf}`.slice(0, 31), data: sheet },
  ]);
}

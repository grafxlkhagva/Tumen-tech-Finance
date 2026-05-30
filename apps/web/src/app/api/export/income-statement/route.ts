import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/supabase/company";
import { buildXlsxResponse } from "@/lib/xlsx-helpers";
import {
  type IsAccountRow,
  buildIncomeStatement,
  parseIsPeriod,
} from "@/lib/reports/income-statement";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const period = parseIsPeriod({
    date_from: url.searchParams.get("date_from") ?? undefined,
    date_to:   url.searchParams.get("date_to") ?? undefined,
    year:      url.searchParams.get("year") ?? undefined,
    month:     url.searchParams.get("month") ?? undefined,
  });

  const supabase = await createClient();
  const company = await getCurrentCompany(supabase);
  if (!company) return new Response("No company", { status: 403 });

  const [curRes, prvRes] = await Promise.all([
    supabase.rpc("fn_income_statement", {
      p_company_id: company.companyId,
      p_start: period.from,
      p_end: period.to,
    }),
    supabase.rpc("fn_income_statement", {
      p_company_id: company.companyId,
      p_start: period.prevFrom,
      p_end: period.prevTo,
    }),
  ]);

  if (curRes.error || prvRes.error) {
    return new Response(
      `RPC error: ${curRes.error?.message || prvRes.error?.message}`,
      { status: 500 },
    );
  }

  const is = buildIncomeStatement(
    (curRes.data ?? []) as IsAccountRow[],
    (prvRes.data ?? []) as IsAccountRow[],
  );

  const companyName = company.meta?.name ?? "(Байгууллага сонгогдоогүй)";

  const sheet: (string | number | null)[][] = [];
  sheet.push(["Сангийн Сайдын 2017 оны 361 дүгээр тушаалын 3 дугаар хавсралт"]);
  sheet.push(["ОРЛОГЫН ДЭЛГЭРЭНГҮЙ ТАЙЛАН"]);
  sheet.push([`"${companyName}" ХХК · ${period.label}`]);
  if (company.meta?.register || company.meta?.tin) {
    const parts: string[] = [];
    if (company.meta.register) parts.push(`Регистр: ${company.meta.register}`);
    if (company.meta.tin) parts.push(`ХРГ: ${company.meta.tin}`);
    sheet.push([parts.join(" | ") + " | (төгрөгөөр)"]);
  }
  sheet.push([]);

  sheet.push([
    "Мөр",
    "Үзүүлэлт",
    `${period.prevFrom} → ${period.prevTo}`,
    `${period.from} → ${period.to}`,
  ]);

  for (const row of is.rows) {
    sheet.push([row.num, row.label, row.previous, row.current]);
  }

  const filename = `income-statement-${period.from}_${period.to}.xlsx`;
  return buildXlsxResponse(filename, [
    { name: `IS-${period.from}`.slice(0, 31), data: sheet },
  ]);
}

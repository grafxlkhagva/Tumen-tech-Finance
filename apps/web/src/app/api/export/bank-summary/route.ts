import { createClient } from "@/lib/supabase/server";
import { buildXlsxResponse } from "@/lib/xlsx-helpers";
import {
  type BankFlowRow,
  type MonthCell,
  type BankSection,
  type ConsolidatedSection,
  buildBankSections,
  parseYear,
} from "@/lib/reports/bank-summary";

/**
 * Bank monthly summary export. Outputs a single sheet with one block per
 * bank (and a НЭГТГЭЛ block when >1 banks). Each block mirrors the on-screen
 * matrix: 5 rows × 14 columns (Үзүүлэлт + 12 months + Нийт).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const year = parseYear(url.searchParams.get("year") ?? undefined);

  const supabase = await createClient();
  const { data: uc } = await supabase
    .from("user_companies")
    .select("company_id")
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  const companyId = uc?.company_id ?? null;
  if (!companyId) return new Response("No company", { status: 403 });

  const { data: pgRows } = await supabase.rpc("fn_bank_monthly_flow", {
    p_company_id: companyId,
    p_year: year,
  });

  const { sections, consolidated } = buildBankSections((pgRows ?? []) as BankFlowRow[]);

  const sheet: (string | number | null)[][] = [];

  // Sheet title + range
  sheet.push([`Мөнгөн хөрөнгийн нэгтгэл — ${year} он`]);
  sheet.push([]);

  function addBlock(
    title: string,
    opening: number,
    closing: number,
    monthly: MonthCell[],
    totals: { inc: number; exp: number; net: number },
  ) {
    sheet.push([title]);
    sheet.push([
      `Эхний үлдэгдэл: ${opening.toFixed(2)}`,
      `Эцсийн үлдэгдэл: ${closing.toFixed(2)}`,
    ]);
    sheet.push([
      "Үзүүлэлт",
      ...monthly.map((m) => `${m.m}-р сар`),
      "Нийт",
    ]);
    sheet.push(["Эхний үлдэгдэл", ...monthly.map((m) => m.open), opening]);
    sheet.push(["↓ Орлого",       ...monthly.map((m) => m.inc),  totals.inc]);
    sheet.push(["↑ Зарлага",       ...monthly.map((m) => m.exp),  totals.exp]);
    sheet.push(["Цэвэр урсгал",   ...monthly.map((m) => m.net),  totals.net]);
    sheet.push(["Эцсийн үлдэгдэл", ...monthly.map((m) => m.close), closing]);
    sheet.push([]); // spacer between blocks
  }

  for (const s of sections as BankSection[]) {
    addBlock(
      `[${s.gl_code ?? "—"}] ${s.bank_name}`,
      s.opening,
      s.closing,
      s.monthly,
      s.totals,
    );
  }

  if (consolidated && sections.length > 1) {
    const c = consolidated as ConsolidatedSection;
    addBlock("НЭГТГЭЛ — БҮХ БАНКНЫ", c.opening, c.closing, c.monthly, c.totals);
  }

  return buildXlsxResponse(`bank-summary-${year}.xlsx`, [
    { name: String(year).slice(0, 31), data: sheet },
  ]);
}

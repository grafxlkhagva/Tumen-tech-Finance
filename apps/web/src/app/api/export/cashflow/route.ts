import { createClient } from "@/lib/supabase/server";
import { buildXlsxResponse } from "@/lib/xlsx-helpers";
import {
  type CashflowMonthlyRow,
  buildInternalCashflow,
  buildOfficialCashflow,
  parseYear,
  MN_MONTH_LABELS,
} from "@/lib/reports/cashflow";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const year = parseYear(url.searchParams.get("year") ?? undefined);
  const mode = url.searchParams.get("mode") === "official" ? "official" : "internal";

  const supabase = await createClient();
  const { data: uc } = await supabase
    .from("user_companies")
    .select("company_id, companies(name)")
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  const companyId = uc?.company_id ?? null;
  if (!companyId) return new Response("No company", { status: 403 });
  const company = (Array.isArray(uc?.companies) ? uc?.companies[0] : uc?.companies) as
    | { name?: string }
    | null
    | undefined;
  const companyName = company?.name ?? "Тумэн";

  const [flowRes, openRes] = await Promise.all([
    supabase.rpc("fn_cashflow_monthly", { p_company_id: companyId, p_year: year }),
    supabase.rpc("fn_cashflow_opening_cash", { p_company_id: companyId, p_year: year }),
  ]);
  const rawRows = (flowRes.data ?? []) as CashflowMonthlyRow[];
  const openCash = Number(openRes.data ?? 0);

  const filename = `cashflow-${year}-${mode}.xlsx`;

  if (mode === "internal") {
    const data = buildInternalCashflow(rawRows, openCash);
    const sheet: (string | number | null)[][] = [];
    sheet.push([`"${companyName}" ХХК`]);
    sheet.push([`МӨНГӨН УРСГАЛЫН ТАЙЛАН — ${year} ОН (Шууд арга, MNT)`]);
    sheet.push([]);
    const header: (string | number | null)[] = ["Код", "Үзүүлэлт / Тайлбар"];
    for (const m of MN_MONTH_LABELS) header.push(`${m} сар`);
    header.push("Нийт");
    sheet.push(header);

    for (const row of data.rows) {
      if (row.kind === "section") {
        sheet.push([row.label]);
      } else if (row.kind === "subhdr") {
        sheet.push(["", row.label]);
      } else {
        sheet.push([row.code, row.label, ...row.vals, row.total]);
      }
    }
    sheet.push(["", "Эхний үлдэгдэл", ...data.openingByMonth, data.openCash]);
    sheet.push(["", "Эцсийн үлдэгдэл", ...data.closingByMonth, data.grandClosing]);

    return buildXlsxResponse(filename, [
      { name: `${year}-Дотоод`.slice(0, 31), data: sheet },
    ]);
  }

  // Official
  const o = buildOfficialCashflow(rawRows);
  const sheet: (string | number | null)[][] = [];
  sheet.push(["Сангийн Сайдын 2017 оны 361 дугаар тушаалын 4 дугаар хавсралт"]);
  sheet.push(["МӨНГӨН ГҮЙЛГЭЭНИЙ ТАЙЛАН"]);
  sheet.push([`"${companyName}" ХХК · ${year} он · (төгрөгөөр)`]);
  sheet.push([]);
  sheet.push(["Мөр", "Үзүүлэлт", "Дүн"]);
  sheet.push(["1.1", "Мөнгө орлого (үндсэн үйл ажиллагаа)", o.op_income]);
  sheet.push(["1.2", "Мөнгө зарлага (үндсэн үйл ажиллагаа)", o.op_expense]);
  sheet.push(["1.3", "Үндсэн үйл ажиллагааны цэвэр", o.op_net]);
  sheet.push([]);
  sheet.push(["2.1", "Мөнгө орлого (хөрөнгө борлуулсан)", o.inv_income]);
  sheet.push(["2.2", "Мөнгө зарлага (хөрөнгө худалдан авсан)", o.inv_expense]);
  sheet.push(["2.3", "Хөрөнгө оруулалтын цэвэр", o.inv_net]);
  sheet.push([]);
  sheet.push(["3.1", "Зээл, зогсоол авсан", o.fin_income]);
  sheet.push(["3.2", "Зээл, зогсоол төлсөн", o.fin_expense]);
  sheet.push(["3.3", "Санхүүгийн цэвэр", o.fin_net]);
  sheet.push([]);
  sheet.push(["4", "МӨНГӨН ХӨРӨНГИЙН ЦЭВЭР ӨСӨЛТ / (БУУРАЛТ)", o.total_net]);

  // monthly summary as second sheet
  const monthlySheet: (string | number | null)[][] = [];
  monthlySheet.push(["Сар", "Орлого", "Зарлага"]);
  for (const m of o.monthly) {
    monthlySheet.push([`${m.month}-р сар`, m.income, m.expense]);
  }

  return buildXlsxResponse(filename, [
    { name: `${year}-Маягт`.slice(0, 31), data: sheet },
    { name: "Сарын хөдөлгөөн", data: monthlySheet },
  ]);
}

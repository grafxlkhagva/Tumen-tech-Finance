import { createClient } from "@/lib/supabase/server";
import { buildXlsxResponse } from "@/lib/xlsx-helpers";
import {
  type TBRpcRow,
  parseTbPeriod,
  transformTbRows,
} from "@/lib/reports/trial-balance";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sp = {
    range: url.searchParams.get("range") || undefined,
    date_from: url.searchParams.get("date_from") || undefined,
    date_to: url.searchParams.get("date_to") || undefined,
  };
  const period = parseTbPeriod(sp);
  const showZero = url.searchParams.get("show_zero") === "1";

  const supabase = await createClient();

  const { data: uc } = await supabase
    .from("user_companies")
    .select("company_id")
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  const companyId = uc?.company_id ?? null;
  if (!companyId) {
    return new Response("No company", { status: 403 });
  }

  const { data: pgRows } = await supabase.rpc("fn_account_balances_period", {
    p_company_id: companyId,
    p_start_date: period.dateFrom,
    p_end_date: period.dateTo,
  });

  const { rows, totals } = transformTbRows((pgRows ?? []) as TBRpcRow[], showZero);

  const sheet: (string | number | null)[][] = [
    ["Код", "Дансны нэр", "Тип",
     "Эхний Дт", "Эхний Кт",
     "Гүйлгээ Дт", "Гүйлгээ Кт",
     "Эцсийн Дт", "Эцсийн Кт"],
    ...rows.map((r) => [
      r.code, r.name, r.acc_type,
      r.ob_dt, r.ob_kt,
      r.p_dt,  r.p_kt,
      r.cl_dt, r.cl_kt,
    ]),
    [],
    ["", "НИЙТ", "",
     totals.ob_dt, totals.ob_kt,
     totals.p_dt,  totals.p_kt,
     totals.cl_dt, totals.cl_kt],
  ];

  // Filename: stable across all-time vs ranged
  const label = period.dateFrom && period.dateTo
    ? `${period.dateFrom}_${period.dateTo}`
    : "all";

  return buildXlsxResponse(`trial-balance-${label}.xlsx`, [
    { name: label.slice(0, 31), data: sheet }, // sheet name max 31 chars
  ]);
}

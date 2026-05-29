import { createClient } from "@/lib/supabase/server";
import { buildXlsxResponse } from "@/lib/xlsx-helpers";

const COMPANY_ID = "00000000-0000-0000-0000-000000000001";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dateFrom = url.searchParams.get("date_from") || `${new Date().getFullYear()}-01-01`;
  const dateTo = url.searchParams.get("date_to") || new Date().toISOString().slice(0, 10);
  const showZero = url.searchParams.get("show_zero") === "1";

  const supabase = await createClient();
  const { data: pgRows } = await supabase.rpc("fn_account_balances_period", {
    p_company_id: COMPANY_ID,
    p_start_date: dateFrom,
    p_end_date: dateTo,
  });

  const rows: (string | number | null)[][] = [
    ["Код", "Дансны нэр", "Тип",
     "Эхний Дт", "Эхний Кт",
     "Гүйлгээ Дт", "Гүйлгээ Кт",
     "Эцсийн Дт", "Эцсийн Кт"],
  ];

  let tot = { obDt: 0, obKt: 0, pDt: 0, pKt: 0, clDt: 0, clKt: 0 };

  for (const r of (pgRows ?? []) as Array<{
    code: string; name: string; type: string; is_postable: boolean;
    opening_balance: number; period_debit: number; period_credit: number; closing_balance: number;
  }>) {
    if (!r.is_postable) continue;
    const ob = Number(r.opening_balance ?? 0);
    const pDt = Number(r.period_debit ?? 0);
    const pKt = Number(r.period_credit ?? 0);
    const cl = Number(r.closing_balance ?? 0);
    const isDrSide = r.type === "asset" || r.type === "expense";
    const obDt = isDrSide ? (ob >= 0 ? ob : 0) : (ob < 0 ? -ob : 0);
    const obKt = isDrSide ? (ob < 0 ? -ob : 0) : (ob >= 0 ? ob : 0);
    const clDt = isDrSide ? (cl >= 0 ? cl : 0) : (cl < 0 ? -cl : 0);
    const clKt = isDrSide ? (cl < 0 ? -cl : 0) : (cl >= 0 ? cl : 0);
    if (!showZero && ob === 0 && pDt === 0 && pKt === 0) continue;

    rows.push([r.code, r.name, r.type, obDt, obKt, pDt, pKt, clDt, clKt]);
    tot.obDt += obDt; tot.obKt += obKt;
    tot.pDt += pDt; tot.pKt += pKt;
    tot.clDt += clDt; tot.clKt += clKt;
  }

  rows.push([], ["", "НИЙТ", "", tot.obDt, tot.obKt, tot.pDt, tot.pKt, tot.clDt, tot.clKt]);

  return buildXlsxResponse(`trial-balance-${dateFrom}_${dateTo}.xlsx`, [
    { name: `${dateFrom}_${dateTo}`, data: rows },
  ]);
}

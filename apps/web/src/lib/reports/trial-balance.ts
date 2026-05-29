/**
 * Trial balance shared logic — used by both the page and the Xlsx export route
 * so they can never drift from each other.
 *
 * - Pulls rows from `fn_account_balances_period` (returns signed balance
 *   where Asset/Expense is Dr-positive and Liability/Equity/Income is Cr-positive).
 * - Splits each balance into Dr/Cr display columns according to account type.
 * - Filters out fully-empty rows unless `showZero` is true.
 * - Reports both rendered rows and accumulated totals in one pass.
 */

export type TBRpcRow = {
  account_id: string;
  code: string;
  name: string;
  type: string;
  is_postable: boolean;
  opening_balance: number;
  period_debit: number;
  period_credit: number;
  closing_balance: number;
};

export type TBDisplayRow = {
  account_id: string;
  code: string;
  name: string;
  acc_type: string;
  ob_dt: number;
  ob_kt: number;
  p_dt: number;
  p_kt: number;
  cl_dt: number;
  cl_kt: number;
};

export type TBTotals = {
  ob_dt: number;
  ob_kt: number;
  p_dt: number;
  p_kt: number;
  cl_dt: number;
  cl_kt: number;
};

const ZERO_TOTALS = (): TBTotals => ({ ob_dt: 0, ob_kt: 0, p_dt: 0, p_kt: 0, cl_dt: 0, cl_kt: 0 });

export function transformTbRows(
  rawRows: TBRpcRow[],
  showZero = false,
): { rows: TBDisplayRow[]; totals: TBTotals } {
  const rows: TBDisplayRow[] = [];
  const totals = ZERO_TOTALS();

  for (const r of rawRows) {
    if (!r.is_postable) continue;

    const ob = Number(r.opening_balance ?? 0);
    const pDt = Number(r.period_debit ?? 0);
    const pKt = Number(r.period_credit ?? 0);
    const cl = Number(r.closing_balance ?? 0);

    const isDrSide = r.type === "asset" || r.type === "expense";
    const ob_dt = isDrSide ? (ob >= 0 ? ob : 0) : (ob < 0 ? -ob : 0);
    const ob_kt = isDrSide ? (ob < 0 ? -ob : 0) : (ob >= 0 ? ob : 0);
    const cl_dt = isDrSide ? (cl >= 0 ? cl : 0) : (cl < 0 ? -cl : 0);
    const cl_kt = isDrSide ? (cl < 0 ? -cl : 0) : (cl >= 0 ? cl : 0);

    if (!showZero && ob === 0 && pDt === 0 && pKt === 0) continue;

    rows.push({
      account_id: r.account_id,
      code: r.code,
      name: r.name,
      acc_type: r.type,
      ob_dt, ob_kt,
      p_dt: pDt, p_kt: pKt,
      cl_dt, cl_kt,
    });
    totals.ob_dt += ob_dt; totals.ob_kt += ob_kt;
    totals.p_dt  += pDt;   totals.p_kt  += pKt;
    totals.cl_dt += cl_dt; totals.cl_kt += cl_kt;
  }

  return { rows, totals };
}

/**
 * Parse trial-balance URL params into a normalized period selection.
 * Supports:
 *   ?range=all                  → all-time (RPC receives NULL)
 *   ?date_from=YYYY-MM-DD       → explicit dates
 *   ?date_to=YYYY-MM-DD
 *   (no params)                 → default: this-year-so-far
 */
export type TBPeriod = {
  /** ISO date or null when range=all */
  dateFrom: string | null;
  dateTo: string | null;
  /** human-friendly label for the header (e.g. "2026-01-01 → 2026-05-29" or "Бугд") */
  label: string;
  /** original raw search-param values, so links can preserve user intent */
  raw: { range?: string; date_from?: string; date_to?: string };
};

export function parseTbPeriod(sp: {
  range?: string;
  date_from?: string;
  date_to?: string;
}): TBPeriod {
  if (sp.range === "all") {
    return { dateFrom: null, dateTo: null, label: "Бугд", raw: sp };
  }
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const from = sp.date_from || yearStart;
  const to   = sp.date_to   || today;
  return { dateFrom: from, dateTo: to, label: `${from} → ${to}`, raw: sp };
}

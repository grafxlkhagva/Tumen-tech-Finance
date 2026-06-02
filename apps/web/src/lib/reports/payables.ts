/**
 * Payables dashboard — shared types + helpers for /payables.
 *
 * AP twin of src/lib/reports/receivables.ts. The page calls
 * `fn_payables_by_partner(company_id, status?, search?)` and renders a
 * per-supplier AP exposure table. Port of legacy/app.py:payables.
 */

export type ApStatus = "open" | "partial" | "paid";

export type PayableRpcRow = {
  partner_id: string;
  partner_code: string | null;
  partner_name: string;
  partner_register: string | null;
  invoiced: number;
  paid: number;
  remaining: number;
  diff: number;              // invoiced - paid; negative = overpaid
  status: ApStatus;
  match_pct: number;
};

export type PayableSummary = {
  cnt: { total: number; open: number; partial: number; paid: number };
  totals: { invoiced: number; paid: number; remaining: number };
};

const VALID_STATUS = new Set<ApStatus>(["open", "partial", "paid"]);

export function parseApStatus(s: string | undefined): ApStatus | "" {
  return s && VALID_STATUS.has(s as ApStatus) ? (s as ApStatus) : "";
}

/** NaN-safe coercion — `Number("abc")` returns NaN which would poison sums. */
const safeNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Build chip-count summary from the **unfiltered** result set so chip badges
 * show "how many in each bucket" even while filtered.
 */
export function buildPayableSummary(rows: PayableRpcRow[]): PayableSummary {
  let invoiced = 0, paid = 0, remaining = 0;
  let cOpen = 0, cPartial = 0, cPaid = 0;
  for (const r of rows) {
    invoiced  += safeNum(r.invoiced);
    paid      += safeNum(r.paid);
    remaining += safeNum(r.remaining);
    if (r.status === "open")         cOpen++;
    else if (r.status === "partial") cPartial++;
    else if (r.status === "paid")    cPaid++;
  }
  return {
    cnt: { total: rows.length, open: cOpen, partial: cPartial, paid: cPaid },
    totals: { invoiced, paid, remaining },
  };
}

/**
 * Payables dashboard — shared types + helpers for /payables.
 *
 * AP twin of src/lib/reports/receivables.ts. The page calls
 * `fn_payables_by_partner(company_id, status?, search?)` and renders a
 * per-supplier AP exposure table. Port of legacy/app.py:payables.
 */

/** Raw status the RPC can return. */
export type ApStatus = "open" | "partial" | "paid";

/**
 * Display-level status used by the UI. Adds "overpaid" — the RPC reports an
 * overpaid supplier (diff < 0, нэхэмжлэлгүй мөртлөө банкаар төлсөн) as 'open',
 * which is misleading: we don't owe them, we've paid extra. The UI derives a
 * distinct "Банк илүү" state so the badge colour and meaning agree.
 */
export type ApDisplayStatus = ApStatus | "overpaid";

/** Anything within ±1₮ of zero counts as reconciled (matches the SQL EPSILON). */
const OVERPAID_THRESHOLD = -1;

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
  cnt: { total: number; open: number; partial: number; paid: number; overpaid: number };
  totals: { invoiced: number; paid: number; remaining: number };
};

/** Hard cap mirrored from the RPC's LIMIT so the page can warn on truncation. */
export const PAGE_LIMIT = 2000;

/** NaN-safe coercion — `Number("abc")` returns NaN which would poison sums. */
export const safeNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Derive the display status for a row. Overpaid (diff well below zero) takes
 * precedence over the RPC's raw 'open'.
 */
export function displayApStatus(r: PayableRpcRow): ApDisplayStatus {
  if (safeNum(r.diff) < OVERPAID_THRESHOLD) return "overpaid";
  return r.status;
}

const VALID_DISPLAY = new Set<ApDisplayStatus>(["open", "partial", "paid", "overpaid"]);

export function parseApStatus(s: string | undefined): ApDisplayStatus | "" {
  return s && VALID_DISPLAY.has(s as ApDisplayStatus) ? (s as ApDisplayStatus) : "";
}

/**
 * Build chip-count summary from the result set. Counts key off the *display*
 * status so "Нээлттэй" excludes overpaid suppliers (they get their own
 * "Банк илүү" bucket) — fixes the metric that previously lumped them together.
 */
export function buildPayableSummary(rows: PayableRpcRow[]): PayableSummary {
  let invoiced = 0, paid = 0, remaining = 0;
  let cOpen = 0, cPartial = 0, cPaid = 0, cOver = 0;
  for (const r of rows) {
    invoiced  += safeNum(r.invoiced);
    paid      += safeNum(r.paid);
    remaining += safeNum(r.remaining);
    switch (displayApStatus(r)) {
      case "open":     cOpen++; break;
      case "partial":  cPartial++; break;
      case "paid":     cPaid++; break;
      case "overpaid": cOver++; break;
    }
  }
  return {
    cnt: { total: rows.length, open: cOpen, partial: cPartial, paid: cPaid, overpaid: cOver },
    totals: { invoiced, paid, remaining },
  };
}

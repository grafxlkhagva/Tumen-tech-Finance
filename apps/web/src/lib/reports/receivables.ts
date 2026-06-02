/**
 * Receivables dashboard — shared types + helpers for /receivables.
 *
 * The page calls `fn_receivables_by_partner(company_id, status?)` and renders
 * a per-partner AR exposure table. Port of legacy/app.py:receivables (eBarimt
 * outbound VAT + bank income → per-customer summary).
 */

export type ArStatus = "open" | "partial" | "paid";

export type ReceivableRpcRow = {
  partner_id: string;
  partner_code: string | null;
  partner_name: string;
  partner_register: string | null;
  invoiced: number;
  collected: number;
  remaining: number;
  status: ArStatus;
  match_pct: number;
};

export type ReceivableSummary = {
  cnt: { total: number; open: number; partial: number; paid: number };
  totals: { invoiced: number; collected: number; remaining: number };
};

const VALID_STATUS = new Set<ArStatus>(["open", "partial", "paid"]);

export function parseArStatus(s: string | undefined): ArStatus | "" {
  return s && VALID_STATUS.has(s as ArStatus) ? (s as ArStatus) : "";
}

/** NaN-safe coercion — `Number("abc")` returns NaN which would poison sums. */
const safeNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Build chip-count summary from the **unfiltered** result set — the rows the
 * page got back when no status filter was applied. Used to populate the chip
 * badges so users see "how many in each bucket" even while filtering.
 */
export function buildReceivableSummary(rows: ReceivableRpcRow[]): ReceivableSummary {
  let invoiced = 0, collected = 0, remaining = 0;
  let cOpen = 0, cPartial = 0, cPaid = 0;
  for (const r of rows) {
    invoiced  += safeNum(r.invoiced);
    collected += safeNum(r.collected);
    remaining += safeNum(r.remaining);
    if (r.status === "open")         cOpen++;
    else if (r.status === "partial") cPartial++;
    else if (r.status === "paid")    cPaid++;
  }
  return {
    cnt: { total: rows.length, open: cOpen, partial: cPartial, paid: cPaid },
    totals: { invoiced, collected, remaining },
  };
}

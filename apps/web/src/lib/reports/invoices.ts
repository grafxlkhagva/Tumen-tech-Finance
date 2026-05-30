/**
 * Invoices Report (Нэхэмжлэхийн тайлан) shared logic — used by both the
 * /invoices page and any download endpoints so the math/filters can never
 * drift between surfaces.
 *
 * Port of legacy/app.py:invoice_list() (/invoices route).
 */

export type InvoiceStatus = "draft" | "open" | "partial" | "paid" | "void";

export type InvoiceRow = {
  id: string;
  invoice_no: string | null;
  invoice_date: string;            // ISO
  due_date: string | null;         // ISO
  description: string | null;
  responsible: string | null;
  total_amount: number;
  paid_amount: number;
  remaining: number;
  status: InvoiceStatus;
  partner: { id: string; name: string } | null;
};

export type InvoiceFilters = {
  status: InvoiceStatus | "";
  month: number | "";        // 1-12 or empty (all months)
  q: string;                 // free-text search
};

export type InvoiceSummary = {
  totalBilled: number;
  totalPaid: number;
  totalRemaining: number;
  collectionPct: number;
  // Counts across the *currently filtered* set
  counts: {
    all: number;
    open: number;
    partial: number;
    paid: number;
  };
};

export type MonthlyAggregate = {
  month: number;
  count: number;
  billed: number;
  paid: number;
  remaining: number;
  pct: number;
};

// ────────────────────────────────────────────────────────────────────────────
// Param parsing
// ────────────────────────────────────────────────────────────────────────────

const VALID_STATUSES = new Set<InvoiceStatus>(["draft", "open", "partial", "paid", "void"]);

export function parseInvoiceFilters(sp: {
  status?: string;
  month?: string;
  q?: string;
}): InvoiceFilters {
  const status = (sp.status && VALID_STATUSES.has(sp.status as InvoiceStatus)
    ? (sp.status as InvoiceStatus)
    : "") as InvoiceStatus | "";
  const m = Number(sp.month);
  const month = m >= 1 && m <= 12 ? m : "";
  const q = (sp.q ?? "").trim().slice(0, 100);
  return { status, month, q };
}

// ────────────────────────────────────────────────────────────────────────────
// Filtering — applied after fetch so KPI counts can be computed both ways
// (filtered vs unfiltered).
// ────────────────────────────────────────────────────────────────────────────

export function filterInvoices(rows: InvoiceRow[], f: InvoiceFilters): InvoiceRow[] {
  const needle = f.q.toLowerCase();
  return rows.filter((r) => {
    if (f.status && r.status !== f.status) return false;
    if (f.month) {
      const m = Number(r.invoice_date.slice(5, 7));
      if (m !== f.month) return false;
    }
    if (needle) {
      const inv = (r.invoice_no ?? "").toLowerCase();
      const desc = (r.description ?? "").toLowerCase();
      const partner = (r.partner?.name ?? "").toLowerCase();
      if (!inv.includes(needle) && !desc.includes(needle) && !partner.includes(needle)) {
        return false;
      }
    }
    return true;
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Aggregates
// ────────────────────────────────────────────────────────────────────────────

export function buildInvoiceSummary(rows: InvoiceRow[]): InvoiceSummary {
  let totalBilled = 0;
  let totalPaid = 0;
  let totalRemaining = 0;
  let openN = 0;
  let partialN = 0;
  let paidN = 0;

  for (const r of rows) {
    totalBilled    += Number(r.total_amount) || 0;
    totalPaid      += Number(r.paid_amount)  || 0;
    totalRemaining += Number(r.remaining)    || 0;
    if (r.status === "open")    openN++;
    else if (r.status === "partial") partialN++;
    else if (r.status === "paid")    paidN++;
  }
  return {
    totalBilled,
    totalPaid,
    totalRemaining,
    collectionPct: totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0,
    counts: { all: rows.length, open: openN, partial: partialN, paid: paidN },
  };
}

export function monthlyBreakdown(rows: InvoiceRow[]): MonthlyAggregate[] {
  const buckets = new Map<number, { count: number; billed: number; paid: number }>();
  for (const r of rows) {
    const m = Number(r.invoice_date.slice(5, 7));
    if (!buckets.has(m)) buckets.set(m, { count: 0, billed: 0, paid: 0 });
    const b = buckets.get(m)!;
    b.count++;
    b.billed += Number(r.total_amount) || 0;
    b.paid   += Number(r.paid_amount)  || 0;
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([month, b]) => {
      const remaining = Math.max(0, b.billed - b.paid);
      const pct = b.billed > 0 ? (b.paid / b.billed) * 100 : 0;
      return { month, count: b.count, billed: b.billed, paid: b.paid, remaining, pct };
    });
}

// ────────────────────────────────────────────────────────────────────────────
// Overdue helper — нэхэмжлэлийн due_date өнөөдрөөс өмнө + статус paid биш
// ────────────────────────────────────────────────────────────────────────────

export function isOverdue(r: InvoiceRow, today: string): boolean {
  if (r.status === "paid" || r.status === "void") return false;
  if (!r.due_date) return false;
  return r.due_date < today;
}

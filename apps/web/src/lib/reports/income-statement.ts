/**
 * Income Statement (Орлогын дэлгэрэнгүй тайлан) — Сангийн Сайдын 2017 оны 361
 * дүгээр тушаалын 3 дугаар хавсралтын маяг.
 *
 * Port of legacy/app.py:income_statement(). 11-row hierarchy with detail
 * accounts under sections 1, 2, 5. Two-column comparison: prior period vs
 * current.
 *
 * Source RPC: `fn_income_statement(company, start, end)` returns income +
 * expense accounts with TYPE-AWARE signed amount (income = Cr-positive,
 * expense = Dr-positive). Account codes follow the Mongolian standard:
 *   6xxx → Revenue / Борлуулалтын орлого
 *   7xxx → COGS / Борлуулалтын өртөг
 *   8xxx → G&A / Ерөнхий удирдлагын зардал
 *   9xxx → Tax / Орлогын татварын зардал
 */

export type IsAccountRow = {
  account_id: string;
  code: string;
  name: string;
  type: "income" | "expense";
  amount: number;
};

/** Render kinds in the structured table */
export type IsRowKind =
  | "section"   // bold numbered row (1, 2, 3, ...)
  | "detail"    // sub-row showing one account
  | "subtotal"  // gross profit, EBIT, etc.
  | "total";    // final net profit (тайлант үеийн цэвэр ашиг)

export type IsRow = {
  kind: IsRowKind;
  num: string;            // "1", "2", "3", ...
  label: string;
  current: number;
  previous: number;
  indent?: 0 | 1 | 2;
  code?: string;          // account code for detail rows
};

export type IsData = {
  rows: IsRow[];
  totals: {
    revenue: { current: number; previous: number };
    cogs: { current: number; previous: number };
    grossProfit: { current: number; previous: number };
    gaExpense: { current: number; previous: number };
    ebit: { current: number; previous: number };
    taxExpense: { current: number; previous: number };
    netProfit: { current: number; previous: number };
  };
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers — sum by code prefix
// ────────────────────────────────────────────────────────────────────────────

const sumByPrefix = (rows: IsAccountRow[], prefix: string): number =>
  rows.reduce((s, r) => s + (r.code.startsWith(prefix) ? Number(r.amount) || 0 : 0), 0);

const detailsForPrefix = (rows: IsAccountRow[], prefix: string): IsAccountRow[] =>
  rows
    .filter((r) => r.code.startsWith(prefix) && Math.abs(Number(r.amount) || 0) > 0.5)
    .sort((a, b) => a.code.localeCompare(b.code));

/**
 * Index detail accounts by code for cross-period lookup. Current period drives
 * the row list; previous period values are looked up by code (returns 0 if the
 * account had no activity in the prior period).
 */
function buildCodeIndex(rows: IsAccountRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.code, Number(r.amount) || 0);
  return m;
}

// ────────────────────────────────────────────────────────────────────────────
// Public: build structured IS for two periods
// ────────────────────────────────────────────────────────────────────────────

export function buildIncomeStatement(
  current: IsAccountRow[],
  previous: IsAccountRow[],
): IsData {
  const prvIdx = buildCodeIndex(previous);

  // Aggregates by code prefix — both periods
  const revenue       = { current: sumByPrefix(current, "6"), previous: sumByPrefix(previous, "6") };
  const cogs          = { current: sumByPrefix(current, "7"), previous: sumByPrefix(previous, "7") };
  const grossProfit   = { current: revenue.current - cogs.current, previous: revenue.previous - cogs.previous };
  const gaExpense     = { current: sumByPrefix(current, "8"), previous: sumByPrefix(previous, "8") };
  // Other income / finance income / finance expense — not currently mapped in
  // the chart of accounts; placeholder zeros mirror legacy app.py:1318.
  const otherIncome   = { current: 0, previous: 0 };
  const finIncome     = { current: 0, previous: 0 };
  const finExpense    = { current: 0, previous: 0 };
  const ebit = {
    current:  grossProfit.current  - gaExpense.current  + finIncome.current  - finExpense.current  + otherIncome.current,
    previous: grossProfit.previous - gaExpense.previous + finIncome.previous - finExpense.previous + otherIncome.previous,
  };
  const taxExpense    = { current: sumByPrefix(current, "9"), previous: sumByPrefix(previous, "9") };
  const netProfit     = { current: ebit.current - taxExpense.current, previous: ebit.previous - taxExpense.previous };

  // Build the hierarchical row list
  const rows: IsRow[] = [];

  const pushSection = (num: string, label: string, total: { current: number; previous: number }) =>
    rows.push({ kind: "section", num, label, current: total.current, previous: total.previous });

  const pushDetail = (r: IsAccountRow) =>
    rows.push({
      kind: "detail",
      num: r.code,
      code: r.code,
      label: r.name,
      current: Number(r.amount) || 0,
      previous: prvIdx.get(r.code) ?? 0,
      indent: 1,
    });

  // 1 Борлуулалтын орлого + detail (6xxx)
  pushSection("1", "Борлуулалтын орлого", revenue);
  for (const d of detailsForPrefix(current, "6")) pushDetail(d);

  // 2 Борлуулалтын өртөг + detail (7xxx)
  pushSection("2", "Борлуулалтын өртөг", cogs);
  for (const d of detailsForPrefix(current, "7")) pushDetail(d);

  // 3 Нийт ашиг (subtotal)
  rows.push({ kind: "subtotal", num: "3", label: "Нийт ашиг (алдагдал)", current: grossProfit.current, previous: grossProfit.previous });

  // 4 Борлуулалтын зардал — legacy дотор үргэлж 0; нэр өгсөн placeholder
  rows.push({ kind: "section", num: "4", label: "Борлуулалтын зардал", current: 0, previous: 0, indent: 1 });

  // 5 Ерөнхий удирдлагын зардал + detail (8xxx)
  pushSection("5", "Ерөнхий удирдлагын зардал", gaExpense);
  for (const d of detailsForPrefix(current, "8")) pushDetail(d);

  // 6/7/8 placeholder rows
  rows.push({ kind: "section", num: "6", label: "Санхүүгийн орлого", current: finIncome.current, previous: finIncome.previous, indent: 1 });
  rows.push({ kind: "section", num: "7", label: "Санхүүгийн зардал", current: finExpense.current, previous: finExpense.previous, indent: 1 });
  rows.push({ kind: "section", num: "8", label: "Бусад орлого / (зардал)", current: otherIncome.current, previous: otherIncome.previous, indent: 1 });

  // 9 EBIT (subtotal)
  rows.push({ kind: "subtotal", num: "9", label: "ТАТВАРЫН ӨМНӨХ АШИГ (АЛДАГДАЛ)", current: ebit.current, previous: ebit.previous });

  // 10 Tax expense
  rows.push({ kind: "section", num: "10", label: "Орлогын татварын зардал", current: taxExpense.current, previous: taxExpense.previous, indent: 1 });

  // 11 Net profit (footer-styled total)
  rows.push({ kind: "total", num: "11", label: "ТАЙЛАНТ ҮЕИЙН ЦЭВЭР АШИГ (АЛДАГДАЛ)", current: netProfit.current, previous: netProfit.previous });

  return {
    rows,
    totals: { revenue, cogs, grossProfit, gaExpense, ebit, taxExpense, netProfit },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Period parsing — supports date_from/date_to + quick range buttons
// ────────────────────────────────────────────────────────────────────────────

export type IsPeriod = {
  /** Current period start (ISO) */
  from: string;
  /** Current period end (ISO) */
  to: string;
  /** Prior period start (ISO) — for the comparison column */
  prevFrom: string;
  /** Prior period end (ISO) */
  prevTo: string;
  /** Display label e.g. "2026 он", "2026 оны 5-р сар", "2024-01-01 — 2024-05-30" */
  label: string;
};

const isoDate = (s: unknown): string | null =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;

function lastDayOfMonth(y: number, m: number): string {
  // m is 1-12; new Date(year, m, 0) returns last day of month m
  const d = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Parse the IS period from URL search params. Honors:
 *   - ?date_from=YYYY-MM-DD & ?date_to=YYYY-MM-DD  (explicit range)
 *   - ?year=YYYY                                    (full calendar year)
 *   - ?year=YYYY&month=M                            (single calendar month)
 *   - (none)                                        (year-to-date of current year)
 *
 * Comparison column is the SAME PERIOD of the prior year.
 */
export function parseIsPeriod(sp: {
  date_from?: string;
  date_to?: string;
  year?: string;
  month?: string;
}): IsPeriod {
  const now = new Date();
  const explicitFrom = isoDate(sp.date_from);
  const explicitTo   = isoDate(sp.date_to);

  if (explicitFrom && explicitTo) {
    const [fy, fm, fd] = explicitFrom.split("-").map(Number);
    const [ty, tm, td] = explicitTo.split("-").map(Number);
    return {
      from: explicitFrom,
      to: explicitTo,
      prevFrom: `${fy - 1}-${String(fm).padStart(2, "0")}-${String(fd).padStart(2, "0")}`,
      prevTo:   `${ty - 1}-${String(tm).padStart(2, "0")}-${String(td).padStart(2, "0")}`,
      label: `${explicitFrom} — ${explicitTo}`,
    };
  }

  const year  = Number(sp.year)  > 1900 && Number(sp.year)  < 3000 ? Number(sp.year)  : now.getFullYear();
  const month = Number(sp.month) >= 1   && Number(sp.month) <= 12   ? Number(sp.month) : undefined;

  if (month) {
    return {
      from: `${year}-${String(month).padStart(2, "0")}-01`,
      to:   lastDayOfMonth(year, month),
      prevFrom: `${year - 1}-${String(month).padStart(2, "0")}-01`,
      prevTo:   lastDayOfMonth(year - 1, month),
      label: `${year} оны ${month}-р сар`,
    };
  }

  // Full year (default if no explicit range/month)
  // For the current year, end is "today" not Dec 31 — matches legacy "өнөөдөр" behavior.
  const isCurrentYear = year === now.getFullYear();
  const endIso = isCurrentYear ? now.toISOString().slice(0, 10) : `${year}-12-31`;
  return {
    from: `${year}-01-01`,
    to:   endIso,
    prevFrom: `${year - 1}-01-01`,
    prevTo:   `${year - 1}-12-31`,
    label: `${year} он${isCurrentYear ? " (өнөөдрийн байдлаар)" : ""}`,
  };
}

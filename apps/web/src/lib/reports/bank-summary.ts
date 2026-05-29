/**
 * Bank-summary shared logic — used by both the page (/cash/bank-summary)
 * and the Xlsx export route so they can never drift from each other.
 *
 * - Reads `fn_bank_monthly_flow(company, year)` rows (12 per bank).
 * - Pivots them into per-bank sections with running balances.
 * - Builds an optional consolidated section across all banks.
 */

export type BankFlowRow = {
  bank_id: string;
  bank_name: string;
  gl_account_id: string | null;
  gl_code: string | null;
  gl_name: string | null;
  opening_balance: number;
  month: number;
  income: number;
  expense: number;
};

export type MonthCell = {
  m: number;
  open: number;
  inc: number;
  exp: number;
  net: number;
  close: number;
};

export type BankSection = {
  bank_id: string;
  bank_name: string;
  gl_account_id: string | null;
  gl_code: string | null;
  gl_name: string | null;
  opening: number;
  monthly: MonthCell[];
  totals: { inc: number; exp: number; net: number };
  closing: number;
};

export type ConsolidatedSection = {
  opening: number;
  monthly: MonthCell[];
  totals: { inc: number; exp: number; net: number };
  closing: number;
};

const num = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function buildBankSections(rows: BankFlowRow[]): {
  sections: BankSection[];
  consolidated: ConsolidatedSection | null;
} {
  // Group raw rows by bank
  const byBank = new Map<string, BankFlowRow[]>();
  for (const r of rows) {
    if (!byBank.has(r.bank_id)) byBank.set(r.bank_id, []);
    byBank.get(r.bank_id)!.push(r);
  }

  // Per-bank section + running balance
  const sections: BankSection[] = [];
  for (const bankRows of byBank.values()) {
    if (bankRows.length === 0) continue;
    const sorted = [...bankRows].sort((a, b) => a.month - b.month);
    const head = sorted[0];
    const opening = num(head.opening_balance);
    let bal = opening;
    const monthly: MonthCell[] = sorted.map((r) => {
      const open = bal;
      const inc = num(r.income);
      const exp = num(r.expense);
      const net = inc - exp;
      const close = open + net;
      bal = close;
      return { m: r.month, open, inc, exp, net, close };
    });
    const inc = monthly.reduce((s, m) => s + m.inc, 0);
    const exp = monthly.reduce((s, m) => s + m.exp, 0);
    sections.push({
      bank_id: head.bank_id,
      bank_name: head.bank_name,
      gl_account_id: head.gl_account_id,
      gl_code: head.gl_code,
      gl_name: head.gl_name,
      opening,
      monthly,
      totals: { inc, exp, net: inc - exp },
      closing: monthly[monthly.length - 1]?.close ?? opening,
    });
  }

  // Stable order by GL code (NULL banks at the end)
  sections.sort((a, b) => {
    const ac = a.gl_code ?? "￿";
    const bc = b.gl_code ?? "￿";
    return ac.localeCompare(bc);
  });

  if (sections.length === 0) return { sections, consolidated: null };

  // Consolidated section: sum of all banks per month, running balance from
  // total opening across all banks
  const consolidatedOpen = sections.reduce((s, x) => s + x.opening, 0);
  let cbal = consolidatedOpen;
  const cMonthly: MonthCell[] = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const inc = sections.reduce((s, x) => s + (x.monthly[i]?.inc ?? 0), 0);
    const exp = sections.reduce((s, x) => s + (x.monthly[i]?.exp ?? 0), 0);
    const net = inc - exp;
    const open = cbal;
    const close = open + net;
    cbal = close;
    return { m, open, inc, exp, net, close };
  });
  const cInc = cMonthly.reduce((s, m) => s + m.inc, 0);
  const cExp = cMonthly.reduce((s, m) => s + m.exp, 0);

  return {
    sections,
    consolidated: {
      opening: consolidatedOpen,
      monthly: cMonthly,
      totals: { inc: cInc, exp: cExp, net: cInc - cExp },
      closing: cMonthly[11]?.close ?? consolidatedOpen,
    },
  };
}

/**
 * Safely parse a year query-param. Falls back to current year for any of:
 *  - undefined / empty / non-numeric
 *  - out-of-range (≤1900 or ≥3000)
 */
export function parseYear(input: string | undefined): number {
  const n = parseInt(input ?? "", 10);
  return Number.isFinite(n) && n > 1900 && n < 3000 ? n : new Date().getFullYear();
}

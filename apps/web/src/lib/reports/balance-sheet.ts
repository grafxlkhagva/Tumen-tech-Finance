/**
 * Balance Sheet (Санхүү байдлын тайлан) — Сангийн Сайдын 2017 оны 361 дугаар
 * тушаалын 2 дугаар хавсралтын маягтын дагуу бүтэцлэгдсэн.
 *
 * Port of legacy/app.py:compute_bs() — exact account-code mapping preserved
 * so the new system reproduces the legacy Excel-baseline.
 */

export type RawBalance = {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  balance: number;
};

export type BSRow = {
  code: string;          // "1.1.1"
  label: string;
  current: number;
  previous: number;
  bold?: boolean;
  indent?: 0 | 1 | 2;
};

export type BSData = {
  assets: BSRow[];
  liabilities: BSRow[];
  equity: BSRow[];
  totals: {
    asset_total: { current: number; previous: number };
    liability_total: { current: number; previous: number };
    equity_total: { current: number; previous: number };
    liab_equity_total: { current: number; previous: number };
  };
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers — operate on a Map<code, signed_balance>
// ────────────────────────────────────────────────────────────────────────────
type Bal = Map<string, number>;

const ab = (m: Bal, code: string): number => m.get(code) ?? 0;
const gb = (m: Bal, codes: string[]): number => codes.reduce((s, c) => s + ab(m, c), 0);
const stb = (m: Bal, prefix: string): number => {
  let s = 0;
  for (const [code, bal] of m) if (code.startsWith(prefix)) s += bal;
  return s;
};

export function indexBalances(rows: RawBalance[]): Bal {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.code, Number(r.balance ?? 0));
  return m;
}

// ────────────────────────────────────────────────────────────────────────────
// Build the structured BS for one date (returns category totals)
// ────────────────────────────────────────────────────────────────────────────
type BSCategories = {
  // assets
  cash: number;          // 1.1.1
  recv_trade: number;    // 1.1.2
  recv_tax: number;      // 1.1.3
  recv_other: number;    // 1.1.4
  prepaid: number;       // 1.1.7
  inventory: number;     // 1.1.6
  total_current: number;
  fixed_assets: number;  // 1.2.1
  intangible: number;    // 1.2.2
  total_noncurrent: number;
  total_assets: number;
  // liabilities
  ap_trade: number;      // 2.1.1.1
  payroll_pay: number;   // 2.1.1.2
  tax_pay: number;       // 2.1.1.3
  ndsh_pay: number;      // 2.1.1.4
  other_short: number;   // 2.1.1.10
  total_short: number;
  lt_loans: number;      // 2.1.2.1
  lt_other: number;      // 2.1.2.4
  total_long: number;
  total_liab: number;
  // equity
  capital: number;       // 2.3.2
  add_capital: number;   // 2.3.5
  retained: number;      // 2.3.9
  current_profit: number;// 2.3.10 (income − expense from P&L accounts)
  total_equity: number;
  total_liab_equity: number;
};

function computeBs(m: Bal): BSCategories {
  // Assets — already type-aware positive
  const cash       = gb(m, ["1110", "1101", "1102", "1103"]);
  const recv_trade = ab(m, "1210") + ab(m, "1211");
  const recv_tax   = stb(m, "135");
  const recv_other = ab(m, "1250") + ab(m, "1240");
  const prepaid    = ab(m, "1260");
  const inventory  = gb(m, ["1310", "1320", "1330"]);
  const total_current = cash + recv_trade + recv_tax + recv_other + prepaid + inventory;

  const fixed_assets = stb(m, "200") + stb(m, "201") + stb(m, "16");
  const intangible   = ab(m, "1710") + ab(m, "1510");
  const total_noncurrent = fixed_assets + intangible;
  const total_assets = total_current + total_noncurrent;

  // Liabilities — RPC already returns Cr-positive for liabilities
  const ap_trade    = ab(m, "3310");
  const payroll_pay = ab(m, "3311") + ab(m, "3313");
  const tax_pay     = ab(m, "3100") + ab(m, "3141") + ab(m, "3151") + ab(m, "3152");
  const ndsh_pay    = ab(m, "3321") + ab(m, "3322");
  const other_short = ab(m, "3210") + ab(m, "3330") + ab(m, "3333") + ab(m, "3332") + ab(m, "3410");
  const total_short = ap_trade + payroll_pay + tax_pay + ndsh_pay + other_short;

  const lt_loans = ab(m, "4100") + ab(m, "4110");
  const lt_other = ab(m, "4210") + ab(m, "4211") + ab(m, "4310") + ab(m, "4320");
  const total_long = lt_loans + lt_other;
  const total_liab = total_short + total_long;

  // Equity — Cr-positive for equity & income
  const capital     = ab(m, "5110");
  const add_capital = 0;
  const retained    = ab(m, "5200") + ab(m, "5210");
  // current period P&L: income − expense (both positive in natural direction)
  const current_profit = stb(m, "6") - (stb(m, "7") + stb(m, "8") + stb(m, "9"));
  const total_equity = capital + add_capital + retained + current_profit;
  const total_liab_equity = total_liab + total_equity;

  return {
    cash, recv_trade, recv_tax, recv_other, prepaid, inventory, total_current,
    fixed_assets, intangible, total_noncurrent, total_assets,
    ap_trade, payroll_pay, tax_pay, ndsh_pay, other_short, total_short,
    lt_loans, lt_other, total_long, total_liab,
    capital, add_capital, retained, current_profit,
    total_equity, total_liab_equity,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Public: build full structured BS for two dates
// ────────────────────────────────────────────────────────────────────────────
export function buildBalanceSheet(
  current: RawBalance[],
  previous: RawBalance[],
): BSData {
  const cur = computeBs(indexBalances(current));
  const prv = computeBs(indexBalances(previous));

  const dual = (a: keyof BSCategories): { current: number; previous: number } => ({
    current: cur[a],
    previous: prv[a],
  });

  const r = (code: string, label: string, key: keyof BSCategories, indent: 0 | 1 = 1, bold = false): BSRow => ({
    code, label, ...dual(key), indent, bold,
  });

  const header = (code: string, label: string): BSRow => ({
    code, label, current: 0, previous: 0, bold: true, indent: 0,
  });

  const assets: BSRow[] = [
    header("1.1", "Эргэлтийн хөрөнгө"),
    r("1.1.1", "Мөнгө, түүнтэй адилтгах хөрөнгө", "cash"),
    r("1.1.2", "Дансны авлага",            "recv_trade"),
    r("1.1.3", "Татвар, НДШ авлага",       "recv_tax"),
    r("1.1.4", "Бусад авлага",             "recv_other"),
    r("1.1.7", "Урьдчилж төлсөн зардал/тооцоо", "prepaid"),
    r("1.1.6", "Бараа материал",           "inventory"),
    { code: "1.1.11", label: "Эргэлтийн хөрөнгийн дүн", ...dual("total_current"), bold: true },
    header("1.2", "Эргэлтийн бус хөрөнгө"),
    r("1.2.1", "Үндсэн хөрөнгө (цэвэр)", "fixed_assets"),
    r("1.2.2", "Биет бус хөрөнгө",       "intangible"),
    { code: "1.2.10", label: "Эргэлтийн бус хөрөнгийн дүн", ...dual("total_noncurrent"), bold: true },
  ];

  const liabilities: BSRow[] = [
    header("2.1.1", "Богино хугацаат өр төлбөр"),
    r("2.1.1.1", "Дансны өглөг",          "ap_trade"),
    r("2.1.1.2", "Цалингийн өглөг",       "payroll_pay"),
    r("2.1.1.3", "Татварын өр",           "tax_pay"),
    r("2.1.1.4", "НДШ өглөг",              "ndsh_pay"),
    r("2.1.1.10","Бусад богино хугацаат өр", "other_short"),
    { code: "2.1.1.13", label: "Богино хугацаат өр төлбөрийн дүн", ...dual("total_short"), bold: true },
    header("2.1.2", "Урт хугацаат өр төлбөр"),
    r("2.1.2.1", "Урт хугацаат зээл", "lt_loans"),
    r("2.1.2.4", "Бусад урт хугацаат өр", "lt_other"),
    { code: "2.1.2.6", label: "Урт хугацаат өр төлбөрийн дүн", ...dual("total_long"), bold: true },
  ];

  const equity: BSRow[] = [
    header("2.3", "Эздийн өмч"),
    r("2.3.2", "Хувийн өмч (дүрмийн сан)", "capital"),
    r("2.3.5", "Нэмж төлөгдсөн капитал",   "add_capital"),
    r("2.3.9", "Хуримтлагдсан ашиг (алдагдал)", "retained"),
    r("2.3.10","Тайлант үеийн цэвэр ашиг (алдагдал)", "current_profit"),
    { code: "2.3.12", label: "Эздийн өмчийн дүн", ...dual("total_equity"), bold: true },
  ];

  return {
    assets,
    liabilities,
    equity,
    totals: {
      asset_total:        dual("total_assets"),
      liability_total:    dual("total_liab"),
      equity_total:       dual("total_equity"),
      liab_equity_total:  dual("total_liab_equity"),
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Date helpers
// ────────────────────────────────────────────────────────────────────────────

/** Default previous period: the year-end of the year BEFORE as_of. */
export function defaultPrevDate(asOf: string): string {
  const [y] = asOf.split("-").map(Number);
  return `${y - 1}-12-31`;
}

/** Safely parse an ISO date param. Falls back to today. */
export function parseAsOf(input: string | undefined): string {
  if (!input) return new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return new Date().toISOString().slice(0, 10);
  return input;
}

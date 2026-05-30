/**
 * Cashflow Internal Report — shared logic for page + Excel export.
 *
 * Port of legacy/app.py:cashflow_report() (mode=internal). Categories follow
 * the accountant's hierarchical numbering (1.1.1, 1.2.3, 2.1.10, etc.) which
 * is stored on cash_transactions.category as free-form text.
 *
 * The structure list below preserves the exact section / row order from
 * legacy/templates/cashflow_report.html so the report is pixel-comparable.
 */

export type CashflowMonthlyRow = {
  direction: "income" | "expense";
  category: string;
  month: number;       // 1..12
  txn_count: number;
  amount: number;
};

/** Render row kinds in the columnar table */
export type CFRowKind = "section" | "subhdr" | "data" | "subtotal" | "total" | "opening" | "closing";

export type CFRow = {
  kind: CFRowKind;
  code: string;        // "1.1.1" or "" for headers
  label: string;
  vals: number[];      // 12 months
  total: number;
  color?: string;      // optional Tailwind / hex color hint
};

export type CFInternal = {
  months: number[];               // [1..12]
  rows: CFRow[];                  // ordered for table render
  openingByMonth: number[];       // 12 values
  closingByMonth: number[];       // 12 values
  openCash: number;
  netTotalByMonth: number[];      // 12 values
  grandClosing: number;
};

// ────────────────────────────────────────────────────────────────────────────
// Section / row spec — mirrors legacy template line-for-line
// ────────────────────────────────────────────────────────────────────────────
type Spec =
  | { kind: "section"; label: string; color: string }
  | { kind: "subhdr"; label: string }
  | { kind: "data"; code: string; label: string; dir: "income" | "expense" }
  | { kind: "subtotal"; code: string; label: string; sumOf: string[]; color?: string }
  | { kind: "total"; code: string; label: string; computeKey: string; color: string };

const SPEC: Spec[] = [
  // 1. Operating
  { kind: "section", label: "ҮЙЛАЖИЛЛАГААНЫ МӨНГӨН УРСГАЛ", color: "#1565C0" },
  { kind: "subhdr", label: "Мөнгөн орлого / Cash Inflow" },
  { kind: "data", code: "1.1.1", label: "Үйлчилгээний орлого", dir: "income" },
  { kind: "data", code: "1.1.2", label: "Авлагын орлого", dir: "income" },
  { kind: "data", code: "1.1.3", label: "Хүүгийн орлого", dir: "income" },
  { kind: "data", code: "1.1.4", label: "Тээврийн буцаалт", dir: "income" },
  { kind: "total", code: "", label: "Нийт мөнгөн орлого", computeKey: "total_inc", color: "#1976D2" },

  { kind: "subhdr", label: "Мөнгөн зарлага — Гүйцэтгэгчдийн төлбөр" },
  { kind: "data", code: "1.2.1", label: "Дотоод тээврийн төлбөр", dir: "expense" },
  { kind: "data", code: "1.2.2", label: "Өмнөх сарын тээврийн үлдэгдэл", dir: "expense" },
  { kind: "data", code: "1.2.3", label: "Бусад (GPS, Каск, Хантаас)", dir: "expense" },
  { kind: "subtotal", code: "1.2", label: "Гүйцэтгэгчдийн нийт төлбөр", sumOf: ["1.2.1", "1.2.2", "1.2.3"], color: "#37474F" },

  { kind: "subhdr", label: "Бусад үйл ажиллагааны зарлага" },
  { kind: "data", code: "2.1.1", label: "Цалингийн зардал", dir: "expense" },
  { kind: "data", code: "2.1.2", label: "Харилцаа холбооны зардал", dir: "expense" },
  { kind: "data", code: "2.1.3", label: "Албан томилолт", dir: "expense" },
  { kind: "data", code: "2.1.4", label: "Бичиг хэрэгсэл", dir: "expense" },
  { kind: "data", code: "2.1.5", label: "Сургалтын зардал", dir: "expense" },
  { kind: "data", code: "2.1.6", label: "Хангамжийн материал", dir: "expense" },
  { kind: "data", code: "2.1.7", label: "Реклам & Маркетинг", dir: "expense" },
  { kind: "data", code: "2.1.8", label: "Маркетингийн судалгаа", dir: "expense" },
  { kind: "data", code: "2.1.9", label: "HR холбогдох зардал", dir: "expense" },
  { kind: "data", code: "2.1.10", label: "Түрээсийн зардал", dir: "expense" },
  { kind: "data", code: "2.1.11", label: "Коммунал зардал", dir: "expense" },
  { kind: "data", code: "2.1.12", label: "Засвар үйлчилгээ", dir: "expense" },
  { kind: "data", code: "2.1.13", label: "Даатгалын зардал", dir: "expense" },
  { kind: "data", code: "2.1.14", label: "Банкны шимтгэл", dir: "expense" },
  { kind: "data", code: "2.1.15", label: "Бусад зардал", dir: "expense" },
  { kind: "subtotal", code: "2.1", label: "Бусад үйл ажиллагааны нийт", sumOf: [
    "2.1.1","2.1.2","2.1.3","2.1.4","2.1.5","2.1.6","2.1.7","2.1.8",
    "2.1.9","2.1.10","2.1.11","2.1.12","2.1.13","2.1.14","2.1.15",
  ], color: "#37474F" },

  { kind: "subhdr", label: "Татвар, НДШ" },
  { kind: "data", code: "2.2.1", label: "ААН орлогын татвар", dir: "expense" },
  { kind: "data", code: "2.2.2", label: "ХХОАТ", dir: "expense" },
  { kind: "data", code: "2.2.3", label: "НӨАТ", dir: "expense" },
  { kind: "data", code: "2.2.4", label: "ЭМНДШ", dir: "expense" },
  { kind: "subtotal", code: "2.2", label: "Татвар, НДШ нийт", sumOf: ["2.2.1","2.2.2","2.2.3","2.2.4"], color: "#37474F" },

  { kind: "total", code: "", label: "Нийт мөнгөн зарлага", computeKey: "total_exp", color: "#B71C1C" },
  { kind: "total", code: "", label: "ҮЙЛАЖИЛЛАГААНЫ ЦЭВЭР УРСГАЛ", computeKey: "op_net", color: "#1B5E20" },

  // 2. Investing
  { kind: "section", label: "ХӨРӨНГӨ ОРУУЛАЛТЫН МӨНГӨН УРСГАЛ", color: "#4A148C" },
  { kind: "total", code: "3.1", label: "Нийт хөрөнгө оруулалтын орлого", computeKey: "inv_inc", color: "#4A148C" },
  { kind: "subhdr", label: "Хөрөнгө оруулалтын зарлага" },
  { kind: "data", code: "3.2.1", label: "Тавилга, тоног төхөөрөмж (FF&E)", dir: "expense" },
  { kind: "data", code: "3.2.2", label: "Эд хогшил", dir: "expense" },
  { kind: "data", code: "3.2.3", label: "Программ хангамж", dir: "expense" },
  { kind: "data", code: "3.2.4", label: "Бусад хөрөнгө", dir: "expense" },
  { kind: "subtotal", code: "3.2", label: "Нийт хөрөнгө оруулалтын зарлага", sumOf: ["3.2.1","3.2.2","3.2.3","3.2.4"], color: "#37474F" },
  { kind: "total", code: "", label: "ХӨРӨНГӨ ОРУУЛАЛТЫН ЦЭВЭР УРСГАЛ", computeKey: "inv_net", color: "#4A148C" },

  // 3. Financing
  { kind: "section", label: "САНХҮҮЖИЛТИЙН МӨНГӨН УРСГАЛ", color: "#006064" },
  { kind: "total", code: "4.1", label: "Нийт санхүүжилтийн орлого", computeKey: "fin_inc", color: "#006064" },
  { kind: "total", code: "4.2", label: "Нийт санхүүжилтийн зарлага", computeKey: "fin_exp", color: "#37474F" },
  { kind: "total", code: "", label: "САНХҮҮЖИЛТИЙН ЦЭВЭР УРСГАЛ", computeKey: "fin_net", color: "#006064" },

  // 5. Related parties
  { kind: "section", label: "ХОЛБООТОЙ БАЙГУУЛАГА / АЖИЛЧДЫН ЗЭЭЛ", color: "#BF360C" },
  { kind: "subhdr", label: "Зээлийн орлого" },
  { kind: "data", code: "5.1.2", label: "Холбоотой байгуулагаас авсан зээл", dir: "income" },
  { kind: "data", code: "5.1.3", label: "Ажилчдаас авсан зээлийн буцаалт", dir: "income" },
  { kind: "subtotal", code: "5.1", label: "Нийт зээлийн орлого", sumOf: ["5.1.2","5.1.3"], color: "#BF360C" },
  { kind: "subhdr", label: "Зээлийн зарлага" },
  { kind: "data", code: "5.2.1", label: "Хоорондын тооцоогоор өгсөн", dir: "expense" },
  { kind: "data", code: "5.2.2", label: "Холбоотой байгуулагад өгсөн зээл", dir: "expense" },
  { kind: "data", code: "5.2.3", label: "Ажилчдад өгсөн зээл", dir: "expense" },
  { kind: "subtotal", code: "5.2", label: "Нийт зээлийн зарлага", sumOf: ["5.2.1","5.2.2","5.2.3"], color: "#37474F" },
  { kind: "total", code: "5", label: "§5 ЦЭВЭР УРСГАЛ", computeKey: "sec5_net", color: "#BF360C" },

  // GRAND
  { kind: "total", code: "", label: "НИЙТ ЦЭВЭР МӨНГӨН УРСГАЛ", computeKey: "net_total", color: "#0d2137" },
];

// ────────────────────────────────────────────────────────────────────────────
// Builder
// ────────────────────────────────────────────────────────────────────────────

const ZERO12 = (): number[] => Array(12).fill(0);
const add12 = (a: number[], b: number[]): number[] => a.map((v, i) => v + (b[i] ?? 0));
const sub12 = (a: number[], b: number[]): number[] => a.map((v, i) => v - (b[i] ?? 0));
const sum12 = (vs: number[]): number => vs.reduce((s, v) => s + v, 0);

export function buildInternalCashflow(
  raw: CashflowMonthlyRow[],
  openCash: number,
): CFInternal {
  // index by (direction, category) → 12-month array
  type Key = string;
  const idx = new Map<Key, number[]>();
  const key = (d: string, c: string): Key => `${d}::${c}`;

  for (const r of raw) {
    const k = key(r.direction, r.category);
    if (!idx.has(k)) idx.set(k, ZERO12());
    const arr = idx.get(k)!;
    const m = Math.max(1, Math.min(12, Number(r.month) || 1));
    arr[m - 1] += Number(r.amount) || 0;
  }

  const get = (dir: "income" | "expense", code: string): number[] =>
    idx.get(key(dir, code)) ?? ZERO12();

  // Pre-compute per-spec values
  const valByCode = new Map<string, number[]>();
  for (const s of SPEC) {
    if (s.kind === "data") valByCode.set(s.code, get(s.dir, s.code));
  }
  for (const s of SPEC) {
    if (s.kind === "subtotal") {
      const vs = s.sumOf.reduce((acc, c) => add12(acc, valByCode.get(c) ?? ZERO12()), ZERO12());
      valByCode.set(s.code, vs);
    }
  }

  // Aggregates referenced by `computeKey`
  const total_inc = ["1.1.1","1.1.2","1.1.3","1.1.4"]
    .reduce((acc, c) => add12(acc, valByCode.get(c) ?? ZERO12()), ZERO12());
  const sub12_arr = valByCode.get("1.2") ?? ZERO12();
  const sub21     = valByCode.get("2.1") ?? ZERO12();
  const sub22     = valByCode.get("2.2") ?? ZERO12();
  const total_exp = add12(add12(sub12_arr, sub21), sub22);
  const op_net    = sub12(total_inc, total_exp);

  const inv_inc   = ZERO12(); // not currently tracked
  const inv_exp   = valByCode.get("3.2") ?? ZERO12();
  const inv_net   = sub12(inv_inc, inv_exp);

  const fin_inc   = ZERO12();
  const fin_exp   = ZERO12();
  const fin_net   = sub12(fin_inc, fin_exp);

  const sub51     = valByCode.get("5.1") ?? ZERO12();
  const sub52     = valByCode.get("5.2") ?? ZERO12();
  const sec5_net  = sub12(sub51, sub52);

  const net_total = add12(add12(add12(op_net, inv_net), fin_net), sec5_net);

  const computes: Record<string, number[]> = {
    total_inc, total_exp, op_net,
    inv_inc, inv_exp, inv_net,
    fin_inc, fin_exp, fin_net,
    sec5_net, net_total,
  };

  // Build the row list in declared order
  const rows: CFRow[] = [];
  for (const s of SPEC) {
    if (s.kind === "section") {
      rows.push({ kind: "section", code: "", label: s.label, vals: ZERO12(), total: 0, color: s.color });
    } else if (s.kind === "subhdr") {
      rows.push({ kind: "subhdr", code: "", label: s.label, vals: ZERO12(), total: 0 });
    } else if (s.kind === "data") {
      const vals = valByCode.get(s.code) ?? ZERO12();
      rows.push({ kind: "data", code: s.code, label: s.label, vals, total: sum12(vals) });
    } else if (s.kind === "subtotal") {
      const vals = valByCode.get(s.code) ?? ZERO12();
      rows.push({ kind: "subtotal", code: s.code, label: s.label, vals, total: sum12(vals), color: s.color });
    } else if (s.kind === "total") {
      const vals = computes[s.computeKey] ?? ZERO12();
      rows.push({ kind: "total", code: s.code, label: s.label, vals, total: sum12(vals), color: s.color });
    }
  }

  // Running balance: opening_by_month / closing_by_month
  const closingByMonth: number[] = [];
  let bal = openCash;
  for (const v of net_total) {
    bal += v;
    closingByMonth.push(bal);
  }
  const openingByMonth = [openCash, ...closingByMonth.slice(0, -1)];

  return {
    months: [1,2,3,4,5,6,7,8,9,10,11,12],
    rows,
    openingByMonth,
    closingByMonth,
    openCash,
    netTotalByMonth: net_total,
    grandClosing: closingByMonth[11] ?? openCash,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Official-mode (Сангийн яамны маяг) — summary totals (year-to-date)
// ────────────────────────────────────────────────────────────────────────────

export type CFOfficial = {
  op_income: number;
  op_expense: number;
  op_net: number;
  inv_income: number;
  inv_expense: number;
  inv_net: number;
  fin_income: number;
  fin_expense: number;
  fin_net: number;
  total_net: number;
  monthly: { month: number; income: number; expense: number }[];
};

export function buildOfficialCashflow(raw: CashflowMonthlyRow[]): CFOfficial {
  let op_income = 0, op_expense = 0;
  let inv_income = 0, inv_expense = 0;
  let fin_income = 0, fin_expense = 0;

  const byMonth = new Map<number, { income: number; expense: number }>();
  for (let m = 1; m <= 12; m++) byMonth.set(m, { income: 0, expense: 0 });

  for (const r of raw) {
    const amt = Number(r.amount) || 0;
    const cat = r.category || "";
    const bucket = byMonth.get(Math.max(1, Math.min(12, Number(r.month) || 1)))!;
    if (r.direction === "income") bucket.income += amt;
    else                          bucket.expense += amt;

    // crude bucketing by category prefix
    if (cat.startsWith("3.")) {
      if (r.direction === "income") inv_income += amt; else inv_expense += amt;
    } else if (cat.startsWith("4.")) {
      if (r.direction === "income") fin_income += amt; else fin_expense += amt;
    } else {
      // operating: 1.x, 2.x, 5.x, Ангилаагүй
      if (r.direction === "income") op_income += amt; else op_expense += amt;
    }
  }

  const op_net  = op_income  - op_expense;
  const inv_net = inv_income - inv_expense;
  const fin_net = fin_income - fin_expense;

  return {
    op_income, op_expense, op_net,
    inv_income, inv_expense, inv_net,
    fin_income, fin_expense, fin_net,
    total_net: op_net + inv_net + fin_net,
    monthly: Array.from(byMonth.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([month, v]) => ({ month, ...v })),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Param parsing
// ────────────────────────────────────────────────────────────────────────────

export function parseYear(input: string | undefined): number {
  const n = parseInt(input ?? "", 10);
  return Number.isFinite(n) && n > 1900 && n < 3000 ? n : new Date().getFullYear();
}

export const MN_MONTH_LABELS = [
  "1-р","2-р","3-р","4-р","5-р","6-р","7-р","8-р","9-р","10-р","11-р","12-р",
];

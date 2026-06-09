/**
 * Банкны хуулга (.XLS / .xlsx) задлан унших — framework-аас хамааралгүй цэвэр TS.
 *
 * `bank_importer/` (Python) модулийн логикийг SheetJS дээр дахин бичсэн:
 *   - багана-индексээр унших (config.py-гийн TDB_COL / GOLOMT_COL / MBANK_COL)
 *   - skip / clean / counterparty задлах туслахууд (parsers.py)
 *
 * Энд DB бичихгүй, cutoff-оор шүүхгүй — зөвхөн файлыг ParsedRow[] болгож хувиргана.
 * Cutoff (давхцал шалгах) логик server action талд хийгдэнэ.
 */
import * as XLSX from "xlsx";

export type BankFormat = "tdb" | "golomt" | "mbank";

export interface BankParserConfig {
  format: BankFormat;
  dataStartRow: number;
  columns: {
    date: number;
    income: number;
    expense: number;
    counterparty?: number;
    description: number;
    accountNo?: number;
    rowNo?: number;
  };
}

/** config.py-гийн багана индексийг яг хуулсан. */
export const BANK_PARSERS: Record<BankFormat, BankParserConfig> = {
  tdb: {
    format: "tdb",
    dataStartRow: 12,
    columns: { date: 0, income: 7, expense: 11, counterparty: 23, description: 28 },
  },
  golomt: {
    format: "golomt",
    dataStartRow: 0,
    columns: { date: 1, description: 2, counterparty: 3, accountNo: 4, income: 6, expense: 7 },
  },
  mbank: {
    format: "mbank",
    dataStartRow: 5,
    columns: { rowNo: 0, date: 1, description: 3, accountNo: 6, counterparty: 7, income: 8, expense: 9 },
  },
};

export interface ParsedRow {
  sourceRowNum: number;
  txnDate: string; // 'YYYY-MM-DD'
  txnTimestamp: string | null; // ISO datetime if known
  direction: "income" | "expense";
  amount: number; // > 0
  description: string | null;
  partnerName: string | null;
  partnerAcc: string | null;
  rawData: Record<string, unknown>;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: string[];
}

// ── config.py-гийн тогтмолууд ────────────────────────────────────────────
const SKIP_KEYWORDS = ["данс хооронд арилжаа", "доод үлдэгдэл"];

const GENERIC_COUNTERPARTIES = new Set([
  "БАГА ДҮНТЭЙ ГҮЙЛГЭЭНИЙ ХООРОНДЫН ТООЦОО",
  "БАНК ХООР КЛИРИНГ ТООЦОО/MNT",
  "БАНК ХООР КЛИРИНГ ТООЦОО",
  "КАРТЫН ГҮЙЛГЭЭНИЙ ӨГЛӨГИЙН ТҮР ДАНС-ҮЦГТ",
]);

const TDB_TT_ACCOUNT = "411096635";

// ── Туслах функцүүд (parsers.py-аас порт) ────────────────────────────────

function shouldSkip(description: string): boolean {
  const d = description.toLowerCase();
  return SKIP_KEYWORDS.some((kw) => d.includes(kw));
}

/** 'EB-' угтвар + данс-хоорондын тэмдэглэгээ хасах. */
function cleanDescription(desc: string, accountNo = ""): string {
  let s = String(desc).trim();
  s = s.replace(/^[EЕ][BВ]\s*[-–]\s*/i, "").trim();
  if (accountNo) {
    const esc = accountNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(new RegExp(`\\s*:\\s*\\d+-\\(${esc}[^)]*\\)->[\\s\\S]*$`), "").trim();
  }
  s = s.replace(/\s*:\s*\d+-\([^)]*\)->\s*\d+-[^:]*$/, "").trim();
  return s;
}

/** Харилцагч ерөнхий нэр байвал тайлбараас бодит нэр олох. */
function extractCounterparty(rawDesc: string, ctpy: string): string {
  if (!GENERIC_COUNTERPARTIES.has(ctpy.trim().toUpperCase())) return ctpy;

  // (дансны_дугаар-Компанийн нэр) хэлбэр
  for (const m of rawDesc.matchAll(/\((\d+)-([^)]+)\)/g)) {
    const nm = m[2].trim();
    if (!nm.toUpperCase().includes("ТҮМЭН ТЭЭХ") && nm.length > 3) return nm;
  }

  // Монгол үсгийн компанийн нэр (ХХК / ХК / ТББ ...)
  const m = rawDesc.match(
    /([А-ЯЁҮӨA-Z][А-ЯЁҮӨA-Z\s\-]+?(?:ХХК|ХК|ТББ|ХНН|ТҮЦ|ОНД))(?:[^А-ЯЁҮӨA-Z]|$)/,
  );
  if (m) {
    const nm = m[1].replace(/^[\s-]+|[\s-]+$/g, "");
    if (!nm.toUpperCase().includes("ТҮМЭН ТЭЭХ") && nm.length > 3) return nm;
  }

  return ctpy;
}

// ── Огноо хувиргалт ──────────────────────────────────────────────────────

/** Excel serial (1900 date-system) → JS Date (UTC). */
function excelSerialToDate(serial: number): Date {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86400000));
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function toIso(d: Date): string {
  return d.toISOString();
}

/** Серийн утга бүтэн өдөр эсэхийг шалгах (фракц байвал цаг агуулна). */
function hasTimePart(serial: number): boolean {
  return Math.abs(serial - Math.round(serial)) > 1e-6 && serial % 1 !== 0;
}

// ── Гол функц ─────────────────────────────────────────────────────────────

function toNumber(cell: unknown): number {
  if (cell === null || cell === undefined || cell === "") return 0;
  if (typeof cell === "number") return cell;
  const s = String(cell).replace(/,/g, "").trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function toStr(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  return String(cell).trim();
}

/**
 * Workbook буфферийг ParsedRow[] болгож задлана.
 * `sheet_to_json(header:1)` — багана индекс хадгалагдсан array-of-arrays.
 */
export function parseWorkbook(buf: ArrayBuffer, cfg: BankParserConfig): ParseResult {
  const errors: string[] = [];
  let rows: unknown[][];
  try {
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    });
  } catch (e) {
    return { rows: [], errors: [`Файл уншиж чадсангүй: ${(e as Error).message}`] };
  }

  const col = cfg.columns;
  const out: ParsedRow[] = [];

  for (let i = cfg.dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const dateCell = row[col.date];

    // ── Огноо задлах (формат бүрээр) ───────────────────────────────
    let txnDate: string;
    let txnTimestamp: string | null;

    if (cfg.format === "tdb") {
      // Огноо мөрүүд л float (Excel serial ≥ 40000) байна
      if (typeof dateCell !== "number" || dateCell < 40000) continue;
      const d = excelSerialToDate(dateCell);
      if (Number.isNaN(d.getTime())) continue;
      txnDate = toDateStr(d);
      txnTimestamp = hasTimePart(dateCell) ? toIso(d) : null;
    } else if (cfg.format === "mbank") {
      // Data мөрүүд л numeric row_no-той байна
      if (typeof row[col.rowNo!] !== "number") continue;
      if (dateCell === null || dateCell === undefined || dateCell === "") continue;
      const d = new Date(toStr(dateCell).replace(" ", "T"));
      if (Number.isNaN(d.getTime())) continue;
      txnDate = toDateStr(d);
      txnTimestamp = toIso(d);
    } else {
      // golomt — ISO string огноо
      if (dateCell === null || dateCell === undefined || dateCell === "") continue;
      const d = new Date(toStr(dateCell).replace(" ", "T"));
      if (Number.isNaN(d.getTime())) continue;
      txnDate = toDateStr(d);
      txnTimestamp = toIso(d);
    }

    // ── Орлого / зарлага ───────────────────────────────────────────
    const income = toNumber(row[col.income]);
    const expense = toNumber(row[col.expense]);
    if (income === 0 && expense === 0) continue;

    const rawDesc = toStr(row[col.description]);
    if (shouldSkip(rawDesc)) continue;

    const rawCtpy = col.counterparty !== undefined ? toStr(row[col.counterparty]) : "";
    const partnerName = extractCounterparty(rawDesc, rawCtpy) || null;
    const partnerAcc = col.accountNo !== undefined ? toStr(row[col.accountNo]) || null : null;
    const accountNoForClean = cfg.format === "tdb" ? TDB_TT_ACCOUNT : "";
    const description = cleanDescription(rawDesc, accountNoForClean) || null;

    const direction: "income" | "expense" = income > 0 ? "income" : "expense";
    const amount = income > 0 ? income : expense;

    out.push({
      sourceRowNum: i + 1,
      txnDate,
      txnTimestamp,
      direction,
      amount,
      description,
      partnerName,
      partnerAcc,
      rawData: { row: i + 1, date: dateCell, income, expense, rawDesc, rawCtpy },
    });
  }

  return { rows: out, errors };
}

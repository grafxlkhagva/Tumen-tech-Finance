/**
 * Mongolian-aware formatters for money, numbers, dates.
 *
 * Use these EVERYWHERE in display. Never call Intl.NumberFormat inline.
 * Math is done in Postgres (NUMERIC); JS only formats for display.
 */

// ---------------------------------------------------------------------------
// Money / numbers
// ---------------------------------------------------------------------------

/** Money with 2 decimals + thousand separators. Display as "1,234,567.89". */
export function fmtMoney(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "0.00";
  const num = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(num)) return "0.00";
  return new Intl.NumberFormat("mn-MN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/** Money with currency symbol. Display as "₮1,234,567.89". */
export function fmtMoneyMNT(n: number | string | null | undefined): string {
  return `₮${fmtMoney(n)}`;
}

/** Integer with thousand separators. Display as "1,234". */
export function fmtNum(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "0";
  const num = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(num)) return "0";
  return new Intl.NumberFormat("mn-MN").format(num);
}

/** Compact (1.2K / 5.6M / 1.2B). */
export function fmtCompact(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "0";
  const num = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(num)) return "0";
  return new Intl.NumberFormat("mn-MN", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(num);
}

/** Money or em-dash when zero. Use in tables to reduce noise. */
export function fmtMoneyOrDash(n: number | string | null | undefined): string {
  const num = typeof n === "string" ? Number(n) : (n ?? 0);
  if (!num || num === 0) return "—";
  return fmtMoney(num);
}

/** Percentage. Display as "12.34%". */
export function fmtPct(n: number | string | null | undefined, decimals = 2): string {
  if (n === null || n === undefined) return "0%";
  const num = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(num)) return "0%";
  return `${num.toFixed(decimals)}%`;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** ISO date (Postgres `date`) → "2026-05-28". */
export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  if (typeof d === "string") {
    return d.slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

/** Long date → "2026 оны 5 сарын 28". */
export function fmtDateLong(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()} оны ${date.getMonth() + 1} сарын ${date.getDate()}`;
}

/** Date + time → "2026-05-28 14:30". */
export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "—";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

/** Relative time → "5 минутын өмнө", "3 цагийн өмнө", "2 өдрийн өмнө". */
export function fmtRelative(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "—";
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "сая";
  if (diff < 3600) return `${Math.floor(diff / 60)} минутын өмнө`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} цагийн өмнө`;
  if (diff < 30 * 86400) return `${Math.floor(diff / 86400)} өдрийн өмнө`;
  return fmtDate(date);
}

/** Year/month → "2026 оны 5-р сар". */
export function fmtYearMonth(year: number | null | undefined, month: number | null | undefined): string {
  if (!year || !month) return "—";
  return `${year} оны ${month}-р сар`;
}

/** ISO month (2026-05) → "2026 оны 5-р сар". */
export function fmtIsoMonth(s: string | null | undefined): string {
  if (!s) return "—";
  const [y, m] = s.split("-").map(Number);
  if (!y || !m) return s;
  return fmtYearMonth(y, m);
}

// ---------------------------------------------------------------------------
// Strings / utilities
// ---------------------------------------------------------------------------

/** Truncate to length with ellipsis. */
export function truncate(s: string | null | undefined, max: number): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** Slugify Mongolian-Cyrillic-friendly identifiers (drop spaces, lowercase). */
export function slug(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-zа-яёөү0-9-]/gi, "");
}

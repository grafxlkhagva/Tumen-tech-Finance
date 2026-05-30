"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, CalendarCheck, RefreshCw, RotateCcw } from "lucide-react";

/**
 * Income Statement filter bar — quick range buttons (selected year, each
 * applicable month, "Бүгд"), plus manual date_from/date_to form.
 *
 * Server reads from URL, so each click just push-replaces the URL and lets
 * the RSC re-fetch — no client-side state. The manual date form uses a
 * native `<form method="GET">` which natively clears all other query params
 * because they're not in the form (so no onSubmit cleanup needed).
 */
export function IncomeStatementFilters({
  dateFrom,
  dateTo,
  currentYear,
}: {
  dateFrom: string;
  dateTo: string;
  /**
   * The year the page is currently displaying. Drives the quick-month
   * button count: for past years we surface all 12 months; for the current
   * year we only show months 1..today.
   */
  currentYear: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1; // 1-12

  // Past years → all 12 months. Current year → up to current month.
  // Future years (year > thisYear) → no months (probably no data anyway).
  const monthLimit =
    currentYear < thisYear ? 12 : currentYear === thisYear ? thisMonth : 0;

  const go = (params: Record<string, string | null>) => {
    // Replace the URL entirely with the params provided — we wipe any
    // pre-existing IS params so the new selection isn't poisoned by leftover
    // state (e.g. switching from "year=2024&month=3" back to a manual range).
    const next = new URLSearchParams();
    // Preserve any non-IS params that may be present (none today, but
    // future-proof). Reading from `sp` requires the hook to be non-null.
    if (sp) {
      for (const [k, v] of sp.entries()) {
        if (!["date_from", "date_to", "year", "month"].includes(k)) {
          next.set(k, v);
        }
      }
    }
    for (const [k, v] of Object.entries(params)) {
      if (v !== null) next.set(k, v);
    }
    router.push(`/reports/income-statement?${next.toString()}`);
  };

  return (
    <div className="bg-white rounded border border-slate-200 p-3 print:hidden">
      <form
        method="GET"
        action="/reports/income-statement"
        className="flex flex-wrap items-end gap-2"
      >
        <div>
          <label htmlFor="is-date-from" className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-emerald-600" /> Эхлэх огноо
          </label>
          <input
            id="is-date-from"
            type="date"
            name="date_from"
            defaultValue={dateFrom}
            className="px-2 py-1 border border-slate-300 rounded text-xs w-[155px]"
          />
        </div>
        <div>
          <label htmlFor="is-date-to" className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
            <CalendarCheck className="w-3 h-3 text-red-600" /> Дуусах огноо
          </label>
          <input
            id="is-date-to"
            type="date"
            name="date_to"
            defaultValue={dateTo}
            className="px-2 py-1 border border-slate-300 rounded text-xs w-[155px]"
          />
        </div>

        <div className="flex flex-wrap gap-1 items-center">
          <button
            type="button"
            onClick={() => go({ year: String(currentYear) })}
            className="px-2 py-1 border border-slate-300 rounded text-xs hover:bg-slate-50"
          >
            {currentYear} жил
          </button>
          {Array.from({ length: monthLimit }, (_, i) => i + 1).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => go({ year: String(currentYear), month: String(m) })}
              className="px-2 py-1 border border-slate-300 rounded text-xs hover:bg-slate-50"
            >
              {m}-р сар
            </button>
          ))}
          <button
            type="button"
            onClick={() => go({})}
            className="px-2 py-1 border border-slate-300 rounded text-xs hover:bg-slate-50 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Бүгд
          </button>
        </div>

        <button
          type="submit"
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Харуулах
        </button>
      </form>
    </div>
  );
}

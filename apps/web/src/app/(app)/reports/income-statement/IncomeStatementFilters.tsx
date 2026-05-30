"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, CalendarCheck, RefreshCw, RotateCcw } from "lucide-react";

/**
 * Income Statement filter bar — quick range buttons (current year, each
 * month up to current, "all"), plus manual date_from/date_to form.
 *
 * Server reads from URL, so each click just push-replaces the URL and
 * lets the RSC re-fetch — no client-side state.
 */
export function IncomeStatementFilters({
  dateFrom,
  dateTo,
}: {
  dateFrom: string;
  dateTo: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  const go = (params: Record<string, string | null>) => {
    const next = new URLSearchParams(sp?.toString() ?? "");
    // wipe all known IS params first to avoid stale combinations
    next.delete("date_from");
    next.delete("date_to");
    next.delete("year");
    next.delete("month");
    for (const [k, v] of Object.entries(params)) {
      if (v !== null) next.set(k, v);
    }
    router.push(`/reports/income-statement?${next.toString()}`);
  };

  return (
    <div className="bg-white rounded border border-slate-200 p-3 print:hidden">
      <form
        method="GET"
        className="flex flex-wrap items-end gap-2"
        action="/reports/income-statement"
        onSubmit={(e) => {
          // submit lets the form handle URL — but kill `year`/`month` so
          // they don't conflict with explicit range
          const form = e.currentTarget;
          const ym = form.querySelector('input[name="year"]') as HTMLInputElement | null;
          const mm = form.querySelector('input[name="month"]') as HTMLInputElement | null;
          if (ym) ym.value = "";
          if (mm) mm.value = "";
        }}
      >
        <div>
          <label htmlFor="is-date-from" className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
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
          <label htmlFor="is-date-to" className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
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
            onClick={() => go({ year: String(year) })}
            className="px-2 py-1 border border-slate-300 rounded text-xs hover:bg-slate-50"
          >
            {year} жил
          </button>
          {Array.from({ length: month }, (_, i) => i + 1).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => go({ year: String(year), month: String(m) })}
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

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarRange, RotateCw } from "lucide-react";

export function TrialBalanceFilters({
  dateFrom,
  dateTo,
  showZero,
  rowCount,
}: {
  dateFrom: string;
  dateTo: string;
  showZero: boolean;
  rowCount: number;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(dateFrom);
  const [to, setTo] = useState(dateTo);
  const [zero, setZero] = useState(showZero);

  function apply(newFrom: string, newTo: string, newZero: boolean) {
    const qs = new URLSearchParams();
    if (newFrom) qs.set("date_from", newFrom);
    if (newTo) qs.set("date_to", newTo);
    if (newZero) qs.set("show_zero", "1");
    router.push(`/reports/trial-balance?${qs.toString()}`);
  }

  function quickThisYear() {
    const y = new Date().getFullYear();
    const a = `${y}-01-01`;
    const b = new Date().toISOString().slice(0, 10);
    setFrom(a); setTo(b);
    apply(a, b, zero);
  }
  function quickThisMonth() {
    const d = new Date();
    const a = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    const b = d.toISOString().slice(0, 10);
    setFrom(a); setTo(b);
    apply(a, b, zero);
  }
  function quickFromBeginning() {
    const a = "2000-01-01";
    const b = new Date().toISOString().slice(0, 10);
    setFrom(a); setTo(b);
    apply(a, b, zero);
  }
  function quickAll() {
    setFrom(""); setTo("");
    apply("", "", zero);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 print:hidden">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1">
            <CalendarRange className="w-3.5 h-3.5" /> Эхлэх огноо
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1">
            <CalendarRange className="w-3.5 h-3.5" /> Дуусах огноо
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded text-sm"
          />
        </div>

        <div className="flex gap-1.5">
          <button onClick={quickThisYear} className="border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-xs">
            {new Date().getFullYear()} жил
          </button>
          <button onClick={quickThisMonth} className="border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-xs">
            Энэ сар
          </button>
          <button onClick={quickFromBeginning} className="border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-xs">
            Эхнээс өнөөдөр
          </button>
          <button onClick={quickAll} className="border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-xs">
            Бугд
          </button>
        </div>

        <label className="inline-flex items-center gap-1.5 text-xs ml-auto">
          <input
            type="checkbox"
            checked={zero}
            onChange={(e) => setZero(e.target.checked)}
            className="rounded"
          />
          <span>Тэг данс харуулах</span>
        </label>

        <button
          onClick={() => apply(from, to, zero)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-medium flex items-center gap-1.5"
        >
          <RotateCw className="w-3.5 h-3.5" /> Харуулах
        </button>
      </div>

      <div className="mt-2 text-xs text-slate-500">
        <span className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
          {dateFrom} → {dateTo}
        </span>
        <span className="ml-2">{rowCount} данс</span>
      </div>
    </div>
  );
}

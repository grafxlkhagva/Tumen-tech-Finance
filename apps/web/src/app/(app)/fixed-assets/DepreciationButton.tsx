"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calculator } from "lucide-react";
import { fmtYearMonth } from "@/lib/format";
import { runDepreciation } from "./actions";

export function DepreciationButton({
  periods,
}: {
  periods: Array<{ id: string; year: number; month: number }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function handle(periodId: string) {
    setOpen(false);
    setResult(null);
    startTransition(async () => {
      const r = await runDepreciation(periodId);
      if (r.error) setResult(`⚠ ${r.error}`);
      else setResult(r.success ?? "OK");
      router.refresh();
      setTimeout(() => setResult(null), 4000);
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded text-sm flex items-center gap-2"
      >
        <Calculator className="w-4 h-4" /> Элэгдэл тооцоох
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded shadow-lg w-56 max-h-64 overflow-y-auto">
          <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-100">Сар сонгох</div>
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => handle(p.id)}
              disabled={pending}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-sm disabled:opacity-50"
            >
              {fmtYearMonth(p.year, p.month)}
            </button>
          ))}
        </div>
      )}
      {result && <div className="absolute right-0 mt-1 px-2 py-1 bg-slate-800 text-white text-xs rounded">{result}</div>}
    </div>
  );
}

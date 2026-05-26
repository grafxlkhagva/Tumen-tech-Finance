import { createClient } from "@/lib/supabase/server";
import { Calculator } from "lucide-react";

function fmt(n: number | null | undefined) {
  const v = Number(n ?? 0);
  if (v === 0) return "—";
  return new Intl.NumberFormat("mn-MN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

const TYPE_LABEL: Record<string, string> = {
  asset: "Хөрөнгө", liability: "Өр төлбөр", equity: "Эзний өмч",
  income: "Орлого",  expense: "Зардал",
};

export default async function TrialBalancePage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("v_trial_balance")
    .select("code, name, type, debit_balance, credit_balance")
    .order("code");

  const totalDr = (rows ?? []).reduce((s, r) => s + Number(r.debit_balance ?? 0), 0);
  const totalCr = (rows ?? []).reduce((s, r) => s + Number(r.credit_balance ?? 0), 0);
  const diff = totalDr - totalCr;
  const balanced = Math.abs(diff) < 0.01;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <Calculator className="w-6 h-6" /> Шалгах баланс
        </h1>
        <p className="text-sm text-slate-500">Posted journal-уудаас тооцоолсон балансууд</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Код</th>
              <th className="px-4 py-2 text-left">Дансны нэр</th>
              <th className="px-4 py-2 text-left">Төрөл</th>
              <th className="px-4 py-2 text-right">Дебит</th>
              <th className="px-4 py-2 text-right">Кредит</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(rows ?? []).filter(r => Number(r.debit_balance) > 0 || Number(r.credit_balance) > 0).map((r) => (
              <tr key={r.code} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                <td className="px-4 py-2">{r.name}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{TYPE_LABEL[r.type] ?? r.type}</td>
                <td className="px-4 py-2 font-mono text-right text-xs">{fmt(r.debit_balance)}</td>
                <td className="px-4 py-2 font-mono text-right text-xs">{fmt(r.credit_balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 font-semibold text-sm">
            <tr>
              <td colSpan={3} className="px-4 py-3 text-right uppercase text-xs">НИЙТ</td>
              <td className="px-4 py-3 font-mono text-right">₮{fmt(totalDr)}</td>
              <td className="px-4 py-3 font-mono text-right">₮{fmt(totalCr)}</td>
            </tr>
            <tr className={balanced ? "bg-green-50" : "bg-red-50"}>
              <td colSpan={3} className="px-4 py-2 text-right uppercase text-xs">
                {balanced ? "✓ БАЛАНСТАЙ" : "⚠ ЗӨРҮҮ"}
              </td>
              <td colSpan={2} className={`px-4 py-2 font-mono text-right ${balanced ? "text-green-700" : "text-red-700"}`}>
                ₮{fmt(diff)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

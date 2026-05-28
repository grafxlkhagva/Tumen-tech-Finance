import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { fmtMoney } from "@/lib/format";
import { PrintButton } from "@/components/ui/PrintButton";

export const metadata = { title: "МХ-1 — Тумэн Accounting" };

export default async function MH1Page() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_trial_balance")
    .select("code, name, debit_balance, credit_balance")
    .order("code");

  const rows = (data ?? []).filter((r) => Number(r.debit_balance) > 0 || Number(r.credit_balance) > 0);
  const totalDr = rows.reduce((s, r) => s + Number(r.debit_balance ?? 0), 0);
  const totalCr = rows.reduce((s, r) => s + Number(r.credit_balance ?? 0), 0);

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/forms" className="text-xs text-slate-500 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Маягтуудад буцах
        </Link>
        <PrintButton />
      </div>

      <div className="bg-white border border-slate-200 rounded p-8 print:border-0 print:shadow-none">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold uppercase tracking-wider">МХ-1 маягт</h1>
          <div className="text-sm text-slate-600 mt-1">Анхан шатны эргэлтийн баланс</div>
        </div>

        <table className="w-full text-sm border border-slate-300">
          <thead className="bg-slate-100">
            <tr>
              <th className="border border-slate-300 px-3 py-2 text-left">Код</th>
              <th className="border border-slate-300 px-3 py-2 text-left">Дансны нэр</th>
              <th className="border border-slate-300 px-3 py-2 text-right">Дебит үлдэгдэл</th>
              <th className="border border-slate-300 px-3 py-2 text-right">Кредит үлдэгдэл</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code}>
                <td className="border border-slate-300 px-3 py-1.5 font-mono text-xs">{r.code}</td>
                <td className="border border-slate-300 px-3 py-1.5 text-xs">{r.name}</td>
                <td className="border border-slate-300 px-3 py-1.5 font-mono text-right text-xs">{Number(r.debit_balance) > 0 ? fmtMoney(r.debit_balance) : ""}</td>
                <td className="border border-slate-300 px-3 py-1.5 font-mono text-right text-xs">{Number(r.credit_balance) > 0 ? fmtMoney(r.credit_balance) : ""}</td>
              </tr>
            ))}
            <tr className="bg-slate-100 font-bold">
              <td colSpan={2} className="border border-slate-300 px-3 py-2 text-right">НИЙТ</td>
              <td className="border border-slate-300 px-3 py-2 font-mono text-right">₮{fmtMoney(totalDr)}</td>
              <td className="border border-slate-300 px-3 py-2 font-mono text-right">₮{fmtMoney(totalCr)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
          <div>
            <div className="border-b border-slate-300 mb-2"></div>
            <div className="text-center text-xs text-slate-500">Захирал</div>
          </div>
          <div>
            <div className="border-b border-slate-300 mb-2"></div>
            <div className="text-center text-xs text-slate-500">Нягтлан бодогч</div>
          </div>
        </div>
      </div>

      <style>{`@media print { @page { margin: 1cm; } body { background: white; } }`}</style>
    </div>
  );
}

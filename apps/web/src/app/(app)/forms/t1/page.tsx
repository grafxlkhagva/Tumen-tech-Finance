import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { fmtMoney } from "@/lib/format";
import { PrintButton } from "@/components/ui/PrintButton";

export const metadata = { title: "Т-1 — Тумэн Accounting" };

export default async function T1Page() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_partner_balance")
    .select("partner_id, partner_name, register, open_receivables, open_payables")
    .or("open_receivables.gt.0,open_payables.gt.0")
    .order("partner_name");

  const rows = (data ?? []).filter((r) => Number(r.open_receivables) > 0 || Number(r.open_payables) > 0);
  const totalAR = rows.reduce((s, r) => s + Number(r.open_receivables ?? 0), 0);
  const totalAP = rows.reduce((s, r) => s + Number(r.open_payables ?? 0), 0);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/forms" className="text-xs text-slate-500 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Маягтуудад буцах
        </Link>
        <PrintButton />
      </div>

      <div className="bg-white border border-slate-200 rounded p-8 print:border-0 print:shadow-none">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold uppercase tracking-wider">Т-1 маягт</h1>
          <div className="text-sm text-slate-600 mt-1">Авлага/Өглөгийн тулгалтын акт</div>
        </div>

        <table className="w-full text-sm border border-slate-300">
          <thead className="bg-slate-100">
            <tr>
              <th className="border border-slate-300 px-3 py-2 text-left">№</th>
              <th className="border border-slate-300 px-3 py-2 text-left">Харилцагч</th>
              <th className="border border-slate-300 px-3 py-2 text-left">Регистр</th>
              <th className="border border-slate-300 px-3 py-2 text-right">Авлага</th>
              <th className="border border-slate-300 px-3 py-2 text-right">Өглөг</th>
              <th className="border border-slate-300 px-3 py-2 text-right">Цэвэр</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const ar = Number(r.open_receivables ?? 0);
              const ap = Number(r.open_payables ?? 0);
              return (
                <tr key={r.partner_id}>
                  <td className="border border-slate-300 px-3 py-1.5 text-xs">{i + 1}</td>
                  <td className="border border-slate-300 px-3 py-1.5 text-xs">{r.partner_name}</td>
                  <td className="border border-slate-300 px-3 py-1.5 font-mono text-xs">{r.register || "—"}</td>
                  <td className="border border-slate-300 px-3 py-1.5 font-mono text-right text-xs">{ar > 0 ? fmtMoney(ar) : ""}</td>
                  <td className="border border-slate-300 px-3 py-1.5 font-mono text-right text-xs">{ap > 0 ? fmtMoney(ap) : ""}</td>
                  <td className="border border-slate-300 px-3 py-1.5 font-mono text-right text-xs font-semibold">{fmtMoney(ar - ap)}</td>
                </tr>
              );
            })}
            <tr className="bg-slate-100 font-bold">
              <td colSpan={3} className="border border-slate-300 px-3 py-2 text-right text-xs uppercase">НИЙТ</td>
              <td className="border border-slate-300 px-3 py-2 font-mono text-right">{fmtMoney(totalAR)}</td>
              <td className="border border-slate-300 px-3 py-2 font-mono text-right">{fmtMoney(totalAP)}</td>
              <td className="border border-slate-300 px-3 py-2 font-mono text-right">{fmtMoney(totalAR - totalAP)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <style>{`@media print { @page { size: landscape; margin: 1cm; } body { background: white; } }`}</style>
    </div>
  );
}

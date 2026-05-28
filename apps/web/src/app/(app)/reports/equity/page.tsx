import { createClient } from "@/lib/supabase/server";
import { Building2 } from "lucide-react";
import { fmtMoney } from "@/lib/format";

export const metadata = { title: "Өмчийн өөрчлөлтийн тайлан — Тумэн Accounting" };

export default async function EquityPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_account_balances")
    .select("account_id, code, name, balance")
    .eq("type", "equity")
    .order("code");

  const rows = (data ?? []).filter((r) => Number(r.balance) !== 0);
  const total = rows.reduce((s, r) => s + Number(r.balance), 0);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <Building2 className="w-6 h-6" /> Эзний өмчийн тайлан
        </h1>
        <p className="text-sm text-slate-500">Эзний өмчийн дансны үлдэгдэл</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Код</th>
              <th className="px-4 py-2 text-left">Дансны нэр</th>
              <th className="px-4 py-2 text-right">Үлдэгдэл</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.account_id}>
                <td className="px-4 py-1.5 font-mono text-xs">{r.code}</td>
                <td className="px-4 py-1.5 text-xs">{r.name}</td>
                <td className="px-4 py-1.5 font-mono text-right text-xs">{fmtMoney(r.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-purple-100 font-bold">
            <tr>
              <td colSpan={2} className="px-4 py-3 text-right uppercase text-xs">Нийт эзний өмч</td>
              <td className="px-4 py-3 font-mono text-right">₮{fmtMoney(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

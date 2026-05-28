import { createClient } from "@/lib/supabase/server";
import { ScrollText } from "lucide-react";
import { fmtMoney, fmtDateLong } from "@/lib/format";

export const metadata = { title: "Мөнгөн гүйлгээний тайлан — Тумэн Accounting" };

type SearchParams = Promise<{ from?: string; to?: string }>;

const COMPANY_ID = "00000000-0000-0000-0000-000000000001";

export default async function CashflowPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const from = sp.from ?? `${new Date().getFullYear()}-01-01`;
  const to   = sp.to   ?? new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data } = await supabase.rpc("fn_cashflow", {
    p_company_id: COMPANY_ID, p_start: from, p_end: to,
  });

  const rows = (data ?? []) as Array<{ direction: string; category: string; txn_count: number; amount: number }>;
  const income = rows.filter((r) => r.direction === "income");
  const expense = rows.filter((r) => r.direction === "expense");

  const totalIn = income.reduce((s, r) => s + Number(r.amount), 0);
  const totalOut = expense.reduce((s, r) => s + Number(r.amount), 0);
  const net = totalIn - totalOut;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <ScrollText className="w-6 h-6" /> Мөнгөн гүйлгээний тайлан
        </h1>
        <p className="text-sm text-slate-500">{fmtDateLong(from)} — {fmtDateLong(to)}</p>
      </div>

      <form method="GET" className="flex items-center gap-2">
        <input type="date" name="from" defaultValue={from} className="px-2 py-1.5 border border-slate-300 rounded text-xs" />
        <span className="text-xs text-slate-500">→</span>
        <input type="date" name="to" defaultValue={to} className="px-2 py-1.5 border border-slate-300 rounded text-xs" />
        <button className="px-3 py-1.5 bg-slate-700 text-white rounded text-xs">Үзэх</button>
      </form>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 bg-green-50">
            <h2 className="text-sm font-bold text-green-900">ОРОХ МӨНГӨ</h2>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {income.map((r, i) => (
                <tr key={`in-${i}`}>
                  <td className="px-4 py-1.5 text-xs">{r.category}</td>
                  <td className="px-4 py-1.5 text-xs text-slate-400 text-right">{r.txn_count}</td>
                  <td className="px-4 py-1.5 font-mono text-right text-xs">{fmtMoney(r.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-green-100 font-bold">
              <tr>
                <td colSpan={2} className="px-4 py-2 text-right text-xs uppercase">Нийт</td>
                <td className="px-4 py-2 font-mono text-right">₮{fmtMoney(totalIn)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 bg-red-50">
            <h2 className="text-sm font-bold text-red-900">ГАРАХ МӨНГӨ</h2>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {expense.map((r, i) => (
                <tr key={`out-${i}`}>
                  <td className="px-4 py-1.5 text-xs">{r.category}</td>
                  <td className="px-4 py-1.5 text-xs text-slate-400 text-right">{r.txn_count}</td>
                  <td className="px-4 py-1.5 font-mono text-right text-xs">{fmtMoney(r.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-red-100 font-bold">
              <tr>
                <td colSpan={2} className="px-4 py-2 text-right text-xs uppercase">Нийт</td>
                <td className="px-4 py-2 font-mono text-right">₮{fmtMoney(totalOut)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className={`p-5 rounded-lg ${net >= 0 ? "bg-blue-50 border border-blue-200" : "bg-orange-50 border border-orange-200"}`}>
        <div className="text-xs uppercase font-semibold mb-1">Цэвэр мөнгөн урсгал</div>
        <div className={`text-2xl font-bold font-mono ${net >= 0 ? "text-blue-900" : "text-orange-900"}`}>
          ₮{fmtMoney(net)}
        </div>
      </div>
    </div>
  );
}

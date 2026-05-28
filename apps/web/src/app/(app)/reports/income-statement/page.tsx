import { createClient } from "@/lib/supabase/server";
import { TrendingUp } from "lucide-react";
import { fmtMoney, fmtDateLong } from "@/lib/format";

export const metadata = { title: "Орлогын тайлан — Тумэн Accounting" };

type SearchParams = Promise<{ from?: string; to?: string }>;

const COMPANY_ID = "00000000-0000-0000-0000-000000000001";

export default async function IncomeStatementPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const today = new Date().toISOString().slice(0, 10);
  const from = sp.from ?? yearStart;
  const to   = sp.to   ?? today;

  const supabase = await createClient();
  const { data } = await supabase.rpc("fn_income_statement", {
    p_company_id: COMPANY_ID, p_start: from, p_end: to,
  });

  const rows = (data ?? []) as Array<{ account_id: string; code: string; name: string; type: string; amount: number }>;
  const income = rows.filter((r) => r.type === "income");
  const expense = rows.filter((r) => r.type === "expense");

  const totalIncome = income.reduce((s, r) => s + Number(r.amount), 0);
  const totalExpense = expense.reduce((s, r) => s + Number(r.amount), 0);
  const profit = totalIncome - totalExpense;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-6 h-6" /> Орлогын дэлгэрэнгүй тайлан
        </h1>
        <p className="text-sm text-slate-500">{fmtDateLong(from)} — {fmtDateLong(to)}</p>
      </div>

      <form method="GET" className="flex items-center gap-2">
        <input type="date" name="from" defaultValue={from} className="px-2 py-1.5 border border-slate-300 rounded text-xs" />
        <span className="text-xs text-slate-500">→</span>
        <input type="date" name="to" defaultValue={to} className="px-2 py-1.5 border border-slate-300 rounded text-xs" />
        <button className="px-3 py-1.5 bg-slate-700 text-white rounded text-xs">Үзэх</button>
      </form>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            <tr className="bg-green-50 font-bold">
              <td colSpan={3} className="px-4 py-2 text-xs uppercase text-green-900">ОРЛОГО</td>
            </tr>
            {income.map((r) => (
              <tr key={r.account_id}>
                <td className="px-4 py-1.5 text-xs font-mono text-slate-500 w-16">{r.code}</td>
                <td className="px-4 py-1.5 text-xs">{r.name}</td>
                <td className="px-4 py-1.5 font-mono text-right text-xs">{fmtMoney(r.amount)}</td>
              </tr>
            ))}
            <tr className="bg-green-100 font-bold">
              <td colSpan={2} className="px-4 py-2 text-right text-xs uppercase">Нийт орлого</td>
              <td className="px-4 py-2 font-mono text-right">₮{fmtMoney(totalIncome)}</td>
            </tr>

            <tr className="bg-red-50 font-bold">
              <td colSpan={3} className="px-4 py-2 text-xs uppercase text-red-900">ЗАРДАЛ</td>
            </tr>
            {expense.map((r) => (
              <tr key={r.account_id}>
                <td className="px-4 py-1.5 text-xs font-mono text-slate-500 w-16">{r.code}</td>
                <td className="px-4 py-1.5 text-xs">{r.name}</td>
                <td className="px-4 py-1.5 font-mono text-right text-xs">{fmtMoney(r.amount)}</td>
              </tr>
            ))}
            <tr className="bg-red-100 font-bold">
              <td colSpan={2} className="px-4 py-2 text-right text-xs uppercase">Нийт зардал</td>
              <td className="px-4 py-2 font-mono text-right">₮{fmtMoney(totalExpense)}</td>
            </tr>

            <tr className={`font-bold ${profit >= 0 ? "bg-blue-100" : "bg-orange-100"}`}>
              <td colSpan={2} className="px-4 py-3 text-right text-sm uppercase">
                {profit >= 0 ? "Цэвэр АШИГ" : "Цэвэр АЛДАГДАЛ"}
              </td>
              <td className={`px-4 py-3 font-mono text-right text-lg ${profit >= 0 ? "text-blue-900" : "text-orange-900"}`}>
                ₮{fmtMoney(profit)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

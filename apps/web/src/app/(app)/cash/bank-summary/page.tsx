import { createClient } from "@/lib/supabase/server";
import { Landmark } from "lucide-react";
import { fmtMoney, fmtYearMonth } from "@/lib/format";
import { ToastFromURL } from "@/components/ui/Toast";

export const metadata = { title: "Банкны нэгтгэл — Тумэн Accounting" };

export default async function BankSummaryPage() {
  const supabase = await createClient();

  const [txnsResult, banksResult] = await Promise.all([
    supabase
      .from("cash_transactions")
      .select("txn_date, direction, amount, bank_account_id, bank:bank_accounts(name, bank_name)")
      .is("deleted_at", null),
    supabase
      .from("bank_accounts")
      .select("id, name, bank_name, opening_balance")
      .is("deleted_at", null)
      .order("name"),
  ]);

  // Group by bank + month
  type Cell = { income: number; expense: number };
  const rows = txnsResult.data ?? [];
  const banks = banksResult.data ?? [];

  // Calculate running balance per bank
  const bankTotals = new Map<string, { income: number; expense: number; opening: number }>();
  for (const b of banks) {
    bankTotals.set(b.id, { income: 0, expense: 0, opening: Number(b.opening_balance || 0) });
  }
  for (const r of rows) {
    const bt = bankTotals.get(r.bank_account_id);
    if (!bt) continue;
    if (r.direction === "income") bt.income += Number(r.amount || 0);
    else bt.expense += Number(r.amount || 0);
  }

  // Also per-month per-bank
  type BankMonth = Map<string, Cell>; // key = bankId
  const monthMap = new Map<string, BankMonth>(); // key = year-month
  for (const r of rows) {
    const d = new Date(r.txn_date);
    const mKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
    if (!monthMap.has(mKey)) monthMap.set(mKey, new Map());
    const bMap = monthMap.get(mKey)!;
    if (!bMap.has(r.bank_account_id)) bMap.set(r.bank_account_id, { income: 0, expense: 0 });
    const cell = bMap.get(r.bank_account_id)!;
    if (r.direction === "income") cell.income += Number(r.amount || 0);
    else cell.expense += Number(r.amount || 0);
  }

  const sortedMonths = Array.from(monthMap.keys()).sort().reverse();

  return (
    <div className="space-y-4">
      <ToastFromURL />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <Landmark className="w-6 h-6" /> Банкны нэгтгэл
        </h1>
      </div>

      {/* Bank totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {banks.map((b) => {
          const t = bankTotals.get(b.id)!;
          const balance = t.opening + t.income - t.expense;
          return (
            <div key={b.id} className="bg-white border border-slate-200 rounded p-4">
              <div className="text-xs text-slate-500 truncate" title={b.name}>{b.name}</div>
              <div className="text-2xl font-bold text-slate-900 font-mono mt-1">
                ₮{fmtMoney(balance)}
              </div>
              <div className="text-[0.65rem] text-slate-400 mt-1">
                Орлого: {fmtMoney(t.income)} · Зарлага: {fmtMoney(t.expense)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Month × bank matrix */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700">Сар × Банк (орлого − зарлага)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left sticky left-0 bg-slate-50">Сар</th>
                {banks.map((b) => (
                  <th key={b.id} className="px-3 py-2 text-right whitespace-nowrap" title={b.name}>
                    {b.name.slice(0, 20)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedMonths.map((mKey) => {
                const [y, m] = mKey.split("-").map(Number);
                const bMap = monthMap.get(mKey)!;
                return (
                  <tr key={mKey} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs font-medium sticky left-0 bg-white">{fmtYearMonth(y, m)}</td>
                    {banks.map((b) => {
                      const cell = bMap.get(b.id);
                      const net = (cell?.income ?? 0) - (cell?.expense ?? 0);
                      return (
                        <td key={b.id} className={`px-3 py-2 text-right font-mono text-xs ${net >= 0 ? "text-green-700" : "text-red-700"}`}>
                          {net === 0 ? "—" : fmtMoney(net)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

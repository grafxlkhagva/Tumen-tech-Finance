import { createClient } from "@/lib/supabase/server";
import { PieChart } from "lucide-react";
import { fmtMoney, fmtYearMonth } from "@/lib/format";
import { ToastFromURL } from "@/components/ui/Toast";

export const metadata = { title: "Кассын нэгтгэл — Тумэн Accounting" };

export default async function CashSummaryPage() {
  const supabase = await createClient();

  // Aggregate cash by year-month-category-direction
  const { data: rows } = await supabase
    .from("cash_transactions")
    .select("txn_date, direction, amount, category")
    .is("deleted_at", null);

  type Group = {
    year: number;
    month: number;
    incomeByCategory: Map<string, number>;
    expenseByCategory: Map<string, number>;
    incomeTotal: number;
    expenseTotal: number;
  };
  const groups = new Map<string, Group>();
  for (const r of rows ?? []) {
    const d = new Date(r.txn_date);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    if (!groups.has(key)) {
      groups.set(key, {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        incomeByCategory: new Map(),
        expenseByCategory: new Map(),
        incomeTotal: 0,
        expenseTotal: 0,
      });
    }
    const g = groups.get(key)!;
    const amt = Number(r.amount || 0);
    const cat = r.category || "Ангилаагүй";
    if (r.direction === "income") {
      g.incomeTotal += amt;
      g.incomeByCategory.set(cat, (g.incomeByCategory.get(cat) ?? 0) + amt);
    } else {
      g.expenseTotal += amt;
      g.expenseByCategory.set(cat, (g.expenseByCategory.get(cat) ?? 0) + amt);
    }
  }

  const sorted = Array.from(groups.values()).sort((a, b) =>
    b.year !== a.year ? b.year - a.year : b.month - a.month,
  );

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <ToastFromURL />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <PieChart className="w-6 h-6" /> Кассын нэгтгэл
        </h1>
        <p className="text-sm text-slate-500">Сар бүрийн орлого/зарлагыг ангилалаар нэгтгэв</p>
      </div>

      {sorted.map((g) => (
        <div key={`${g.year}-${g.month}`} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">{fmtYearMonth(g.year, g.month)}</h2>
            <div className="text-xs text-slate-500">
              Цэвэр: <span className="font-mono font-semibold">{fmtMoney(g.incomeTotal - g.expenseTotal)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-slate-100">
            <div className="p-4">
              <div className="text-xs font-semibold text-green-700 uppercase mb-2">Орлого · {fmtMoney(g.incomeTotal)}</div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-50">
                  {Array.from(g.incomeByCategory.entries())
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, amt]) => (
                      <tr key={cat}>
                        <td className="py-1 text-xs">{cat}</td>
                        <td className="py-1 text-xs font-mono text-right">{fmtMoney(amt)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="p-4">
              <div className="text-xs font-semibold text-red-700 uppercase mb-2">Зарлага · {fmtMoney(g.expenseTotal)}</div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-50">
                  {Array.from(g.expenseByCategory.entries())
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, amt]) => (
                      <tr key={cat}>
                        <td className="py-1 text-xs">{cat}</td>
                        <td className="py-1 text-xs font-mono text-right">{fmtMoney(amt)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { FileBarChart2 } from "lucide-react";
import { fmtMoney, fmtDateLong } from "@/lib/format";

export const metadata = { title: "Санхүү байдлын тайлан — Тумэн Accounting" };

type SearchParams = Promise<{ as_of?: string }>;

const COMPANY_ID = "00000000-0000-0000-0000-000000000001";

export default async function BalanceSheetPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const asOf = sp.as_of ?? new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data } = await supabase.rpc("fn_balance_sheet", {
    p_company_id: COMPANY_ID,
    p_as_of: asOf,
  });

  const rows = (data ?? []) as Array<{
    account_id: string; code: string; name: string; type: string;
    parent_id: string | null; level: number; balance: number;
  }>;

  const assets = rows.filter((r) => r.type === "asset");
  const liabilities = rows.filter((r) => r.type === "liability");
  const equity = rows.filter((r) => r.type === "equity");

  const totalAssets = assets.reduce((s, r) => s + Number(r.balance), 0);
  const totalLiab = liabilities.reduce((s, r) => s + Number(r.balance), 0);
  const totalEq = equity.reduce((s, r) => s + Number(r.balance), 0);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <FileBarChart2 className="w-6 h-6" /> Санхүү байдлын тайлан
        </h1>
        <p className="text-sm text-slate-500">{fmtDateLong(asOf)}-ний байдлаар</p>
      </div>

      <form method="GET" className="flex items-center gap-2">
        <label className="text-xs text-slate-500">Огноо:</label>
        <input type="date" name="as_of" defaultValue={asOf} className="px-2 py-1.5 border border-slate-300 rounded text-xs" />
        <button className="px-3 py-1.5 bg-slate-700 text-white rounded text-xs">Үзэх</button>
      </form>

      <div className="grid grid-cols-2 gap-4">
        {/* Assets */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 bg-blue-50">
            <h2 className="text-sm font-bold text-blue-900">ХӨРӨНГӨ</h2>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {assets.map((r) => (
                <tr key={r.account_id}>
                  <td className="px-4 py-1.5 text-xs font-mono text-slate-500 w-16">{r.code}</td>
                  <td className="px-4 py-1.5 text-xs">{r.name}</td>
                  <td className="px-4 py-1.5 font-mono text-right text-xs">{fmtMoney(r.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-blue-100 font-bold">
              <tr>
                <td colSpan={2} className="px-4 py-2 text-right text-xs uppercase">Нийт хөрөнгө</td>
                <td className="px-4 py-2 font-mono text-right">₮{fmtMoney(totalAssets)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Liabilities + Equity */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 bg-orange-50">
              <h2 className="text-sm font-bold text-orange-900">ӨР ТӨЛБӨР</h2>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {liabilities.map((r) => (
                  <tr key={r.account_id}>
                    <td className="px-4 py-1.5 text-xs font-mono text-slate-500 w-16">{r.code}</td>
                    <td className="px-4 py-1.5 text-xs">{r.name}</td>
                    <td className="px-4 py-1.5 font-mono text-right text-xs">{fmtMoney(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-orange-100 font-bold">
                <tr>
                  <td colSpan={2} className="px-4 py-2 text-right text-xs uppercase">Нийт өр</td>
                  <td className="px-4 py-2 font-mono text-right">₮{fmtMoney(totalLiab)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 bg-purple-50">
              <h2 className="text-sm font-bold text-purple-900">ЭЗНИЙ ӨМЧ</h2>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {equity.map((r) => (
                  <tr key={r.account_id}>
                    <td className="px-4 py-1.5 text-xs font-mono text-slate-500 w-16">{r.code}</td>
                    <td className="px-4 py-1.5 text-xs">{r.name}</td>
                    <td className="px-4 py-1.5 font-mono text-right text-xs">{fmtMoney(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-purple-100 font-bold">
                <tr>
                  <td colSpan={2} className="px-4 py-2 text-right text-xs uppercase">Нийт эзний өмч</td>
                  <td className="px-4 py-2 font-mono text-right">₮{fmtMoney(totalEq)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className={`p-4 rounded-lg ${Math.abs(totalAssets - (totalLiab + totalEq)) < 0.01 ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
            <div className="text-xs uppercase font-semibold mb-1">Тэнцлийн шалгалт</div>
            <div className="text-sm">
              Хөрөнгө = Өр + Эзний өмч → ₮{fmtMoney(totalAssets)} = ₮{fmtMoney(totalLiab + totalEq)}
              {Math.abs(totalAssets - (totalLiab + totalEq)) < 0.01 ? " ✓" : ` (зөрүү ₮${fmtMoney(totalAssets - totalLiab - totalEq)})`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

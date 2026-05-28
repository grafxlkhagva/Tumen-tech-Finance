import { createClient } from "@/lib/supabase/server";
import { FileBarChart2 } from "lucide-react";
import { fmtMoney, fmtPct } from "@/lib/format";

export const metadata = { title: "ААНОАТ тайлан — Тумэн Accounting" };

type SearchParams = Promise<{ year?: string }>;

const COMPANY_ID = "00000000-0000-0000-0000-000000000001";

export default async function CITPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const year = parseInt(sp.year ?? String(new Date().getFullYear()), 10);

  const supabase = await createClient();
  const { data } = await supabase.rpc("fn_cit_summary", {
    p_company_id: COMPANY_ID, p_year: year,
  });

  const row = (data?.[0] ?? {}) as {
    total_income: number;
    total_expense: number;
    taxable_income: number;
    cit_amount: number;
    effective_rate: number;
  };

  const lowBracket = Math.min(Math.max(0, row.taxable_income), 3_000_000_000);
  const highBracket = Math.max(0, row.taxable_income - 3_000_000_000);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <FileBarChart2 className="w-6 h-6" /> ААНОАТ тайлан — {year} он
        </h1>
        <p className="text-sm text-slate-500">Аж ахуйн нэгжийн орлогын албан татвар</p>
      </div>

      <form method="GET" className="flex items-center gap-2">
        <label className="text-xs text-slate-500">Жил:</label>
        <input type="number" name="year" defaultValue={year} className="px-2 py-1.5 border border-slate-300 rounded text-xs w-24" />
        <button className="px-3 py-1.5 bg-slate-700 text-white rounded text-xs">Үзэх</button>
      </form>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="px-5 py-3 text-sm">Нийт орлого</td>
              <td className="px-5 py-3 font-mono text-right">₮{fmtMoney(row.total_income)}</td>
            </tr>
            <tr>
              <td className="px-5 py-3 text-sm">Нийт зардал (хасах)</td>
              <td className="px-5 py-3 font-mono text-right text-red-600">−₮{fmtMoney(row.total_expense)}</td>
            </tr>
            <tr className="bg-slate-50 font-semibold">
              <td className="px-5 py-3 text-sm uppercase">Татвар ногдох орлого</td>
              <td className="px-5 py-3 font-mono text-right">₮{fmtMoney(row.taxable_income)}</td>
            </tr>
            <tr>
              <td className="px-5 py-3 text-sm">10% (≤ 3 тэрбум)</td>
              <td className="px-5 py-3 font-mono text-right">₮{fmtMoney(lowBracket * 0.10)}</td>
            </tr>
            {highBracket > 0 && (
              <tr>
                <td className="px-5 py-3 text-sm">25% (3 тэрбумаас дээш ₮{fmtMoney(highBracket)})</td>
                <td className="px-5 py-3 font-mono text-right">₮{fmtMoney(highBracket * 0.25)}</td>
              </tr>
            )}
            <tr className="bg-blue-100 font-bold">
              <td className="px-5 py-3 text-base uppercase">ААНОАТ нийт</td>
              <td className="px-5 py-3 font-mono text-right text-lg">₮{fmtMoney(row.cit_amount)}</td>
            </tr>
            <tr>
              <td className="px-5 py-3 text-sm">Үр дүнтэй татварын хувь</td>
              <td className="px-5 py-3 font-mono text-right">{fmtPct(row.effective_rate)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

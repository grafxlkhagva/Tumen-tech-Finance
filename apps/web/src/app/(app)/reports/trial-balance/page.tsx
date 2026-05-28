import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Calculator } from "lucide-react";
import { fmtMoneyOrDash, fmtMoney } from "@/lib/format";
import { ACCOUNT_TYPE, type AccountType } from "@/lib/i18n/labels";

export const metadata = { title: "Шалгах баланс — Тумэн Accounting" };

export default async function TrialBalancePage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("v_trial_balance")
    .select("account_id, code, name, type, debit_balance, credit_balance")
    .order("code");

  const filteredRows = (rows ?? []).filter((r) => Number(r.debit_balance) > 0 || Number(r.credit_balance) > 0);
  const totalDr = filteredRows.reduce((s, r) => s + Number(r.debit_balance ?? 0), 0);
  const totalCr = filteredRows.reduce((s, r) => s + Number(r.credit_balance ?? 0), 0);
  const diff = totalDr - totalCr;
  const balanced = Math.abs(diff) < 0.01;

  // Group by type for visual sections
  const groups = new Map<AccountType, typeof filteredRows>();
  for (const r of filteredRows) {
    const t = r.type as AccountType;
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t)!.push(r);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <Calculator className="w-6 h-6" /> Шалгах баланс
        </h1>
        <p className="text-sm text-slate-500">Бүх posted journal-аас тооцоолсон балансууд</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Код</th>
              <th className="px-4 py-2 text-left">Дансны нэр</th>
              <th className="px-4 py-2 text-right">Дебит</th>
              <th className="px-4 py-2 text-right">Кредит</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(["asset", "liability", "equity", "income", "expense"] as AccountType[]).map((t) => {
              const items = groups.get(t) ?? [];
              if (items.length === 0) return null;
              const subDr = items.reduce((s, r) => s + Number(r.debit_balance ?? 0), 0);
              const subCr = items.reduce((s, r) => s + Number(r.credit_balance ?? 0), 0);
              return (
                <>
                  <tr key={`sect-${t}`} className="bg-slate-50">
                    <td colSpan={4} className="px-4 py-1.5 text-xs uppercase font-semibold text-slate-600">
                      {ACCOUNT_TYPE[t]}
                    </td>
                  </tr>
                  {items.map((r) => (
                    <tr key={r.account_id} className="hover:bg-slate-50">
                      <td className="px-4 py-1.5 font-mono text-xs text-slate-700">
                        <Link href={`/reports/ledger?account_id=${r.account_id}`} className="text-blue-600 hover:underline">
                          {r.code}
                        </Link>
                      </td>
                      <td className="px-4 py-1.5 text-xs">{r.name}</td>
                      <td className="px-4 py-1.5 font-mono text-right text-xs">{fmtMoneyOrDash(r.debit_balance)}</td>
                      <td className="px-4 py-1.5 font-mono text-right text-xs">{fmtMoneyOrDash(r.credit_balance)}</td>
                    </tr>
                  ))}
                  <tr key={`sub-${t}`} className="bg-slate-50/50 font-semibold">
                    <td colSpan={2} className="px-4 py-1.5 text-right text-xs uppercase">Дэд нийт</td>
                    <td className="px-4 py-1.5 font-mono text-right text-xs">{fmtMoney(subDr)}</td>
                    <td className="px-4 py-1.5 font-mono text-right text-xs">{fmtMoney(subCr)}</td>
                  </tr>
                </>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-100 font-semibold">
            <tr>
              <td colSpan={2} className="px-4 py-3 text-right uppercase text-xs">НИЙТ</td>
              <td className="px-4 py-3 font-mono text-right">₮{fmtMoney(totalDr)}</td>
              <td className="px-4 py-3 font-mono text-right">₮{fmtMoney(totalCr)}</td>
            </tr>
            <tr className={balanced ? "bg-green-50" : "bg-red-50"}>
              <td colSpan={2} className="px-4 py-2 text-right uppercase text-xs">
                {balanced ? "✓ БАЛАНСТАЙ" : "⚠ ЗӨРҮҮ"}
              </td>
              <td colSpan={2} className={`px-4 py-2 font-mono text-right ${balanced ? "text-green-700" : "text-red-700"}`}>
                ₮{fmtMoney(diff)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

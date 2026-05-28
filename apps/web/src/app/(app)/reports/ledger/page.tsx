import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ScrollText, ArrowLeft } from "lucide-react";
import { fmtDate, fmtMoney } from "@/lib/format";

export const metadata = { title: "Дансны хөдөлгөөн — Тумэн Accounting" };

type SearchParams = Promise<{ account_id?: string; from?: string; to?: string }>;

export default async function LedgerPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name, type")
    .is("deleted_at", null)
    .eq("is_postable", true)
    .order("code");

  let lines: Array<{ line_id: string; journal_id: string; journal_number: string; date: string; description: string | null; partner_name: string | null; debit: number; credit: number; running_balance: number }> = [];
  let selectedAcc: { code: string; name: string; type: string } | null = null;

  if (sp.account_id) {
    const acc = (accounts ?? []).find((a) => a.id === sp.account_id);
    if (acc) selectedAcc = acc;

    const { data } = await supabase.rpc("account_drilldown", {
      p_account_id: sp.account_id,
      p_from: sp.from ?? null,
      p_to: sp.to ?? null,
    });
    lines = (data ?? []) as typeof lines;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <ScrollText className="w-6 h-6" /> Дансны хөдөлгөөн
        </h1>
        <p className="text-sm text-slate-500">Данс сонгож, тухайн дансны posted гүйлгээний дэлгэрэнгүйг харах</p>
      </div>

      <form method="GET" className="bg-white border border-slate-200 rounded p-3 flex flex-wrap gap-2 items-center text-sm">
        <select name="account_id" defaultValue={sp.account_id ?? ""} className="px-2 py-1.5 border border-slate-300 rounded text-xs bg-white min-w-[300px]">
          <option value="">— Данс сонгох —</option>
          {(accounts ?? []).map((a) => (
            <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={sp.from ?? ""} className="px-2 py-1.5 border border-slate-300 rounded text-xs" />
        <span className="text-xs text-slate-500">→</span>
        <input type="date" name="to" defaultValue={sp.to ?? ""} className="px-2 py-1.5 border border-slate-300 rounded text-xs" />
        <button className="px-3 py-1.5 bg-slate-700 text-white rounded text-xs">Үзэх</button>
      </form>

      {selectedAcc && (
        <div className="bg-slate-50 border border-slate-200 rounded p-3">
          <span className="font-mono text-sm text-slate-600">{selectedAcc.code}</span>
          <span className="font-semibold text-sm ml-2">{selectedAcc.name}</span>
        </div>
      )}

      {selectedAcc && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Огноо</th>
                <th className="px-3 py-2 text-left">Журнал №</th>
                <th className="px-3 py-2 text-left">Тайлбар</th>
                <th className="px-3 py-2 text-left">Харилцагч</th>
                <th className="px-3 py-2 text-right">Дебит</th>
                <th className="px-3 py-2 text-right">Кредит</th>
                <th className="px-3 py-2 text-right">Үлдэгдэл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l) => (
                <tr key={l.line_id} className="hover:bg-slate-50">
                  <td className="px-3 py-1.5 text-xs">{fmtDate(l.date)}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">
                    <Link href={`/journals/${l.journal_id}`} className="text-blue-600 hover:underline">{l.journal_number}</Link>
                  </td>
                  <td className="px-3 py-1.5 text-xs text-slate-600 truncate max-w-md">{l.description || "—"}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-500">{l.partner_name || "—"}</td>
                  <td className="px-3 py-1.5 font-mono text-right text-xs">{Number(l.debit) > 0 ? fmtMoney(l.debit) : "—"}</td>
                  <td className="px-3 py-1.5 font-mono text-right text-xs">{Number(l.credit) > 0 ? fmtMoney(l.credit) : "—"}</td>
                  <td className="px-3 py-1.5 font-mono text-right text-xs font-semibold">{fmtMoney(l.running_balance)}</td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-slate-400">Гүйлгээ алга</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

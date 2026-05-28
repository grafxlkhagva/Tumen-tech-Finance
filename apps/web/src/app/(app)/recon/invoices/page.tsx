import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Link2 } from "lucide-react";
import { fmtMoney } from "@/lib/format";
import { ToastFromURL } from "@/components/ui/Toast";
import { AutoMatchPartner } from "./AutoMatchPartner";

export const metadata = { title: "Нэхэмж ↔ Банк тулгалт — Тумэн Accounting" };

export default async function InvoiceReconPage() {
  const supabase = await createClient();

  // Partners with open AR + unreconciled cash
  const { data: partners } = await supabase
    .from("partners")
    .select("id, name, register")
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("name");

  // Open AR per partner
  const partnerIds = (partners ?? []).map((p) => p.id);
  const { data: openReceivables } = await supabase
    .from("v_partner_balance")
    .select("partner_id, open_receivables, open_receivable_count")
    .in("partner_id", partnerIds);

  type Row = { id: string; name: string; register: string | null; open_ar: number; open_count: number; cash_count: number };
  const map = new Map<string, Row>();
  for (const p of partners ?? []) {
    map.set(p.id, { id: p.id, name: p.name, register: p.register, open_ar: 0, open_count: 0, cash_count: 0 });
  }
  for (const b of openReceivables ?? []) {
    const r = map.get(b.partner_id!);
    if (r) {
      r.open_ar = Number(b.open_receivables ?? 0);
      r.open_count = b.open_receivable_count ?? 0;
    }
  }

  // Unreconciled cash count per partner
  const { data: unreconciledCash } = await supabase
    .from("cash_transactions")
    .select("partner_id")
    .is("deleted_at", null)
    .eq("direction", "income")
    .eq("is_reconciled", false)
    .not("partner_id", "is", null);
  for (const c of unreconciledCash ?? []) {
    if (!c.partner_id) continue;
    const r = map.get(c.partner_id);
    if (r) r.cash_count += 1;
  }

  const list = Array.from(map.values())
    .filter((r) => r.open_ar > 0 || r.cash_count > 0)
    .sort((a, b) => b.open_ar - a.open_ar);

  return (
    <div className="space-y-4">
      <ToastFromURL />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <Link2 className="w-6 h-6" /> Нэхэмж ↔ Банк тулгалт
        </h1>
        <p className="text-sm text-slate-500">Харилцагчийн нээлттэй авлагуудыг банкны орлоготой автоматаар тулгана.</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Харилцагч</th>
              <th className="px-3 py-2 text-right">Нээлттэй авлага</th>
              <th className="px-3 py-2 text-center">Тулгаагүй касс</th>
              <th className="px-3 py-2 text-right w-44">Үйлдэл</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-xs">
                  <Link href={`/partners/${r.id}`} className="text-blue-600 hover:underline font-medium">{r.name}</Link>
                  {r.register && <div className="text-[0.65rem] text-slate-400 font-mono">{r.register}</div>}
                </td>
                <td className="px-3 py-2 font-mono text-right text-xs">
                  ₮{fmtMoney(r.open_ar)}
                  <div className="text-[0.65rem] text-slate-400">{r.open_count} нэхэмжлэх</div>
                </td>
                <td className="px-3 py-2 text-center text-xs">
                  {r.cash_count > 0 ? <span className="text-orange-600 font-semibold">{r.cash_count}</span> : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.open_ar > 0 && r.cash_count > 0 && <AutoMatchPartner partnerId={r.id} />}
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-400">Тулгах ажил алга</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { fmtDate, fmtMoney } from "@/lib/format";
import { PrintButton } from "@/components/ui/PrintButton";
import { AR_AP_STATUS, type ArApStatus } from "@/lib/i18n/labels";

export const metadata = { title: "Т-2 — Тумэн Accounting" };

export default async function T2Page() {
  const supabase = await createClient();

  const [recvRes, payRes] = await Promise.all([
    supabase
      .from("receivables")
      .select("invoice_no, invoice_date, due_date, total_amount, paid_amount, remaining, status, partner:partners(name)")
      .is("deleted_at", null)
      .neq("status", "paid")
      .neq("status", "cancelled")
      .order("invoice_date")
      .limit(500),
    supabase
      .from("payables")
      .select("invoice_no, invoice_date, due_date, total_amount, paid_amount, remaining, status, partner:partners(name)")
      .is("deleted_at", null)
      .neq("status", "paid")
      .neq("status", "cancelled")
      .order("invoice_date")
      .limit(500),
  ]);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/forms" className="text-xs text-slate-500 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Маягтуудад буцах
        </Link>
        <PrintButton />
      </div>

      <div className="bg-white border border-slate-200 rounded p-8 print:border-0 print:shadow-none">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold uppercase tracking-wider">Т-2 маягт</h1>
          <div className="text-sm text-slate-600 mt-1">Авлага/Өглөгийн дэлгэрэнгүй жагсаалт</div>
        </div>

        <h2 className="text-sm font-semibold mb-2 mt-4">АВЛАГА</h2>
        <table className="w-full text-xs border border-slate-300 mb-6">
          <thead className="bg-blue-50">
            <tr>
              <th className="border border-slate-300 px-2 py-1.5 text-left">Нэхэмж №</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left">Огноо</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left">Хугацаа</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left">Харилцагч</th>
              <th className="border border-slate-300 px-2 py-1.5 text-right">Нийт</th>
              <th className="border border-slate-300 px-2 py-1.5 text-right">Төлсөн</th>
              <th className="border border-slate-300 px-2 py-1.5 text-right">Үлдэгдэл</th>
              <th className="border border-slate-300 px-2 py-1.5 text-center">Статус</th>
            </tr>
          </thead>
          <tbody>
            {(recvRes.data ?? []).map((r, i) => {
              const p = Array.isArray(r.partner) ? r.partner[0] : r.partner;
              return (
                <tr key={i}>
                  <td className="border border-slate-300 px-2 py-1 font-mono">{r.invoice_no || "—"}</td>
                  <td className="border border-slate-300 px-2 py-1">{fmtDate(r.invoice_date)}</td>
                  <td className="border border-slate-300 px-2 py-1">{fmtDate(r.due_date)}</td>
                  <td className="border border-slate-300 px-2 py-1">{p?.name ?? "—"}</td>
                  <td className="border border-slate-300 px-2 py-1 font-mono text-right">{fmtMoney(r.total_amount)}</td>
                  <td className="border border-slate-300 px-2 py-1 font-mono text-right">{fmtMoney(r.paid_amount)}</td>
                  <td className="border border-slate-300 px-2 py-1 font-mono text-right">{fmtMoney(r.remaining)}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">{AR_AP_STATUS[r.status as ArApStatus]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h2 className="text-sm font-semibold mb-2">ӨГЛӨГ</h2>
        <table className="w-full text-xs border border-slate-300">
          <thead className="bg-orange-50">
            <tr>
              <th className="border border-slate-300 px-2 py-1.5 text-left">Нэхэмж №</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left">Огноо</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left">Хугацаа</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left">Нийлүүлэгч</th>
              <th className="border border-slate-300 px-2 py-1.5 text-right">Нийт</th>
              <th className="border border-slate-300 px-2 py-1.5 text-right">Төлсөн</th>
              <th className="border border-slate-300 px-2 py-1.5 text-right">Үлдэгдэл</th>
              <th className="border border-slate-300 px-2 py-1.5 text-center">Статус</th>
            </tr>
          </thead>
          <tbody>
            {(payRes.data ?? []).map((r, i) => {
              const p = Array.isArray(r.partner) ? r.partner[0] : r.partner;
              return (
                <tr key={i}>
                  <td className="border border-slate-300 px-2 py-1 font-mono">{r.invoice_no || "—"}</td>
                  <td className="border border-slate-300 px-2 py-1">{fmtDate(r.invoice_date)}</td>
                  <td className="border border-slate-300 px-2 py-1">{fmtDate(r.due_date)}</td>
                  <td className="border border-slate-300 px-2 py-1">{p?.name ?? "—"}</td>
                  <td className="border border-slate-300 px-2 py-1 font-mono text-right">{fmtMoney(r.total_amount)}</td>
                  <td className="border border-slate-300 px-2 py-1 font-mono text-right">{fmtMoney(r.paid_amount)}</td>
                  <td className="border border-slate-300 px-2 py-1 font-mono text-right">{fmtMoney(r.remaining)}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">{AR_AP_STATUS[r.status as ArApStatus]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style>{`@media print { @page { size: landscape; margin: 1cm; } body { background: white; } }`}</style>
    </div>
  );
}

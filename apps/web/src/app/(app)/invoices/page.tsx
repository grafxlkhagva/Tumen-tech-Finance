import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { fmtDate, fmtMoney, fmtPct } from "@/lib/format";
import { ToastFromURL } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { AR_AP_STATUS, AR_AP_STATUS_COLOR, type ArApStatus } from "@/lib/i18n/labels";

export const metadata = { title: "Нэхэмжлэхийн тайлан — Тумэн Accounting" };

export default async function InvoicesReportPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("receivables")
    .select("id, invoice_no, invoice_date, total_amount, paid_amount, remaining, status, partner:partners(id, name)")
    .is("deleted_at", null)
    .order("invoice_date", { ascending: false });

  const rows = data ?? [];

  // KPIs
  const totalBilled = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const totalCollected = rows.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
  const totalOutstanding = rows.reduce((s, r) => s + Number(r.remaining || 0), 0);
  const collectionPct = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

  return (
    <div className="space-y-4">
      <ToastFromURL />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <ReceiptText className="w-6 h-6" /> Нэхэмжлэхийн тайлан
        </h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded p-4">
          <div className="text-xs text-slate-500">Нийт нэхэмжилсэн</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">₮{fmtMoney(totalBilled)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded p-4">
          <div className="text-xs text-slate-500">Цугласан</div>
          <div className="text-2xl font-bold text-green-700 mt-1 font-mono">₮{fmtMoney(totalCollected)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded p-4">
          <div className="text-xs text-slate-500">Үлдэгдэл авлага</div>
          <div className="text-2xl font-bold text-orange-600 mt-1 font-mono">₮{fmtMoney(totalOutstanding)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded p-4">
          <div className="text-xs text-slate-500">Цуглуулалтын хувь</div>
          <div className="text-2xl font-bold text-blue-700 mt-1">{fmtPct(collectionPct)}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Нэхэмж №</th>
              <th className="px-3 py-2 text-left">Огноо</th>
              <th className="px-3 py-2 text-left">Харилцагч</th>
              <th className="px-3 py-2 text-right">Дүн</th>
              <th className="px-3 py-2 text-right">Төлсөн</th>
              <th className="px-3 py-2 text-right">Үлдэгдэл</th>
              <th className="px-3 py-2 text-center">Статус</th>
              <th className="px-3 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice(0, 200).map((r) => {
              const p = Array.isArray(r.partner) ? r.partner[0] : r.partner;
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">{r.invoice_no || "—"}</td>
                  <td className="px-3 py-2 text-xs">{fmtDate(r.invoice_date)}</td>
                  <td className="px-3 py-2 text-xs">{p?.name ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-right text-xs">{fmtMoney(r.total_amount)}</td>
                  <td className="px-3 py-2 font-mono text-right text-xs text-green-700">{fmtMoney(r.paid_amount)}</td>
                  <td className="px-3 py-2 font-mono text-right text-xs font-semibold">{fmtMoney(r.remaining)}</td>
                  <td className="px-3 py-2 text-center">
                    <Badge color={AR_AP_STATUS_COLOR[r.status as ArApStatus]}>{AR_AP_STATUS[r.status as ArApStatus]}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <Link href={`/invoices/${r.id}/print`} target="_blank" className="text-blue-600 hover:underline">Хэвлэх</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

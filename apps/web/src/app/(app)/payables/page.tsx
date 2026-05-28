import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Wallet, Plus } from "lucide-react";
import { fmtDate, fmtMoney } from "@/lib/format";
import { Pagination } from "@/components/ui/Pagination";
import { ToastFromURL } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { AR_AP_STATUS, AR_AP_STATUS_COLOR, type ArApStatus } from "@/lib/i18n/labels";

export const metadata = { title: "Өглөг — Тумэн Accounting" };

const PAGE_SIZE = 50;

type SearchParams = Promise<{ page?: string; status?: string }>;

export default async function PayablesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const pageNum = Math.max(1, parseInt(sp.page || "1", 10));
  const offset = (pageNum - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let q = supabase
    .from("payables")
    .select("id, invoice_no, invoice_date, due_date, amount, vat_amount, total_amount, paid_amount, remaining, status, partner:partners(id, name)", { count: "exact" })
    .is("deleted_at", null)
    .order("invoice_date", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (sp.status) {
    q = q.eq("status", sp.status as "draft" | "open" | "partial" | "paid" | "overdue" | "cancelled" | "written_off");
  }

  const { data: rows, count } = await q;
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  const totals = (rows ?? []).reduce(
    (acc, r) => {
      acc.total += Number(r.total_amount || 0);
      acc.paid += Number(r.paid_amount || 0);
      acc.remaining += Number(r.remaining || 0);
      return acc;
    },
    { total: 0, paid: 0, remaining: 0 },
  );

  return (
    <div className="space-y-4">
      <ToastFromURL />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Wallet className="w-6 h-6" /> Өглөг
          </h1>
          <p className="text-sm text-slate-500">
            {count ?? 0} нэхэмжлэл · Нийт <span className="font-mono">{fmtMoney(totals.total)}</span> · Төлсөн <span className="font-mono">{fmtMoney(totals.paid)}</span> · Үлдэгдэл <span className="font-mono">{fmtMoney(totals.remaining)}</span>
          </p>
        </div>
        <Link href="/payables/new" className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded text-sm font-medium flex items-center gap-2">
          <Plus className="w-4 h-4" /> Шинэ өглөг
        </Link>
      </div>

      <div className="flex gap-2 text-xs">
        <Link href="/payables" className={`px-3 py-1 rounded ${!sp.status ? "bg-slate-900 text-white" : "bg-white border border-slate-200 hover:bg-slate-50"}`}>Бүгд</Link>
        {Object.entries(AR_AP_STATUS).map(([v, l]) => (
          <Link key={v} href={`/payables?status=${v}`} className={`px-3 py-1 rounded ${sp.status === v ? "bg-slate-900 text-white" : "bg-white border border-slate-200 hover:bg-slate-50"}`}>{l}</Link>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Нэхэмж №</th>
              <th className="px-3 py-2 text-left">Огноо</th>
              <th className="px-3 py-2 text-left">Хугацаа</th>
              <th className="px-3 py-2 text-left">Нийлүүлэгч</th>
              <th className="px-3 py-2 text-right">Нийт</th>
              <th className="px-3 py-2 text-right">Төлсөн</th>
              <th className="px-3 py-2 text-right">Үлдэгдэл</th>
              <th className="px-3 py-2 text-center">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(rows ?? []).map((r) => {
              const partner = Array.isArray(r.partner) ? r.partner[0] : r.partner;
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">{r.invoice_no || "—"}</td>
                  <td className="px-3 py-2 text-xs">{fmtDate(r.invoice_date)}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{fmtDate(r.due_date)}</td>
                  <td className="px-3 py-2 text-xs">
                    {partner ? <Link href={`/partners/${partner.id}`} className="text-blue-600 hover:underline">{partner.name}</Link> : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-right text-xs">{fmtMoney(r.total_amount)}</td>
                  <td className="px-3 py-2 font-mono text-right text-xs text-green-700">{fmtMoney(r.paid_amount)}</td>
                  <td className="px-3 py-2 font-mono text-right text-xs font-semibold">{fmtMoney(r.remaining)}</td>
                  <td className="px-3 py-2 text-center">
                    <Badge color={AR_AP_STATUS_COLOR[r.status as ArApStatus]}>{AR_AP_STATUS[r.status as ArApStatus]}</Badge>
                  </td>
                </tr>
              );
            })}
            {(rows?.length ?? 0) === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-xs text-slate-400">Бичлэг олдсонгүй</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={pageNum} totalPages={totalPages} basePath="/payables" search={sp} />
    </div>
  );
}

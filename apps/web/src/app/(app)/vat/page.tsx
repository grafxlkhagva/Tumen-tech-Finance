import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Receipt, Plus, AlertTriangle } from "lucide-react";
import { fmtDate, fmtMoney } from "@/lib/format";
import { Pagination } from "@/components/ui/Pagination";
import { ToastFromURL } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { VAT_DIRECTION, VAT_STATUS, type VatDirection, type VatStatus } from "@/lib/i18n/labels";

export const metadata = { title: "НӨАТ бүртгэл — Тумэн Accounting" };

const PAGE_SIZE = 100;

type SearchParams = Promise<{
  page?: string;
  direction?: string;
  status?: string;
  month?: string;
}>;

export default async function VatPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const pageNum = Math.max(1, parseInt(sp.page || "1", 10));
  const offset = (pageNum - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let q = supabase
    .from("vat_records")
    .select("id, direction, tax_type, date, ddtd, invoice_no, partner_name, partner:partners(id, name), amount, vat_amount, total_amount, paid_amount, remaining, status, source", { count: "exact" })
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (sp.direction && ["inbound", "outbound"].includes(sp.direction)) {
    q = q.eq("direction", sp.direction as "inbound" | "outbound");
  }
  if (sp.status) {
    q = q.eq("status", sp.status as "pending" | "matched" | "reconciled" | "declared" | "cancelled");
  }
  if (sp.month) {
    const [y, m] = sp.month.split("-").map(Number);
    if (y && m) {
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      q = q.gte("date", start).lt("date", end);
    }
  }

  const { data: rows, count } = await q;
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  // Unmatched count
  const { count: unmatchedCount } = await supabase
    .from("vat_records")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("status", "pending");

  // Totals
  const totals = (rows ?? []).reduce(
    (acc, r) => {
      if (r.direction === "outbound") {
        acc.outAmount += Number(r.amount || 0);
        acc.outVat += Number(r.vat_amount || 0);
      } else {
        acc.inAmount += Number(r.amount || 0);
        acc.inVat += Number(r.vat_amount || 0);
      }
      return acc;
    },
    { outAmount: 0, outVat: 0, inAmount: 0, inVat: 0 },
  );

  return (
    <div className="space-y-4">
      <ToastFromURL />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Receipt className="w-6 h-6" /> НӨАТ бүртгэл
          </h1>
          <p className="text-sm text-slate-500">
            {count ?? 0} бичлэг · Борлуулалт: <span className="font-mono">{fmtMoney(totals.outAmount + totals.outVat)}</span> · Худалдан авалт: <span className="font-mono">{fmtMoney(totals.inAmount + totals.inVat)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {(unmatchedCount ?? 0) > 0 && (
            <Link
              href="/vat/unmatched"
              className="bg-yellow-100 border border-yellow-300 text-yellow-800 px-3 py-2 rounded text-sm flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" /> {unmatchedCount} тулгаагүй
            </Link>
          )}
          <Link
            href="/vat/batch-journal"
            className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 rounded text-sm font-medium flex items-center gap-2"
          >
            Багц нэхэмжлэл
          </Link>
          <Link
            href="/vat/new"
            className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded text-sm font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Шинэ НӨАТ
          </Link>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="bg-white border border-slate-200 rounded p-3 flex flex-wrap gap-2 items-center text-sm">
        <select name="direction" defaultValue={sp.direction ?? ""} className="px-2 py-1.5 border border-slate-300 rounded text-xs bg-white">
          <option value="">Бүгд</option>
          {Object.entries(VAT_DIRECTION).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="px-2 py-1.5 border border-slate-300 rounded text-xs bg-white">
          <option value="">Бүх статус</option>
          {Object.entries(VAT_STATUS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <input type="month" name="month" defaultValue={sp.month ?? ""} className="px-2 py-1.5 border border-slate-300 rounded text-xs" />
        <button type="submit" className="px-3 py-1.5 bg-slate-700 text-white rounded text-xs">Шүүх</button>
        {(sp.direction || sp.status || sp.month) && (
          <Link href="/vat" className="px-3 py-1.5 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50">Цэвэрлэх</Link>
        )}
      </form>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Огноо</th>
              <th className="px-3 py-2 text-left">Чиглэл</th>
              <th className="px-3 py-2 text-left">ДДТД / №</th>
              <th className="px-3 py-2 text-left">Харилцагч</th>
              <th className="px-3 py-2 text-right">Үнэ</th>
              <th className="px-3 py-2 text-right">НӨАТ</th>
              <th className="px-3 py-2 text-right">Нийт</th>
              <th className="px-3 py-2 text-center">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(rows ?? []).map((r) => {
              const partner = Array.isArray(r.partner) ? r.partner[0] : r.partner;
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-xs">{fmtDate(r.date)}</td>
                  <td className="px-3 py-2 text-xs">
                    <Badge color={r.direction === "outbound" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}>
                      {r.direction === "outbound" ? "Гарах" : "Орох"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.ddtd || r.invoice_no || "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {partner ? (
                      <Link href={`/partners/${partner.id}`} className="text-blue-600 hover:underline">
                        {partner.name}
                      </Link>
                    ) : (
                      <span className="text-slate-400 italic">{r.partner_name || "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-right text-xs">{fmtMoney(r.amount)}</td>
                  <td className="px-3 py-2 font-mono text-right text-xs text-slate-500">{fmtMoney(r.vat_amount)}</td>
                  <td className="px-3 py-2 font-mono text-right text-xs font-semibold">{fmtMoney(r.total_amount)}</td>
                  <td className="px-3 py-2 text-center">
                    <Badge color={
                      r.status === "matched" ? "bg-blue-100 text-blue-700"
                      : r.status === "reconciled" ? "bg-green-100 text-green-700"
                      : r.status === "declared" ? "bg-purple-100 text-purple-700"
                      : r.status === "pending" ? "bg-yellow-100 text-yellow-800"
                      : "bg-slate-100 text-slate-500"
                    }>{VAT_STATUS[r.status as VatStatus]}</Badge>
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

      <Pagination page={pageNum} totalPages={totalPages} basePath="/vat" search={sp} />
    </div>
  );
}

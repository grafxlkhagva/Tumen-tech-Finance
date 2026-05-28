import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { FileText, Plus, Download } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/format";
import { JOURNAL_STATUS, JOURNAL_STATUS_COLOR, type JournalStatus } from "@/lib/i18n/labels";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { ToastFromURL } from "@/components/ui/Toast";

type SearchParams = Promise<{ status?: string; page?: string }>;

const PAGE_SIZE = 50;

export default async function JournalsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { status, page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page || "1", 10));
  const offset = (pageNum - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let q = supabase
    .from("journals")
    .select("id, number, date, description, reference, status, source, total_debit", { count: "exact" })
    .order("date", { ascending: false })
    .order("number", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (status && ["draft", "posted", "reversed"].includes(status)) {
    q = q.eq("status", status);
  }

  const { data: journals, count } = await q;
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <ToastFromURL />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6" /> Гүйлгээний бүртгэл
          </h1>
          <p className="text-sm text-slate-500">Нийт {count ?? 0} бичлэг</p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/export/journals${status ? `?status=${status}` : ""}`} className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 rounded text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> Excel
          </a>
          <Link
            href="/journals/new"
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Шинэ гүйлгээ
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 text-xs">
        <Link
          href="/journals"
          className={`px-3 py-1 rounded ${!status ? "bg-slate-900 text-white" : "bg-white border border-slate-200 hover:bg-slate-50"}`}
        >Бүгд</Link>
        <Link
          href="/journals?status=posted"
          className={`px-3 py-1 rounded ${status === "posted" ? "bg-green-600 text-white" : "bg-white border border-slate-200 hover:bg-slate-50"}`}
        >Posted</Link>
        <Link
          href="/journals?status=draft"
          className={`px-3 py-1 rounded ${status === "draft" ? "bg-slate-600 text-white" : "bg-white border border-slate-200 hover:bg-slate-50"}`}
        >Draft</Link>
        <Link
          href="/journals?status=reversed"
          className={`px-3 py-1 rounded ${status === "reversed" ? "bg-red-600 text-white" : "bg-white border border-slate-200 hover:bg-slate-50"}`}
        >Reversed</Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Дугаар</th>
              <th className="px-4 py-2 text-left">Огноо</th>
              <th className="px-4 py-2 text-left">Тайлбар</th>
              <th className="px-4 py-2 text-left">Эх сурвалж</th>
              <th className="px-4 py-2 text-right">Дүн (₮)</th>
              <th className="px-4 py-2 text-center">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(journals ?? []).map((j) => (
              <tr key={j.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-xs">
                  <Link href={`/journals/${j.id}`} className="text-blue-600 hover:underline">
                    {j.number}
                  </Link>
                </td>
                <td className="px-4 py-2 text-xs text-slate-600">{fmtDate(j.date)}</td>
                <td className="px-4 py-2 text-xs">
                  <Link href={`/journals/${j.id}`} className="hover:underline">
                    <div className="truncate max-w-md" title={j.description ?? ""}>
                      {j.description || "—"}
                    </div>
                  </Link>
                  {j.reference && <div className="text-[0.65rem] text-slate-400 font-mono">{j.reference}</div>}
                </td>
                <td className="px-4 py-2 text-[0.7rem] uppercase text-slate-500">{j.source}</td>
                <td className="px-4 py-2 font-mono text-right text-xs">{fmtMoney(Number(j.total_debit))}</td>
                <td className="px-4 py-2 text-center">
                  <Badge color={JOURNAL_STATUS_COLOR[j.status as JournalStatus]}>
                    {JOURNAL_STATUS[j.status as JournalStatus]}
                  </Badge>
                </td>
              </tr>
            ))}
            {(journals?.length ?? 0) === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-xs">
                Бичлэг олдсонгүй
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={pageNum}
        totalPages={totalPages}
        basePath="/journals"
        search={{ status }}
      />
    </div>
  );
}

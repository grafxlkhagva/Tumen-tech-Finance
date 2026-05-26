import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { FileText } from "lucide-react";

function fmtMoney(n: number | null | undefined) {
  return new Intl.NumberFormat("mn-MN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0);
}

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6" /> Журналууд
          </h1>
          <p className="text-sm text-slate-500">Нийт {count ?? 0} бичлэг</p>
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
                <td className="px-4 py-2 font-mono text-xs">{j.number}</td>
                <td className="px-4 py-2 text-xs text-slate-600">{j.date}</td>
                <td className="px-4 py-2 text-xs">
                  <div className="truncate max-w-md" title={j.description ?? ""}>
                    {j.description || "—"}
                  </div>
                  {j.reference && <div className="text-[0.65rem] text-slate-400 font-mono">{j.reference}</div>}
                </td>
                <td className="px-4 py-2 text-[0.7rem] uppercase text-slate-500">{j.source}</td>
                <td className="px-4 py-2 font-mono text-right text-xs">{fmtMoney(Number(j.total_debit))}</td>
                <td className="px-4 py-2 text-center">
                  <span className={`inline-block px-2 py-0.5 text-[0.65rem] uppercase rounded font-semibold ${
                    j.status === "posted" ? "bg-green-100 text-green-700"
                    : j.status === "draft" ? "bg-slate-200 text-slate-700"
                    : "bg-red-100 text-red-700"
                  }`}>{j.status}</span>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div>Хуудас {pageNum} / {totalPages}</div>
          <div className="flex gap-1">
            {pageNum > 1 && (
              <Link href={`/journals?${status ? `status=${status}&` : ""}page=${pageNum - 1}`}
                className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50">
                ← Өмнөх
              </Link>
            )}
            {pageNum < totalPages && (
              <Link href={`/journals?${status ? `status=${status}&` : ""}page=${pageNum + 1}`}
                className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50">
                Дараах →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

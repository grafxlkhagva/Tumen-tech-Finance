import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Pencil } from "lucide-react";
import { fmtDate, fmtMoney, fmtRelative } from "@/lib/format";
import { JOURNAL_STATUS, JOURNAL_STATUS_COLOR, JOURNAL_SOURCE, type JournalStatus, type JournalSource } from "@/lib/i18n/labels";
import { Badge } from "@/components/ui/Badge";
import { ToastFromURL } from "@/components/ui/Toast";
import { JournalActions } from "./JournalActions";

export const metadata = { title: "Гүйлгээ — Тумэн Accounting" };

type RouteParams = Promise<{ id: string }>;

export default async function JournalDetailPage({
  params,
}: {
  params: RouteParams;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [journalResult, linesResult] = await Promise.all([
    supabase
      .from("journals")
      .select("id, number, date, reference, description, status, source, source_ref, total_debit, total_credit, posted_at, reversed_at, reversed_by_journal_id, reversal_reason, notes, created_at, updated_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("journal_lines")
      .select("id, line_no, debit, credit, description, account:accounts(id, code, name), partner:partners(id, name, register)")
      .eq("journal_id", id)
      .order("line_no"),
  ]);

  if (!journalResult.data) notFound();
  const j = journalResult.data;
  const lines = linesResult.data ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <ToastFromURL />

      <Link href="/journals" className="text-xs text-slate-500 hover:underline flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Журналуудад буцах
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6" />
            <span className="font-mono">{j.number}</span>
            <Badge color={JOURNAL_STATUS_COLOR[j.status as JournalStatus]}>
              {JOURNAL_STATUS[j.status as JournalStatus]}
            </Badge>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {fmtDate(j.date)} · {JOURNAL_SOURCE[j.source as JournalSource]}
            {j.posted_at && <> · Баталсан: {fmtRelative(j.posted_at)}</>}
          </p>
        </div>
        <div className="flex gap-2">
          {j.status === "draft" && (
            <Link
              href={`/journals/${j.id}/edit`}
              className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-sm flex items-center gap-1"
            >
              <Pencil className="w-3.5 h-3.5" /> Засах
            </Link>
          )}
          <JournalActions
            id={j.id}
            status={j.status as JournalStatus}
            reversedByJournalId={j.reversed_by_journal_id}
          />
        </div>
      </div>

      {/* Header info */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-xs text-slate-500">Огноо</div>
          <div className="font-medium">{fmtDate(j.date)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Лавлагаа</div>
          <div className="font-mono text-xs">{j.reference || "—"}</div>
        </div>
        <div className="col-span-2">
          <div className="text-xs text-slate-500">Тайлбар</div>
          <div>{j.description || "—"}</div>
        </div>
      </div>

      {/* Lines */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left w-8">#</th>
              <th className="px-3 py-2 text-left">Данс</th>
              <th className="px-3 py-2 text-left">Харилцагч</th>
              <th className="px-3 py-2 text-right">Дебит</th>
              <th className="px-3 py-2 text-right">Кредит</th>
              <th className="px-3 py-2 text-left">Тайлбар</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l) => {
              const account = Array.isArray(l.account) ? l.account[0] : l.account;
              const partner = Array.isArray(l.partner) ? l.partner[0] : l.partner;
              return (
                <tr key={l.id}>
                  <td className="px-3 py-2 text-xs text-slate-400">{l.line_no}</td>
                  <td className="px-3 py-2">
                    {account && (
                      <span>
                        <span className="font-mono text-xs text-slate-600">{account.code}</span>{" "}
                        <span>{account.name}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {partner?.name || "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-right">
                    {Number(l.debit) > 0 ? fmtMoney(l.debit) : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-right">
                    {Number(l.credit) > 0 ? fmtMoney(l.credit) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{l.description || "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-100 font-semibold">
            <tr>
              <td colSpan={3} className="px-3 py-2 text-right text-xs uppercase">Нийт</td>
              <td className="px-3 py-2 font-mono text-right">{fmtMoney(j.total_debit)}</td>
              <td className="px-3 py-2 font-mono text-right">{fmtMoney(j.total_credit)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {j.reversed_at && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm">
          <strong>Буцаагдсан:</strong> {fmtDate(j.reversed_at)}
          {j.reversal_reason && <> · {j.reversal_reason}</>}
          {j.reversed_by_journal_id && (
            <>
              {" · "}
              <Link href={`/journals/${j.reversed_by_journal_id}`} className="text-blue-600 hover:underline">
                Буцаалтын журналыг харах →
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

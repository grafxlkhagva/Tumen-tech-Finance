"use client";

import { useActionState } from "react";
import { FileUp, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { importBankStatement, type ImportState } from "../actions";

type Bank = { id: string; name: string };

function fmt(n: number): string {
  return n.toLocaleString("mn-MN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ImportForm({ banks }: { banks: Bank[] }) {
  const [state, formAction, pending] = useActionState<ImportState | undefined, FormData>(
    importBankStatement,
    undefined,
  );

  const preview = state && "phase" in state && state.phase === "preview" ? state : null;
  const done = state && "phase" in state && state.phase === "done" ? state : null;
  const error = state && "error" in state ? state.error : null;

  return (
    <form action={formAction} className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Банк</label>
          <select
            name="bank_account_id"
            required
            defaultValue={preview?.bankAccountId ?? ""}
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <option value="" disabled>
              — Банк сонгох —
            </option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Хуулга файл (.xls / .xlsx)
          </label>
          <input
            type="file"
            name="file"
            accept=".xls,.xlsx"
            required
            className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-slate-900 file:text-white file:text-sm hover:file:bg-slate-700"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm rounded hover:bg-slate-700 disabled:opacity-60"
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
          Урьдчилж харах
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
          {error}
        </div>
      )}

      {done && (
        <div className="px-4 py-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          {done.inserted} гүйлгээ нэмэгдлээ. {done.skipped} мөр алгасагдсан (давхцсан/орсон).
        </div>
      )}

      {preview && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Нийт мөр" value={String(preview.summary.total)} />
            <Stat label="Шинэ" value={String(preview.summary.newCount)} tone="green" />
            <Stat label="Давхцсан" value={String(preview.summary.overlapCount)} tone="amber" />
            <Stat
              label="Огнооны муж"
              value={
                preview.summary.dateFrom
                  ? `${preview.summary.dateFrom} … ${preview.summary.dateTo}`
                  : "—"
              }
            />
          </div>

          {/* Overlap warning */}
          {preview.overlap.has ? (
            <div className="px-4 py-3 bg-amber-50 border border-amber-300 text-amber-800 text-sm rounded flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Давхцсан гүйлгээ илэрлээ.</p>
                <p className="mt-0.5">
                  Энэ банкны хамгийн сүүлд оруулсан огноо{" "}
                  <span className="font-mono">{preview.overlap.latest}</span>. Үүнтэй тэнцүү/өмнөх{" "}
                  {preview.summary.overlapCount} мөр аль хэдийн орсон байж магадгүй — хуулгаа давхар
                  татсан эсэхээ шалгана уу. Үргэлжлүүлбэл зөвхөн{" "}
                  {preview.summary.newCount} шинэ мөр орж, давхцсаныг алгасна.
                </p>
              </div>
            </div>
          ) : (
            <div className="px-4 py-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded">
              Давхцал илрээгүй. {preview.summary.newCount} мөр оруулна.
            </div>
          )}

          {/* Preview table */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Огноо</th>
                  <th className="px-3 py-2 text-left font-medium">Чиглэл</th>
                  <th className="px-3 py-2 text-right font-medium">Дүн</th>
                  <th className="px-3 py-2 text-left font-medium">Харилцагч</th>
                  <th className="px-3 py-2 text-left font-medium">Утга</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr
                    key={r.sourceRowNum}
                    className={`border-t border-slate-100 ${r.isOverlap ? "bg-amber-50/60 text-slate-400" : ""}`}
                  >
                    <td className="px-3 py-1.5 whitespace-nowrap font-mono">
                      {r.txnTimestamp ? r.txnTimestamp.slice(0, 16).replace("T", " ") : r.txnDate}
                    </td>
                    <td className="px-3 py-1.5">
                      {r.direction === "income" ? (
                        <span className="text-green-600">Орлого</span>
                      ) : (
                        <span className="text-red-600">Зарлага</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">{fmt(r.amount)}</td>
                    <td className="px-3 py-1.5">{r.partnerName ?? "—"}</td>
                    <td className="px-3 py-1.5 max-w-xs truncate">{r.description ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.summary.total > preview.rows.length && (
              <div className="px-3 py-2 text-xs text-slate-400 border-t border-slate-100">
                … нийт {preview.summary.total} мөрөөс эхний {preview.rows.length}-г харууллаа.
              </div>
            )}
          </div>

          {/* Confirm submit — re-submits the SAME form (file input preserved) */}
          <button
            type="submit"
            name="confirmed"
            value="1"
            disabled={pending || preview.summary.newCount === 0}
            className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm rounded disabled:opacity-60 ${
              preview.overlap.has ? "bg-amber-600 hover:bg-amber-500" : "bg-green-600 hover:bg-green-500"
            }`}
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {preview.overlap.has
              ? "Давхцлыг алгасаж үргэлжлүүлэх"
              : `${preview.summary.newCount} мөр оруулах`}
          </button>
        </div>
      )}
    </form>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "amber";
}) {
  const toneCls =
    tone === "green"
      ? "text-green-700"
      : tone === "amber"
        ? "text-amber-700"
        : "text-slate-800";
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="text-[0.65rem] uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-sm font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, Pencil, Merge, X } from "lucide-react";
import { fmtMoney } from "@/lib/format";
import { mergePartners } from "./actions";

export type PartnerRow = {
  id: string;
  code: string | null;
  name: string;
  register: string | null;
  phone: string | null;
  type: string;
  income: number;
  expense: number;
};

function fmtInt(n: number): string {
  return fmtMoney(n).replace(/\.00$/, "");
}

export function PartnersTable({ rows }: { rows: PartnerRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [primaryId, setPrimaryId] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const selectedRows = rows.filter((r) => selected.has(r.id));
  const showMergeBar = selectedRows.length >= 2;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // keep a sensible default primary
      if (!next.has(primaryId)) {
        const first = [...next][0];
        setPrimaryId(first ?? "");
      }
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      const all = new Set(rows.map((r) => r.id));
      setSelected(all);
      setPrimaryId(rows[0]?.id ?? "");
    } else {
      setSelected(new Set());
      setPrimaryId("");
    }
  }

  function cancelMerge() {
    setSelected(new Set());
    setPrimaryId("");
  }

  function doMerge() {
    const primary = primaryId || [...selected][0];
    const mergeIds = [...selected].filter((id) => id !== primary);
    const primaryName = rows.find((r) => r.id === primary)?.name ?? "?";
    const names = selectedRows.map((r) => r.name).join(", ");
    if (
      !confirm(
        `"${names}"\n\nДээрх ${selected.size} харилцагчийг "${primaryName}" болгон нэгтгэх үү?\n\nБусад харилцагчдын бүх гүйлгээ шилжинэ.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await mergePartners(primary, mergeIds);
      setMsg(r.error ? `⚠ ${r.error}` : `✓ ${r.success ?? "Нэгтгэгдсэн"}`);
      if (!r.error) {
        setSelected(new Set());
        setPrimaryId("");
      }
      router.refresh();
      setTimeout(() => setMsg(null), 5000);
    });
  }

  const totalIncome = rows.reduce((s, r) => s + r.income, 0);
  const totalExpense = rows.reduce((s, r) => s + r.expense, 0);

  return (
    <div className="space-y-2">
      {/* Merge toolbar — appears when 2+ selected */}
      {showMergeBar && (
        <div className="bg-amber-50 border border-amber-200 rounded p-2 flex items-center flex-wrap gap-2 text-sm print:hidden">
          <Merge className="w-4 h-4 text-amber-700" />
          <span className="font-bold">{selected.size}</span> харилцагч сонгогдлоо.
          <span className="text-slate-500 text-xs">Үндсэн болгох:</span>
          <select
            value={primaryId}
            onChange={(e) => setPrimaryId(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded text-xs max-w-[240px]"
          >
            {selectedRows.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button
            onClick={doMerge}
            disabled={pending}
            className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1 disabled:opacity-60"
          >
            <Merge className="w-3 h-3" /> {pending ? "Нэгтгэж байна…" : "Нэгтгэх"}
          </button>
          <button onClick={cancelMerge} className="ml-auto px-2 py-1 border border-slate-300 rounded text-xs hover:bg-slate-50 flex items-center gap-1">
            <X className="w-3 h-3" /> Болих
          </button>
        </div>
      )}

      {msg && <div className="text-xs text-slate-600 px-1">{msg}</div>}

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-white text-xs">
            <tr>
              <th className="px-2 py-2 w-8 text-center print:hidden">
                <input
                  type="checkbox"
                  checked={selected.size > 0 && selected.size === rows.length}
                  onChange={(e) => toggleAll(e.target.checked)}
                  title="Бүгдийг сонгох"
                  className="cursor-pointer"
                />
              </th>
              <th className="px-3 py-2 text-left w-24">Код</th>
              <th className="px-3 py-2 text-left">Нэр</th>
              <th className="px-3 py-2 text-left w-24">Регистр</th>
              <th className="px-3 py-2 text-left w-28">Утас</th>
              <th className="px-3 py-2 text-left w-20">Төрөл</th>
              <th className="px-3 py-2 text-right w-32">Орлого</th>
              <th className="px-3 py-2 text-right w-32">Зарлага</th>
              <th className="px-3 py-2 text-right w-20 print:hidden">Үйлдэл</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-10 text-slate-400">
                  Харилцагч олдсонгүй
                </td>
              </tr>
            ) : (
              rows.map((p) => {
                const hasActivity = p.income > 0 || p.expense > 0;
                const isSel = selected.has(p.id);
                return (
                  <tr
                    key={p.id}
                    className={
                      isSel ? "bg-amber-50" : hasActivity ? "bg-slate-50/60 hover:bg-slate-100/60" : "hover:bg-slate-50"
                    }
                  >
                    <td className="px-2 py-1.5 text-center print:hidden">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggle(p.id)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[0.78rem] text-slate-600">{p.code || "—"}</td>
                    <td className="px-3 py-1.5">
                      <Link href={`/partners/${p.id}`} className="font-semibold text-slate-800 hover:text-blue-700 hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-3 py-1.5 text-slate-500 text-xs">{p.register || "—"}</td>
                    <td className="px-3 py-1.5 text-slate-500 text-xs">{p.phone || "—"}</td>
                    <td className="px-3 py-1.5"><TypeBadge type={p.type} /></td>
                    <td className={`px-3 py-1.5 text-right font-mono ${p.income > 0 ? "text-emerald-700 font-semibold" : "text-slate-400"}`}>
                      {p.income > 0 ? fmtInt(p.income) : "—"}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono ${p.expense > 0 ? "text-red-700 font-semibold" : "text-slate-400"}`}>
                      {p.expense > 0 ? fmtInt(p.expense) : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right print:hidden">
                      <div className="inline-flex items-center gap-1">
                        <Link href={`/partners/${p.id}`} className="border border-blue-300 text-blue-700 hover:bg-blue-50 px-1.5 py-1 rounded" title="Дэлгэрэнгүй">
                          <Eye className="w-3 h-3" />
                        </Link>
                        <Link href={`/partners/${p.id}/edit`} className="border border-slate-300 text-slate-700 hover:bg-slate-50 px-1.5 py-1 rounded" title="Засах">
                          <Pencil className="w-3 h-3" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-slate-100 font-bold text-xs">
              <tr>
                <td className="print:hidden"></td>
                <td colSpan={5} className="px-3 py-2 text-right text-slate-600">
                  Нийт {rows.length} харилцагч:
                </td>
                <td className="px-3 py-2 text-right font-mono text-emerald-700">{fmtInt(totalIncome)}₮</td>
                <td className="px-3 py-2 text-right font-mono text-red-700">{fmtInt(totalExpense)}₮</td>
                <td className="print:hidden"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  if (type === "customer") {
    return <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[0.68rem] font-semibold">Авлага</span>;
  }
  if (type === "supplier") {
    return <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[0.68rem] font-semibold">Өглөг</span>;
  }
  return <span className="inline-block px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-[0.68rem] font-semibold">Хоёул</span>;
}

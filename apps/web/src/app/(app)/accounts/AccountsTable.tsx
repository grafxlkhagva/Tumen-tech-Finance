"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { softDeleteAccount } from "./actions";

export type AccountRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  parent_id: string | null;
  parent_name: string | null;
};

type TypeKey = "asset" | "liability" | "equity" | "income" | "expense";

/**
 * Account-type metadata — labels + badge colours match legacy
 * accounts.html `type_labels` exactly:
 *   asset=blue, liability=red, equity=purple, income=green, expense=orange.
 * (The shared ACCOUNT_TYPE_COLOR map has liability/expense swapped, so this
 *  page keeps its own legacy-faithful copy.)
 */
const TYPE_META: Record<TypeKey, { label: string; badge: string }> = {
  asset:     { label: "Хөрөнгө",   badge: "bg-blue-600" },
  liability: { label: "Өр төлбөр", badge: "bg-red-600" },
  equity:    { label: "Өмч",       badge: "bg-purple-600" },
  income:    { label: "Орлого",    badge: "bg-green-600" },
  expense:   { label: "Зардал",    badge: "bg-orange-500" },
};

const TYPE_ORDER: TypeKey[] = ["asset", "liability", "equity", "income", "expense"];

export function AccountsTable({ rows }: { rows: AccountRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<TypeKey | "all">("all");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const counts = TYPE_ORDER.reduce(
    (acc, t) => ({ ...acc, [t]: rows.filter((r) => r.type === t).length }),
    {} as Record<TypeKey, number>,
  );

  const visible = filter === "all" ? rows : rows.filter((r) => r.type === filter);

  function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" дансыг устгах уу?`)) return;
    startTransition(async () => {
      const r = await softDeleteAccount(id);
      setMsg(r.error ? `⚠ ${r.error}` : `✓ ${r.success ?? "Устгагдсан"}`);
      router.refresh();
      setTimeout(() => setMsg(null), 4000);
    });
  }

  return (
    <div className="space-y-3">
      {/* Filter tabs */}
      <div className="bg-white border border-slate-200 rounded p-2 flex flex-wrap gap-1 print:hidden">
        <FilterTab label="Бүгд" count={rows.length} active={filter === "all"} onClick={() => setFilter("all")} />
        {TYPE_ORDER.map((t) => (
          <FilterTab
            key={t}
            label={TYPE_META[t].label}
            count={counts[t]}
            active={filter === t}
            onClick={() => setFilter(t)}
          />
        ))}
      </div>

      {msg && (
        <div className="text-xs text-slate-600 px-1">{msg}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left w-20">Код</th>
              <th className="px-3 py-2 text-left">Дансны нэр</th>
              <th className="px-3 py-2 text-left w-28">Төрөл</th>
              <th className="px-3 py-2 text-left">Эх данс</th>
              <th className="px-3 py-2 text-right w-24 print:hidden">Үйлдэл</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">
                  Данс байхгүй байна
                </td>
              </tr>
            ) : (
              visible.map((a) => {
                const meta = TYPE_META[a.type as TypeKey];
                const isChild = !!a.parent_id;
                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-3 py-1.5">
                      <code className="text-[0.78rem] text-slate-700">{a.code}</code>
                    </td>
                    <td className="px-3 py-1.5">
                      {isChild ? (
                        <span className="text-slate-700">
                          <span className="text-slate-400 mr-2 ml-3">└</span>
                          {a.name}
                        </span>
                      ) : (
                        <strong className="text-slate-900">{a.name}</strong>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-white text-[0.68rem] font-medium ${meta?.badge ?? "bg-slate-500"}`}
                      >
                        {meta?.label ?? a.type}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-slate-500 text-xs">{a.parent_name ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right print:hidden">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/accounts/${a.id}/edit`}
                          className="border border-blue-300 text-blue-700 hover:bg-blue-50 px-1.5 py-1 rounded"
                          title="Засах"
                        >
                          <Pencil className="w-3 h-3" />
                        </Link>
                        <button
                          onClick={() => handleDelete(a.id, a.name)}
                          disabled={pending}
                          className="border border-red-300 text-red-700 hover:bg-red-50 px-1.5 py-1 rounded disabled:opacity-50"
                          title="Устгах"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterTab({
  label, count, active, onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded text-xs flex items-center gap-1.5 border ${
        active
          ? "bg-slate-700 text-white border-slate-700"
          : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
      }`}
    >
      {label}
      <span className={`px-1.5 py-0.5 rounded text-[0.65rem] ${active ? "bg-white/25" : "bg-slate-100 text-slate-600"}`}>
        {count}
      </span>
    </button>
  );
}

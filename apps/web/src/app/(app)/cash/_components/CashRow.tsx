"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AccountPicker } from "@/components/ui/AccountPicker";
import { PartnerPicker } from "@/components/ui/PartnerPicker";
import { Badge } from "@/components/ui/Badge";
import { fmtDate, fmtMoney } from "@/lib/format";
import { updateCashContraAccount, updateCashPartner, updateCashCategory } from "../actions";
import { Check, Pencil, X } from "lucide-react";

export type CashRowData = {
  id: string;
  txn_date: string;
  direction: "income" | "expense";
  amount: number;
  description: string;
  partner_name: string;
  partner_id: string;
  partner_label: string;
  category: string;
  contra_account_id: string;
  contra_label: string;
  journal_id: string | null;
  bank_name: string;
};

/**
 * One row in the cash list. Allows inline editing of:
 *  - contra_account (via AccountPicker)
 *  - partner (via PartnerPicker)
 *  - category (free text)
 * Each change is a Server Action call.
 */
export function CashRow({ row }: { row: CashRowData }) {
  const [editing, setEditing] = useState<"none" | "contra" | "partner" | "category">("none");
  const [, startTransition] = useTransition();
  const [savingMsg, setSavingMsg] = useState<string | null>(null);

  function notify(msg: string) {
    setSavingMsg(msg);
    setTimeout(() => setSavingMsg(null), 1500);
  }

  return (
    <tr className={row.journal_id ? "bg-slate-50/50" : "hover:bg-slate-50"}>
      <td className="px-2 py-2 text-xs whitespace-nowrap">{fmtDate(row.txn_date)}</td>
      <td className="px-2 py-2 text-xs truncate max-w-[120px]" title={row.bank_name}>
        {row.bank_name}
      </td>
      <td className="px-2 py-2">
        <Badge color={row.direction === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
          {row.direction === "income" ? "Орлого" : "Зарлага"}
        </Badge>
      </td>
      <td className="px-2 py-2 font-mono text-right text-xs whitespace-nowrap">
        {fmtMoney(row.amount)}
      </td>
      <td className="px-2 py-2 text-xs">
        <div className="truncate max-w-md text-slate-700" title={row.description}>
          {row.description || "—"}
        </div>
        {editing === "partner" ? (
          <div className="mt-1 flex items-center gap-1">
            <PartnerPicker
              name={`__cash_partner_${row.id}`}
              defaultId={row.partner_id || undefined}
              defaultLabel={row.partner_label || row.partner_name}
              onChange={(opt) => {
                startTransition(async () => {
                  const r = await updateCashPartner(row.id, opt?.id ?? null);
                  if (r.error) notify(r.error);
                  else notify("✓ Хадгалагдсан");
                  setEditing("none");
                });
              }}
              className="flex-1"
            />
            <button onClick={() => setEditing("none")} className="text-slate-400 hover:text-slate-600">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="text-[0.65rem] text-slate-400 flex items-center gap-1 mt-0.5">
            <span>{row.partner_label || row.partner_name || "— партнер —"}</span>
            {!row.journal_id && (
              <button onClick={() => setEditing("partner")} className="text-blue-500 hover:text-blue-700">
                <Pencil className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        )}
      </td>
      <td className="px-2 py-2 text-xs">
        {editing === "contra" ? (
          <div className="flex items-center gap-1">
            <AccountPicker
              name={`__cash_contra_${row.id}`}
              defaultId={row.contra_account_id || undefined}
              defaultLabel={row.contra_label}
              postableOnly
              onChange={(opt) => {
                startTransition(async () => {
                  const r = await updateCashContraAccount(row.id, opt?.id ?? null);
                  if (r.error) notify(r.error);
                  else notify("✓");
                  setEditing("none");
                });
              }}
              className="flex-1"
            />
            <button onClick={() => setEditing("none")} className="text-slate-400 hover:text-slate-600">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 group">
            <span className={row.contra_label ? "text-slate-700" : "text-slate-400 italic"}>
              {row.contra_label || "— тогтоогоогүй —"}
            </span>
            {!row.journal_id && (
              <button
                onClick={() => setEditing("contra")}
                className="invisible group-hover:visible text-blue-500 hover:text-blue-700"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
        {row.category && (
          <div className="text-[0.65rem] text-slate-400">cat: {row.category}</div>
        )}
      </td>
      <td className="px-2 py-2 text-center text-xs">
        {savingMsg && <span className="text-green-600 text-[0.65rem]">{savingMsg}</span>}
        {row.journal_id ? (
          <Link href={`/journals/${row.journal_id}`} className="text-blue-600 hover:underline" title="Журнал">
            <Check className="w-3.5 h-3.5 inline" />
          </Link>
        ) : row.contra_account_id ? (
          <Badge color="bg-yellow-100 text-yellow-800">Бэлэн</Badge>
        ) : (
          <Badge color="bg-slate-200 text-slate-600">Дутуу</Badge>
        )}
      </td>
    </tr>
  );
}

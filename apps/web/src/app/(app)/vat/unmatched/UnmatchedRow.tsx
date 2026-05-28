"use client";

import { useTransition, useState } from "react";
import { PartnerPicker } from "@/components/ui/PartnerPicker";
import { Badge } from "@/components/ui/Badge";
import { fmtDate, fmtMoney } from "@/lib/format";
import { linkVatPartner } from "../actions";

export type UnmatchedRowData = {
  id: string;
  direction: "inbound" | "outbound";
  date: string;
  ddtd: string | null;
  invoice_no: string | null;
  partner_name: string | null;
  partner_register: string | null;
  total_amount: number;
};

export function UnmatchedRow({ row }: { row: UnmatchedRowData }) {
  const [, startTransition] = useTransition();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-3 py-2 text-xs">{fmtDate(row.date)}</td>
      <td className="px-3 py-2 text-xs">
        <Badge color={row.direction === "outbound" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}>
          {row.direction === "outbound" ? "Гарах" : "Орох"}
        </Badge>
      </td>
      <td className="px-3 py-2 font-mono text-xs">{row.ddtd || row.invoice_no || "—"}</td>
      <td className="px-3 py-2 text-xs">
        <div className="text-slate-700">{row.partner_name || "—"}</div>
        {row.partner_register && <div className="text-[0.65rem] text-slate-400 font-mono">{row.partner_register}</div>}
      </td>
      <td className="px-3 py-2 font-mono text-right text-xs">{fmtMoney(row.total_amount)}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <PartnerPicker
            name={`__unmatched_${row.id}`}
            placeholder="Партнер хайх..."
            onChange={(opt) => {
              if (!opt) return;
              startTransition(async () => {
                const r = await linkVatPartner(row.id, opt.id);
                if (r.error) setSavedMsg(`⚠ ${r.error}`);
                else setSavedMsg("✓ Тулгасан");
                setTimeout(() => setSavedMsg(null), 2000);
              });
            }}
            className="flex-1"
          />
          {savedMsg && <span className="text-[0.65rem] text-green-600">{savedMsg}</span>}
        </div>
      </td>
    </tr>
  );
}

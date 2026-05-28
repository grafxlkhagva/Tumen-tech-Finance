import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { fmtDate, fmtMoney } from "@/lib/format";
import { ToastFromURL } from "@/components/ui/Toast";
import { UnmatchedRow } from "./UnmatchedRow";

export const metadata = { title: "Тулгаагүй НӨАТ — Тумэн Accounting" };

export default async function VatUnmatchedPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("vat_records")
    .select("id, direction, date, ddtd, invoice_no, partner_name, partner_register, amount, vat_amount, total_amount")
    .is("deleted_at", null)
    .eq("status", "pending")
    .order("date", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-4">
      <ToastFromURL />

      <Link href="/vat" className="text-xs text-slate-500 hover:underline flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> НӨАТ
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-yellow-600" /> Тулгаагүй НӨАТ-ууд
        </h1>
        <p className="text-sm text-slate-500">
          Партнерт холбогдоогүй eBarimt бичлэг. Доорхиос хайж тулгана уу.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Огноо</th>
              <th className="px-3 py-2 text-left">Чиглэл</th>
              <th className="px-3 py-2 text-left">ДДТД</th>
              <th className="px-3 py-2 text-left">Партнер (хуулга)</th>
              <th className="px-3 py-2 text-right">Дүн</th>
              <th className="px-3 py-2 text-left">Тулгах партнер</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(rows ?? []).map((r) => (
              <UnmatchedRow
                key={r.id}
                row={{
                  id: r.id,
                  direction: r.direction as "inbound" | "outbound",
                  date: r.date,
                  ddtd: r.ddtd,
                  invoice_no: r.invoice_no,
                  partner_name: r.partner_name,
                  partner_register: r.partner_register,
                  total_amount: Number(r.total_amount || 0),
                }}
              />
            ))}
            {(rows?.length ?? 0) === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">Тулгаагүй НӨАТ алга</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Briefcase, Plus, Calculator } from "lucide-react";
import { fmtMoney, fmtDate, fmtPct } from "@/lib/format";
import { ToastFromURL } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { ASSET_STATUS, type AssetStatus } from "@/lib/i18n/labels";
import { DepreciationButton } from "./DepreciationButton";

export const metadata = { title: "Үндсэн хөрөнгө — Тумэн Accounting" };

export default async function FixedAssetsPage() {
  const supabase = await createClient();

  const [assetsRes, periodsRes] = await Promise.all([
    supabase
      .from("v_fixed_asset_register")
      .select("*")
      .order("code"),
    supabase
      .from("periods")
      .select("id, year, month, status")
      .eq("status", "open")
      .order("year", { ascending: false }).order("month", { ascending: false })
      .limit(12),
  ]);

  const totals = (assetsRes.data ?? []).reduce(
    (acc, a) => ({
      purchase: acc.purchase + Number(a.purchase_amount || 0),
      accumulated: acc.accumulated + Number(a.accumulated_depreciation || 0),
      bookValue: acc.bookValue + Number(a.net_book_value || 0),
    }),
    { purchase: 0, accumulated: 0, bookValue: 0 },
  );

  return (
    <div className="space-y-4">
      <ToastFromURL />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6" /> Үндсэн хөрөнгө
          </h1>
          <p className="text-sm text-slate-500">
            {assetsRes.data?.length ?? 0} ширхэг · Анхны үнэ <span className="font-mono">{fmtMoney(totals.purchase)}</span> · Элэгдэл <span className="font-mono">{fmtMoney(totals.accumulated)}</span> · Үлдэгдэл үнэ <span className="font-mono">{fmtMoney(totals.bookValue)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <DepreciationButton periods={periodsRes.data ?? []} />
          <Link href="/fixed-assets/new" className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Шинэ хөрөнгө
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Код</th>
              <th className="px-3 py-2 text-left">Нэр</th>
              <th className="px-3 py-2 text-left">Ангилал</th>
              <th className="px-3 py-2 text-left">Огноо</th>
              <th className="px-3 py-2 text-right">Анхны үнэ</th>
              <th className="px-3 py-2 text-right">Элэгдэл</th>
              <th className="px-3 py-2 text-right">Үлдэгдэл</th>
              <th className="px-3 py-2 text-right">Сар</th>
              <th className="px-3 py-2 text-center">Хувь</th>
              <th className="px-3 py-2 text-center">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(assetsRes.data ?? []).map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs">
                  <Link href={`/fixed-assets/${a.id}/edit`} className="text-blue-600 hover:underline">{a.code ?? "—"}</Link>
                </td>
                <td className="px-3 py-2 text-xs">{a.name}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{a.category ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{fmtDate(a.purchase_date)}</td>
                <td className="px-3 py-2 font-mono text-right text-xs">{fmtMoney(a.purchase_amount)}</td>
                <td className="px-3 py-2 font-mono text-right text-xs text-red-600">{fmtMoney(a.accumulated_depreciation)}</td>
                <td className="px-3 py-2 font-mono text-right text-xs font-semibold">{fmtMoney(a.net_book_value)}</td>
                <td className="px-3 py-2 font-mono text-right text-xs text-slate-500">{fmtMoney(a.monthly_depreciation)}</td>
                <td className="px-3 py-2 text-center text-xs">{fmtPct(a.depreciation_pct ?? 0, 1)}</td>
                <td className="px-3 py-2 text-center">
                  <Badge color={
                    a.status === "active" ? "bg-green-100 text-green-700"
                    : a.status === "inactive" ? "bg-slate-200 text-slate-700"
                    : "bg-red-100 text-red-700"
                  }>{ASSET_STATUS[a.status as AssetStatus]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

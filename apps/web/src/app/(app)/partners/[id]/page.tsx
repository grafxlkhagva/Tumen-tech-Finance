import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Pencil, Phone, Mail, MapPin } from "lucide-react";
import { fmtDate, fmtMoney } from "@/lib/format";
import { PARTNER_TYPE, AR_AP_STATUS, AR_AP_STATUS_COLOR, type ArApStatus, type PartnerType } from "@/lib/i18n/labels";
import { Badge } from "@/components/ui/Badge";
import { ToastFromURL } from "@/components/ui/Toast";
import { Money } from "@/components/ui/Money";

export const metadata = { title: "Харилцагч — Тумэн Accounting" };

type RouteParams = Promise<{ id: string }>;

export default async function PartnerDetailPage({
  params,
}: {
  params: RouteParams;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [partnerRes, balanceRes, receivablesRes, payablesRes, cashRes] = await Promise.all([
    supabase
      .from("partners")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("v_partner_balance")
      .select("open_receivables, open_payables, open_receivable_count, open_payable_count")
      .eq("partner_id", id)
      .maybeSingle(),
    supabase
      .from("receivables")
      .select("id, invoice_no, invoice_date, due_date, total_amount, paid_amount, remaining, status")
      .eq("partner_id", id)
      .is("deleted_at", null)
      .order("invoice_date", { ascending: false })
      .limit(50),
    supabase
      .from("payables")
      .select("id, invoice_no, invoice_date, due_date, total_amount, paid_amount, remaining, status")
      .eq("partner_id", id)
      .is("deleted_at", null)
      .order("invoice_date", { ascending: false })
      .limit(50),
    supabase
      .from("cash_transactions")
      .select("id, txn_date, direction, amount, description, journal_id")
      .eq("partner_id", id)
      .is("deleted_at", null)
      .order("txn_date", { ascending: false })
      .limit(50),
  ]);

  if (!partnerRes.data) notFound();
  const p = partnerRes.data;
  const b = balanceRes.data;
  const receivables = receivablesRes.data ?? [];
  const payables = payablesRes.data ?? [];
  const cash = cashRes.data ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <ToastFromURL />

      <Link href="/partners" className="text-xs text-slate-500 hover:underline flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Бүх харилцагчид
      </Link>

      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="flex items-start justify-between">
          <div className="flex gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-xl font-bold">
              {p.name[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5" /> {p.name}
              </h1>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                {p.register && <span>Регистр: <span className="font-mono">{p.register}</span></span>}
                {p.tin && <span>TIN: <span className="font-mono">{p.tin}</span></span>}
                <Badge color="bg-slate-100 text-slate-600">
                  {PARTNER_TYPE[p.type as PartnerType]}
                </Badge>
                {!p.is_active && <Badge color="bg-red-100 text-red-700">Идэвхгүй</Badge>}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                {p.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {p.phone}</span>}
                {p.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {p.email}</span>}
                {p.address && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {p.address}</span>}
              </div>
            </div>
          </div>
          <Link
            href={`/partners/${id}/edit`}
            className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-sm flex items-center gap-1"
          >
            <Pencil className="w-3.5 h-3.5" /> Засах
          </Link>
        </div>
      </div>

      {/* Balance KPIs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Нээлттэй авлага</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            <Money value={b?.open_receivables ?? 0} currency />
          </div>
          <div className="text-xs text-slate-400 mt-1">{b?.open_receivable_count ?? 0} нэхэмжлэх</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Нээлттэй өглөг</div>
          <div className="text-2xl font-bold text-orange-600 mt-1">
            <Money value={b?.open_payables ?? 0} currency />
          </div>
          <div className="text-xs text-slate-400 mt-1">{b?.open_payable_count ?? 0} нэхэмжлэх</div>
        </div>
      </div>

      {/* Tabs as sections */}
      {receivables.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700">Авлагууд</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Нэхэмж №</th>
                <th className="px-4 py-2 text-left">Огноо</th>
                <th className="px-4 py-2 text-left">Хугацаа</th>
                <th className="px-4 py-2 text-right">Дүн</th>
                <th className="px-4 py-2 text-right">Төлсөн</th>
                <th className="px-4 py-2 text-right">Үлдэгдэл</th>
                <th className="px-4 py-2 text-center">Төлөв</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {receivables.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-xs">{r.invoice_no ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{fmtDate(r.invoice_date)}</td>
                  <td className="px-4 py-2 text-xs">{fmtDate(r.due_date)}</td>
                  <td className="px-4 py-2 font-mono text-right text-xs">{fmtMoney(r.total_amount)}</td>
                  <td className="px-4 py-2 font-mono text-right text-xs text-green-600">{fmtMoney(r.paid_amount)}</td>
                  <td className="px-4 py-2 font-mono text-right text-xs font-semibold">{fmtMoney(r.remaining)}</td>
                  <td className="px-4 py-2 text-center">
                    <Badge color={AR_AP_STATUS_COLOR[r.status as ArApStatus]}>
                      {AR_AP_STATUS[r.status as ArApStatus]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payables.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700">Өглөгүүд</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Нэхэмж №</th>
                <th className="px-4 py-2 text-left">Огноо</th>
                <th className="px-4 py-2 text-right">Үлдэгдэл</th>
                <th className="px-4 py-2 text-center">Төлөв</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payables.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-xs">{r.invoice_no ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{fmtDate(r.invoice_date)}</td>
                  <td className="px-4 py-2 font-mono text-right text-xs">{fmtMoney(r.remaining)}</td>
                  <td className="px-4 py-2 text-center">
                    <Badge color={AR_AP_STATUS_COLOR[r.status as ArApStatus]}>
                      {AR_AP_STATUS[r.status as ArApStatus]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cash.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700">Сүүлийн банкны гүйлгээнүүд</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Огноо</th>
                <th className="px-4 py-2 text-left">Чиглэл</th>
                <th className="px-4 py-2 text-right">Дүн</th>
                <th className="px-4 py-2 text-left">Тайлбар</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cash.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-xs">{fmtDate(c.txn_date)}</td>
                  <td className="px-4 py-2 text-xs">
                    <Badge color={c.direction === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                      {c.direction === "income" ? "Орлого" : "Зарлага"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 font-mono text-right text-xs">{fmtMoney(c.amount)}</td>
                  <td className="px-4 py-2 text-xs text-slate-600 truncate max-w-md">{c.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

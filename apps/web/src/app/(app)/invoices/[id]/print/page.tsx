import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { fmtDate, fmtMoney } from "@/lib/format";

export const metadata = { title: "Нэхэмжлэх — Хэвлэх" };

type RouteParams = Promise<{ id: string }>;

export default async function InvoicePrintPage({ params }: { params: RouteParams }) {
  const { id } = await params;
  const supabase = await createClient();

  const [recvRes, companyRes] = await Promise.all([
    supabase
      .from("receivables")
      .select("*, partner:partners(*)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("companies")
      .select("name, legal_name, register, tin, address, phone, email")
      .limit(1)
      .maybeSingle(),
  ]);

  if (!recvRes.data) notFound();
  const r = recvRes.data;
  const partner = Array.isArray(r.partner) ? r.partner[0] : r.partner;
  const company = companyRes.data;

  return (
    <div className="bg-white max-w-4xl mx-auto p-12 print:p-0">
      {/* Header */}
      <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">НЭХЭМЖЛЭХ</h1>
          <div className="text-sm text-slate-600 mt-1">№ {r.invoice_no ?? r.id.slice(0, 8)}</div>
        </div>
        <div className="text-right text-sm">
          <div className="font-semibold">{company?.name ?? "Тумэн"}</div>
          {company?.address && <div className="text-xs text-slate-500">{company.address}</div>}
          {company?.tin && <div className="text-xs text-slate-500">ТТД: {company.tin}</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <div className="text-xs uppercase text-slate-500 mb-1">Худалдан авагч</div>
          <div className="font-semibold">{partner?.name}</div>
          {partner?.register && <div className="text-xs text-slate-600">Регистр: {partner.register}</div>}
          {partner?.tin && <div className="text-xs text-slate-600">ТТД: {partner.tin}</div>}
          {partner?.address && <div className="text-xs text-slate-600">{partner.address}</div>}
        </div>
        <div>
          <div className="text-xs uppercase text-slate-500 mb-1">Огноо</div>
          <div className="font-semibold">{fmtDate(r.invoice_date)}</div>
          {r.due_date && (
            <>
              <div className="text-xs uppercase text-slate-500 mt-2 mb-1">Хугацаа</div>
              <div className="font-semibold">{fmtDate(r.due_date)}</div>
            </>
          )}
        </div>
      </div>

      <table className="w-full mb-8 border-collapse">
        <thead>
          <tr className="border-b-2 border-slate-300">
            <th className="px-3 py-2 text-left text-xs uppercase text-slate-600">Тайлбар</th>
            <th className="px-3 py-2 text-right text-xs uppercase text-slate-600 w-32">Дүн (₮)</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100">
            <td className="px-3 py-3">{r.description || "Үйлчилгээний хөлс"}</td>
            <td className="px-3 py-3 font-mono text-right">{fmtMoney(r.amount)}</td>
          </tr>
          {Number(r.vat_amount) > 0 && (
            <tr className="border-b border-slate-100">
              <td className="px-3 py-3 text-slate-600">НӨАТ (10%)</td>
              <td className="px-3 py-3 font-mono text-right">{fmtMoney(r.vat_amount)}</td>
            </tr>
          )}
          <tr className="border-t-2 border-slate-900">
            <td className="px-3 py-3 font-bold uppercase">Нийт</td>
            <td className="px-3 py-3 font-mono text-right font-bold text-lg">₮{fmtMoney(r.total_amount)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-12 pt-6 border-t border-slate-200 text-xs text-slate-500 text-center print:hidden">
        Cmd/Ctrl + P дарж хэвлэнэ үү
      </div>

      <style>{`
        @media print {
          @page { margin: 1cm; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}

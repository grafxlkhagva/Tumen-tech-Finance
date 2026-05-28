import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { fmtDate, fmtMoney } from "@/lib/format";
import { ToastFromURL } from "@/components/ui/Toast";
import { BulkInvoiceForm } from "./BulkInvoiceForm";

export const metadata = { title: "Багц нэхэмжлэл — Тумэн Accounting" };

type SearchParams = Promise<{ month?: string }>;

export default async function VatBatchJournalPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;

  const supabase = await createClient();

  // Outbound VAT records without journal/receivable, optionally filtered by month
  let q = supabase
    .from("vat_records")
    .select("id, date, ddtd, invoice_no, partner_name, partner_register, partner_id, amount, vat_amount, total_amount, partner:partners(id, name)")
    .is("deleted_at", null)
    .eq("direction", "outbound")
    .is("journal_id", null)
    .is("receivable_id", null)
    .order("date", { ascending: false });

  if (sp.month) {
    const [y, m] = sp.month.split("-").map(Number);
    if (y && m) {
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      q = q.gte("date", start).lt("date", end);
    }
  }

  const { data: vatRows } = await q.limit(500);

  // Group by partner for batch action
  type PartnerGroup = {
    partner_id: string | null;
    partner_name: string;
    rows: typeof vatRows;
    totalAmount: number;
    totalVat: number;
  };
  const groups = new Map<string, PartnerGroup>();
  for (const r of vatRows ?? []) {
    const partner = Array.isArray(r.partner) ? r.partner[0] : r.partner;
    const key = partner?.id ?? `_unmatched:${r.partner_name ?? ""}`;
    if (!groups.has(key)) {
      groups.set(key, {
        partner_id: partner?.id ?? null,
        partner_name: partner?.name ?? r.partner_name ?? "(тулгаагүй)",
        rows: [],
        totalAmount: 0,
        totalVat: 0,
      });
    }
    const g = groups.get(key)!;
    g.rows!.push(r);
    g.totalAmount += Number(r.amount || 0);
    g.totalVat += Number(r.vat_amount || 0);
  }

  return (
    <div className="space-y-4">
      <ToastFromURL />

      <Link href="/vat" className="text-xs text-slate-500 hover:underline flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> НӨАТ
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6" /> Бөөнөөр нэхэмжлэл үүсгэх
        </h1>
        <p className="text-sm text-slate-500">
          Тулгасан eBarimt бичлэгээс автоматаар Авлага + Журнал үүсгэнэ.
        </p>
      </div>

      <form method="GET" className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Сараар шүү:</span>
        <input type="month" name="month" defaultValue={sp.month ?? ""} className="px-2 py-1.5 border border-slate-300 rounded text-xs" />
        <button className="px-3 py-1.5 bg-slate-700 text-white rounded text-xs">Үзэх</button>
      </form>

      <BulkInvoiceForm groups={Array.from(groups.values())} />
    </div>
  );
}

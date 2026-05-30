import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/supabase/company";
import Link from "next/link";
import {
  ReceiptText,
  FileText,
  CheckCircle2,
  Clock,
  Percent,
  Plus,
  Search,
  X,
  AlertTriangle,
  Pencil,
  Printer,
  ListChecks,
  BarChart3,
} from "lucide-react";
import { fmtMoney } from "@/lib/format";
import { ToastFromURL } from "@/components/ui/Toast";
import { PrintButton } from "@/components/ui/PrintButton";
import {
  type InvoiceRow,
  buildInvoiceSummary,
  filterInvoices,
  isOverdue,
  monthlyBreakdown,
  parseInvoiceFilters,
} from "@/lib/reports/invoices";

export const metadata = { title: "Нэхэмжлэхийн тайлан — Тумэн Accounting" };

type SearchParams = Promise<{
  status?: string;
  month?: string;
  q?: string;
}>;

// Lucide doesn't ship a FileInvoice — use FileText as the closest invoice glyph
const FileInvoiceIcon = FileText;

export default async function InvoicesReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filters = parseInvoiceFilters(sp);

  const supabase = await createClient();
  const company = await getCurrentCompany(supabase);

  if (!company) {
    return (
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-2xl font-semibold flex items-center gap-2 mb-4">
          <ReceiptText className="w-6 h-6" /> Нэхэмжлэхийн тайлан
        </h1>
        <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-900">
          Байгууллага сонгогдоогүй байна.
        </div>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("receivables")
    .select(
      "id, invoice_no, invoice_date, due_date, description, responsible, total_amount, paid_amount, remaining, status, partner:partners(id, name)",
    )
    .eq("company_id", company.companyId)
    .is("deleted_at", null)
    .order("invoice_date", { ascending: false })
    .order("invoice_no", { ascending: false });

  const allRows = (data ?? []).map((r) => ({
    ...r,
    partner: Array.isArray(r.partner) ? r.partner[0] ?? null : r.partner ?? null,
  })) as InvoiceRow[];

  const filteredRows = filterInvoices(allRows, filters);
  const summary = buildInvoiceSummary(filteredRows);
  const allSummary = buildInvoiceSummary(allRows); // for chip counts
  const monthly = monthlyBreakdown(allRows);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-3 max-w-[1600px] mx-auto">
      <ToastFromURL />

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <ReceiptText className="w-6 h-6" /> Нэхэмжлэхийн тайлан
          <span className="text-base text-slate-500 font-normal">
            — &quot;{company.meta?.name ?? "—"}&quot; ХХК
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/receivables/new"
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Нэхэмжлэх нэмэх
          </Link>
          <PrintButton />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Нийт нэхэмжилсэн"
          value={`${fmtMoney(allSummary.totalBilled).replace(/\.00$/, "")}₮`}
          sub={`${allSummary.counts.all} нэхэмжлэл`}
          icon={<FileInvoiceIcon className="w-5 h-5" />}
          gradient="from-blue-500 to-blue-700"
        />
        <KpiCard
          label="Цугласан"
          value={`${fmtMoney(allSummary.totalPaid).replace(/\.00$/, "")}₮`}
          sub={`${allSummary.counts.paid} бүрэн төлөгдсөн`}
          icon={<CheckCircle2 className="w-5 h-5" />}
          gradient="from-emerald-500 to-emerald-700"
        />
        <KpiCard
          label="Үлдэгдэл авлага"
          value={`${fmtMoney(allSummary.totalRemaining).replace(/\.00$/, "")}₮`}
          sub={`${allSummary.counts.open + allSummary.counts.partial} нэхэмжлэл`}
          icon={<Clock className="w-5 h-5" />}
          gradient="from-orange-500 to-orange-700"
        />
        <KpiCard
          label="Цуглуулалтын хувь"
          value={`${allSummary.collectionPct.toFixed(1)}%`}
          sub="&nbsp;"
          icon={<Percent className="w-5 h-5" />}
          gradient="from-purple-700 to-fuchsia-700"
        />
      </div>

      {/* Filters + search */}
      <div className="bg-white border border-slate-200 rounded p-2 print:hidden">
        <form method="GET" className="flex flex-wrap items-center gap-2">
          {/* Status chips — anchor tags so each click is a fresh URL */}
          <div className="inline-flex rounded border border-slate-300 overflow-hidden text-xs">
            <StatusChip
              label="Бүгд"
              count={allSummary.counts.all}
              active={!filters.status}
              href={buildUrl({ ...sp, status: "" })}
              color="slate"
            />
            <StatusChip
              label="Нээлттэй"
              count={allSummary.counts.open}
              active={filters.status === "open"}
              href={buildUrl({ ...sp, status: "open" })}
              color="red"
            />
            <StatusChip
              label="Хэсэгчлэн"
              count={allSummary.counts.partial}
              active={filters.status === "partial"}
              href={buildUrl({ ...sp, status: "partial" })}
              color="amber"
            />
            <StatusChip
              label="Төлөгдсөн"
              count={allSummary.counts.paid}
              active={filters.status === "paid"}
              href={buildUrl({ ...sp, status: "paid" })}
              color="emerald"
            />
          </div>

          {/* Hidden status so the form preserves it on submit */}
          <input type="hidden" name="status" value={filters.status} />

          {/* Month dropdown */}
          <label htmlFor="inv-month" className="sr-only">Сар</label>
          <select
            id="inv-month"
            name="month"
            defaultValue={filters.month === "" ? "" : String(filters.month)}
            className="px-2 py-1 border border-slate-300 rounded text-xs"
          >
            <option value="">Бүх сар</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}-р сар</option>
            ))}
          </select>

          {/* Search */}
          <div className="flex items-center gap-1">
            <label htmlFor="inv-q" className="sr-only">Хайх</label>
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="inv-q"
                type="text"
                name="q"
                defaultValue={filters.q}
                placeholder="Нэхэмж # эсвэл харилцагч…"
                className="pl-6 pr-2 py-1 border border-slate-300 rounded text-xs w-[220px]"
              />
            </div>
            {filters.q && (
              <Link
                href={buildUrl({ ...sp, q: "" })}
                className="px-1.5 py-1 border border-red-300 text-red-700 rounded text-xs hover:bg-red-50"
                title="Хайлт цэвэрлэх"
              >
                <X className="w-3 h-3" />
              </Link>
            )}
          </div>

          <button
            type="submit"
            className="px-3 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs"
          >
            Шүүх
          </button>
        </form>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 print:hidden flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Өгөгдөл татаж чадсангүй</div>
            <div className="text-xs opacity-80 mt-0.5">{error.message}</div>
          </div>
        </div>
      )}

      {/* Invoice list */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <div className="flex items-center px-3 py-2 border-b border-slate-200 text-sm font-semibold text-slate-700">
          <ListChecks className="w-4 h-4 mr-1.5" />
          Нэхэмжлэхийн жагсаалт
          <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{filteredRows.length}</span>
          <span className="ml-auto text-xs text-slate-500 print:hidden">{today} байдлаар</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="px-2 py-2 text-center font-semibold w-10">№</th>
                <th className="px-2 py-2 text-left font-semibold w-28">Нэхэмж №</th>
                <th className="px-2 py-2 text-left font-semibold w-24">Огноо</th>
                <th className="px-2 py-2 text-left font-semibold">Харилцагч</th>
                <th className="px-2 py-2 text-left font-semibold w-24 hidden md:table-cell">Хариуцагч</th>
                <th className="px-2 py-2 text-left font-semibold w-48 hidden md:table-cell">Тайлбар</th>
                <th className="px-2 py-2 text-left font-semibold w-24">Хугацаа</th>
                <th className="px-2 py-2 text-right font-semibold w-32">Нийт дүн</th>
                <th className="px-2 py-2 text-right font-semibold w-28">Төлсөн</th>
                <th className="px-2 py-2 text-right font-semibold w-28">Үлдэгдэл</th>
                <th className="px-2 py-2 text-left font-semibold w-24">Төлөв</th>
                <th className="px-2 py-2 text-left font-semibold w-24 print:hidden"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-10 text-slate-400">
                    <FileInvoiceIcon className="w-8 h-8 mx-auto opacity-30 mb-2" />
                    Нэхэмжлэл байхгүй байна
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, i) => (
                  <InvoiceRowEl key={r.id} r={r} index={i + 1} today={today} />
                ))
              )}
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot className="bg-blue-50 font-bold">
                <tr>
                  <td colSpan={7} className="px-2 py-1.5 text-right">
                    Нийт {filteredRows.length} нэхэмжлэл:
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    {fmtMoney(summary.totalBilled).replace(/\.00$/, "")}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-emerald-700">
                    {fmtMoney(summary.totalPaid).replace(/\.00$/, "")}
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono ${summary.totalRemaining > 0 ? "text-red-700" : ""}`}>
                    {fmtMoney(summary.totalRemaining).replace(/\.00$/, "")}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Monthly summary */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden print:hidden">
        <div className="flex items-center px-3 py-2 border-b border-slate-200 text-sm font-semibold text-slate-700">
          <BarChart3 className="w-4 h-4 mr-1.5" /> Сарын нэгтгэл
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Сар</th>
                <th className="px-2 py-1.5 text-right font-medium">Тоо</th>
                <th className="px-2 py-1.5 text-right font-medium">Нэхэмжилсэн</th>
                <th className="px-2 py-1.5 text-right font-medium text-emerald-600">Цугласан</th>
                <th className="px-2 py-1.5 text-right font-medium text-red-600">Үлдэгдэл</th>
                <th className="px-2 py-1.5 text-left font-medium w-40">Хэмжилт</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthly.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-400">
                    Сарын нэгтгэл байхгүй
                  </td>
                </tr>
              ) : (
                monthly.map((row) => (
                  <tr key={row.month}>
                    <td className="px-2 py-1 font-semibold">{row.month}-р сар</td>
                    <td className="px-2 py-1 text-right">{row.count}</td>
                    <td className="px-2 py-1 text-right font-mono">
                      {fmtMoney(row.billed).replace(/\.00$/, "")}
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-emerald-700">
                      {fmtMoney(row.paid).replace(/\.00$/, "")}
                    </td>
                    <td className={`px-2 py-1 text-right font-mono ${row.remaining > 0 ? "text-red-700" : "text-slate-400"}`}>
                      {row.remaining > 0 ? fmtMoney(row.remaining).replace(/\.00$/, "") : "—"}
                    </td>
                    <td className="px-2 py-1">
                      <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
                        <div
                          className={`h-full ${row.pct >= 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                          style={{ width: `${Math.min(row.pct, 100)}%` }}
                        />
                      </div>
                      <div className="text-[0.65rem] text-slate-500 mt-0.5">{row.pct.toFixed(0)}%</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { background: white; }
          table { font-size: 8pt !important; }
          thead { background: #1a3c5e !important; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}

function buildUrl(sp: Record<string, string | undefined>): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v) next.set(k, v);
  }
  const s = next.toString();
  return `/invoices${s ? `?${s}` : ""}`;
}

function StatusChip({
  label,
  count,
  active,
  href,
  color,
}: {
  label: string;
  count: number;
  active: boolean;
  href: string;
  color: "slate" | "red" | "amber" | "emerald";
}) {
  const palette = {
    slate:    { active: "bg-slate-700 text-white border-slate-700",     idle: "text-slate-700 hover:bg-slate-50",       badge: "bg-slate-200 text-slate-700"   },
    red:      { active: "bg-red-600 text-white border-red-600",         idle: "text-red-700 hover:bg-red-50",            badge: "bg-red-100 text-red-700"        },
    amber:    { active: "bg-amber-500 text-white border-amber-500",     idle: "text-amber-700 hover:bg-amber-50",        badge: "bg-amber-100 text-amber-700"    },
    emerald:  { active: "bg-emerald-600 text-white border-emerald-600", idle: "text-emerald-700 hover:bg-emerald-50",    badge: "bg-emerald-100 text-emerald-700" },
  }[color];

  return (
    <Link
      href={href}
      className={`px-3 py-1 flex items-center gap-1 border-r border-slate-200 last:border-r-0 ${active ? palette.active : palette.idle}`}
    >
      {label}
      <span className={`px-1.5 py-0.5 rounded text-[0.65rem] ${active ? "bg-white/20" : palette.badge}`}>
        {count}
      </span>
    </Link>
  );
}

function InvoiceRowEl({
  r,
  index,
  today,
}: {
  r: InvoiceRow;
  index: number;
  today: string;
}) {
  const overdue = isOverdue(r, today);
  const pct = r.total_amount > 0 ? (r.paid_amount / r.total_amount) * 100 : 0;
  const dueShort = r.due_date ? r.due_date.slice(5) : null;

  return (
    <tr className={overdue ? "bg-red-50/60" : "hover:bg-slate-50"}>
      <td className="px-2 py-1.5 text-center text-slate-400 text-[0.7rem]">{index}</td>
      <td className="px-2 py-1.5">
        <Link
          href={`/receivables/${r.id}/edit`}
          className="font-mono font-semibold text-blue-700 hover:underline"
          title="Засах"
        >
          {r.invoice_no || "—"}
        </Link>
      </td>
      <td className="px-2 py-1.5 text-slate-600">{r.invoice_date}</td>
      <td className="px-2 py-1.5 font-semibold">{r.partner?.name ?? "—"}</td>
      <td className="px-2 py-1.5 text-slate-500 hidden md:table-cell truncate max-w-[90px]">
        {r.responsible || "—"}
      </td>
      <td
        className="px-2 py-1.5 text-slate-500 hidden md:table-cell truncate max-w-[180px]"
        title={r.description ?? ""}
      >
        {r.description ? r.description.slice(0, 60) : "—"}
      </td>
      <td className={overdue ? "px-2 py-1.5 text-red-700 font-semibold" : "px-2 py-1.5 text-slate-500"}>
        {dueShort ? (
          <>
            {dueShort}
            {overdue && " ⚠"}
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-2 py-1.5 text-right font-mono">
        {fmtMoney(r.total_amount).replace(/\.00$/, "")}
      </td>
      <td className="px-2 py-1.5 text-right font-mono text-emerald-700">
        {r.paid_amount > 0 ? fmtMoney(r.paid_amount).replace(/\.00$/, "") : "—"}
      </td>
      <td
        className={`px-2 py-1.5 text-right font-mono font-bold ${r.remaining > 0 ? "text-red-700" : "text-slate-400"}`}
      >
        {r.remaining > 0 ? fmtMoney(r.remaining).replace(/\.00$/, "") : "—"}
      </td>
      <td className="px-2 py-1.5">
        <StatusBadge status={r.status} overdue={overdue} pct={pct} />
      </td>
      <td className="px-2 py-1.5 print:hidden">
        <div className="flex gap-1">
          <Link
            href={`/invoices/${r.id}/print`}
            target="_blank"
            className="border border-emerald-300 text-emerald-700 hover:bg-emerald-50 px-1.5 py-0.5 rounded text-[0.65rem] flex items-center gap-1 whitespace-nowrap"
            title="Хэвлэх загвар"
          >
            <Printer className="w-2.5 h-2.5" /> Шинэ
          </Link>
          <Link
            href={`/receivables/${r.id}/edit`}
            className="border border-slate-300 text-slate-700 hover:bg-slate-50 px-1.5 py-0.5 rounded text-[0.65rem] flex items-center gap-1 whitespace-nowrap"
            title="Засах"
          >
            <Pencil className="w-2.5 h-2.5" />
          </Link>
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({
  status,
  overdue,
  pct,
}: {
  status: InvoiceRow["status"];
  overdue: boolean;
  pct: number;
}) {
  if (status === "paid") {
    return (
      <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[0.65rem] font-semibold">
        Төлөгдсөн
      </span>
    );
  }
  if (status === "partial") {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[0.65rem] font-semibold">
          Хэсэгчлэн
        </span>
        <div className="h-1 bg-amber-100 rounded overflow-hidden">
          <div className="h-full bg-amber-500" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </div>
    );
  }
  // open / draft / void
  if (overdue) {
    return (
      <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 rounded text-[0.65rem] font-semibold">
        Хэтэрсэн
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[0.65rem] font-semibold">
      Нээлттэй
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  gradient,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <div className={`bg-gradient-to-br ${gradient} text-white rounded p-3 shadow-sm`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs opacity-90">{label}</div>
        {icon}
      </div>
      <div className="text-xl font-bold font-mono leading-tight">{value}</div>
      <div className="text-[0.7rem] opacity-80 mt-0.5" dangerouslySetInnerHTML={{ __html: sub }} />
    </div>
  );
}

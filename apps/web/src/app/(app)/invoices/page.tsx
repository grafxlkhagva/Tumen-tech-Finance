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
  Ban,
} from "lucide-react";
import { fmtMoney } from "@/lib/format";
import { ToastFromURL } from "@/components/ui/Toast";
import { PrintButton } from "@/components/ui/PrintButton";
import {
  type InvoiceRow,
  PAGE_LIMIT,
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

  // CRITICAL FIX #1: hard PAGE_LIMIT cap prevents an OOM if the table grows
  // to 10K+ rows. We surface a banner when the cap is hit so the user knows
  // some invoices may be hidden until they narrow the filter.
  const { data, error } = await supabase
    .from("receivables")
    .select(
      "id, invoice_no, invoice_date, due_date, description, responsible, total_amount, paid_amount, remaining, status, partner:partners(id, name)",
    )
    .eq("company_id", company.companyId)
    .is("deleted_at", null)
    .order("invoice_date", { ascending: false })
    .order("invoice_no", { ascending: false })
    .limit(PAGE_LIMIT);

  const allRows = (data ?? []).map((r) => ({
    ...r,
    partner: Array.isArray(r.partner) ? r.partner[0] ?? null : r.partner ?? null,
  })) as InvoiceRow[];
  const limitReached = allRows.length >= PAGE_LIMIT;

  const filteredRows = filterInvoices(allRows, filters);
  const summary = buildInvoiceSummary(filteredRows);
  const allSummary = buildInvoiceSummary(allRows); // unfiltered — for chip counts + KPI sub-counts
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

      {/* KPI cards — sub now ReactNode (CRITICAL FIX #3) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Нийт нэхэмжилсэн"
          value={`${fmtMoneyInt(allSummary.totalBilled)}₮`}
          sub={`${allSummary.counts.all} нэхэмжлэл`}
          icon={<FileInvoiceIcon className="w-5 h-5" />}
          gradient="from-blue-500 to-blue-700"
        />
        <KpiCard
          label="Цугласан"
          value={`${fmtMoneyInt(allSummary.totalPaid)}₮`}
          sub={`${allSummary.counts.paid} бүрэн төлөгдсөн`}
          icon={<CheckCircle2 className="w-5 h-5" />}
          gradient="from-emerald-500 to-emerald-700"
        />
        <KpiCard
          label="Үлдэгдэл авлага"
          value={`${fmtMoneyInt(allSummary.totalRemaining)}₮`}
          sub={`${allSummary.counts.open + allSummary.counts.partial} нэхэмжлэл`}
          icon={<Clock className="w-5 h-5" />}
          gradient="from-orange-500 to-orange-700"
        />
        <KpiCard
          label="Цуглуулалтын хувь"
          value={`${allSummary.collectionPct.toFixed(1)}%`}
          sub={<>&nbsp;</>}
          icon={<Percent className="w-5 h-5" />}
          gradient="from-purple-700 to-fuchsia-700"
        />
      </div>

      {/*
        Filter form — chips are now form <button type="submit"> instead of
        <Link> (CRITICAL FIX #2), so clicking a chip submits the same form
        as month/search, preserving any in-progress search text. The
        clicked button's name="status"/value="…" overrides the hidden
        <input name="status">.
      */}
      <div className="bg-white border border-slate-200 rounded p-2 print:hidden">
        <form method="GET" className="flex flex-wrap items-center gap-2">
          {/* Hidden default status — gets replaced by whichever chip is clicked. */}
          <input type="hidden" name="status" value={filters.status} />

          <div className="inline-flex rounded border border-slate-300 overflow-hidden text-xs">
            <ChipButton
              label="Бүгд"
              count={allSummary.counts.all}
              active={!filters.status}
              value=""
              color="slate"
            />
            <ChipButton
              label="Нээлттэй"
              count={allSummary.counts.open}
              active={filters.status === "open"}
              value="open"
              color="red"
            />
            <ChipButton
              label="Хэсэгчлэн"
              count={allSummary.counts.partial}
              active={filters.status === "partial"}
              value="partial"
              color="amber"
            />
            <ChipButton
              label="Төлөгдсөн"
              count={allSummary.counts.paid}
              active={filters.status === "paid"}
              value="paid"
              color="emerald"
            />
          </div>

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
                maxLength={100}
                className="pl-6 pr-2 py-1 border border-slate-300 rounded text-xs w-[220px]"
              />
            </div>
            {filters.q && (
              // Clear-button as submit (empties q while preserving other params)
              <button
                type="submit"
                name="q"
                value=""
                className="px-1.5 py-1 border border-red-300 text-red-700 rounded text-xs hover:bg-red-50"
                title="Хайлт цэвэрлэх"
              >
                <X className="w-3 h-3" />
              </button>
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

      {/* Page-limit warning */}
      {limitReached && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900 print:hidden flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Хязгаар хүрсэн ({PAGE_LIMIT.toLocaleString()} мөр)</div>
            <div className="opacity-80 mt-0.5">
              Энэ хязгаараас илүү нэхэмжлэл бүртгэлд байгаа. Бүгдийг харахын тулд төлөв,
              сар, эсвэл хайлтаар шүүнэ үү. (Phase 4-д cursor pagination нэмэгдэнэ.)
            </div>
          </div>
        </div>
      )}

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
                <th className="px-2 py-2 text-left font-semibold w-32 print:hidden"></th>
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
                    {fmtMoneyInt(summary.totalBilled)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-emerald-700">
                    {fmtMoneyInt(summary.totalPaid)}
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono ${summary.totalRemaining > 0 ? "text-red-700" : ""}`}>
                    {fmtMoneyInt(summary.totalRemaining)}
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
                    <td className="px-2 py-1 text-right font-mono">{fmtMoneyInt(row.billed)}</td>
                    <td className="px-2 py-1 text-right font-mono text-emerald-700">{fmtMoneyInt(row.paid)}</td>
                    <td className={`px-2 py-1 text-right font-mono ${row.remaining > 0 ? "text-red-700" : "text-slate-400"}`}>
                      {row.remaining > 0 ? fmtMoneyInt(row.remaining) : "—"}
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

/** Local helper — strips trailing ".00" from Mongolian-formatted money. */
function fmtMoneyInt(n: number): string {
  return fmtMoney(n).replace(/\.00$/, "");
}

function ChipButton({
  label,
  count,
  active,
  value,
  color,
}: {
  label: string;
  count: number;
  active: boolean;
  value: string;
  color: "slate" | "red" | "amber" | "emerald";
}) {
  const palette = {
    slate:    { active: "bg-slate-700 text-white",     idle: "text-slate-700 hover:bg-slate-50",    badge: "bg-slate-200 text-slate-700"   },
    red:      { active: "bg-red-600 text-white",       idle: "text-red-700 hover:bg-red-50",        badge: "bg-red-100 text-red-700"        },
    amber:    { active: "bg-amber-500 text-white",     idle: "text-amber-700 hover:bg-amber-50",    badge: "bg-amber-100 text-amber-700"    },
    emerald:  { active: "bg-emerald-600 text-white",   idle: "text-emerald-700 hover:bg-emerald-50", badge: "bg-emerald-100 text-emerald-700" },
  }[color];

  // type="submit" with name="status" + value — clicking the button submits
  // the form with status=value, overriding the hidden <input name="status">.
  // This is what preserves the in-progress search text + month dropdown.
  return (
    <button
      type="submit"
      name="status"
      value={value}
      className={`px-3 py-1 flex items-center gap-1 border-r border-slate-200 last:border-r-0 ${active ? palette.active : palette.idle}`}
    >
      {label}
      <span className={`px-1.5 py-0.5 rounded text-[0.65rem] ${active ? "bg-white/25" : palette.badge}`}>
        {count}
      </span>
    </button>
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
      <td className="px-2 py-1.5 text-right font-mono">{fmtMoneyInt(r.total_amount)}</td>
      <td className="px-2 py-1.5 text-right font-mono text-emerald-700">
        {r.paid_amount > 0 ? fmtMoneyInt(r.paid_amount) : "—"}
      </td>
      <td
        className={`px-2 py-1.5 text-right font-mono font-bold ${r.remaining > 0 ? "text-red-700" : "text-slate-400"}`}
      >
        {r.remaining > 0 ? fmtMoneyInt(r.remaining) : "—"}
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
            title="Шинэ хэвлэх загвар"
          >
            <Printer className="w-2.5 h-2.5" /> Шинэ
          </Link>
          {/* HIGH FIX #4: T-1 button restoring legacy parity. The /forms/t1
              page currently shows partner-level aggregates; passing
              ?partner=… makes the URL semantically correct so a future
              filter implementation will Just Work. */}
          {r.partner && (
            <Link
              href={`/forms/t1?partner=${r.partner.id}`}
              target="_blank"
              className="border border-blue-300 text-blue-700 hover:bg-blue-50 px-1.5 py-0.5 rounded text-[0.65rem] flex items-center gap-1 whitespace-nowrap"
              title="Т-1 маяг (харилцагчийн тооцоо нийлэх акт)"
            >
              <Printer className="w-2.5 h-2.5" /> Т-1
            </Link>
          )}
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
  // HIGH FIX #5: distinct badge for `void` status. Previously fell through
  // to "Нээлттэй" which was misleading — accountants couldn't tell that a
  // voided invoice was no longer collectable.
  if (status === "void") {
    return (
      <span className="inline-block px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-[0.65rem] font-semibold flex items-center gap-1">
        <Ban className="w-2.5 h-2.5" /> Цуцлагдсан
      </span>
    );
  }
  if (status === "draft") {
    return (
      <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[0.65rem] font-semibold">
        Ноорог
      </span>
    );
  }
  // open
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
  /** ReactNode — drops the dangerouslySetInnerHTML escape hatch. */
  sub: React.ReactNode;
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
      <div className="text-[0.7rem] opacity-80 mt-0.5">{sub}</div>
    </div>
  );
}

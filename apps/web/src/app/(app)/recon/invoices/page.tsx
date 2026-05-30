import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/supabase/company";
import Link from "next/link";
import {
  Link2,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Landmark,
  Percent,
  Users2,
  X,
} from "lucide-react";
import { fmtMoney } from "@/lib/format";
import { ToastFromURL } from "@/components/ui/Toast";
import { PrintButton } from "@/components/ui/PrintButton";
import { AutoMatchPartner } from "./AutoMatchPartner";
import {
  type ReconRow,
  type ReconRpcRow,
  buildReconSummary,
  enrichReconRows,
  filterRecon,
  parseReconFilters,
} from "@/lib/reports/invoice-recon";

export const metadata = { title: "Нэхэмж ↔ Банк тулгалт — Тумэн Accounting" };

type SearchParams = Promise<{
  status?: string;
  partner_id?: string;
  month?: string;
}>;

export default async function InvoiceReconPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filters = parseReconFilters(sp);

  const supabase = await createClient();
  const company = await getCurrentCompany(supabase);

  if (!company) {
    return (
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-2xl font-semibold flex items-center gap-2 mb-4">
          <Link2 className="w-6 h-6" /> Нэхэмжлэл ↔ Банкны гүйлгээ тулгалт
        </h1>
        <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-900">
          Байгууллага сонгогдоогүй байна.
        </div>
      </div>
    );
  }

  // Single RPC returns all partners with either side activity, optionally
  // narrowed by month. Status + partner_id are applied client-side so chip
  // counts stay accurate.
  const { data: rpcRows, error } = await supabase.rpc("fn_invoice_bank_recon", {
    p_company_id: company.companyId,
    p_month: filters.month === "" ? null : filters.month,
  });

  const enriched = enrichReconRows((rpcRows ?? []) as ReconRpcRow[]);
  const summary = buildReconSummary(enriched);
  const filtered = filterRecon(enriched, filters);

  // Partner dropdown — all known partners that appear in the RPC result
  const partnerOptions = enriched
    .map((r) => ({ id: r.partner_id, name: r.partner_name }))
    .sort((a, b) => a.name.localeCompare(b.name, "mn"));

  const today = new Date().toISOString().slice(0, 10);
  const hasFilter = !!(filters.status || filters.partnerId || filters.month);

  return (
    <div className="space-y-3 max-w-[1600px] mx-auto">
      <ToastFromURL />

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <Link2 className="w-6 h-6" /> Нэхэмжлэл ↔ Банкны гүйлгээ тулгалт
          <span className="text-base text-slate-500 font-normal">
            — &quot;{company.meta?.name ?? "—"}&quot; ХХК
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{today} байдлаар</span>
          <PrintButton />
        </div>
      </div>

      {/* 5 KPI gradient cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <KpiCard
          label="Нийт нэхэмжлэл"
          value={`${fmtMoneyInt(summary.amt.inv)}₮`}
          sub={`${summary.cnt.total} харилцагч`}
          icon={<FileText className="w-4 h-4" />}
          gradient="from-blue-500 to-blue-700"
        />
        <KpiCard
          label="Тулгасан"
          value={`${fmtMoneyInt(summary.amt.matched)}₮`}
          sub={`${summary.cnt.match} харилцагч тэнцсэн`}
          icon={<CheckCircle2 className="w-4 h-4" />}
          gradient="from-emerald-500 to-emerald-700"
        />
        <KpiCard
          label="Нэхэмжлэл дутуу"
          value={`${fmtMoneyInt(summary.amt.inv_more)}₮`}
          sub={`${summary.cnt.inv_more} харилцагч · банкаас цугласаагүй`}
          icon={<AlertTriangle className="w-4 h-4" />}
          gradient="from-red-500 to-red-700"
        />
        <KpiCard
          label="Банк илүү"
          value={`${fmtMoneyInt(summary.amt.bank_more)}₮`}
          sub={`${summary.cnt.bank_more} харилцагч · нэхэмж байхгүй`}
          icon={<Landmark className="w-4 h-4" />}
          gradient="from-orange-500 to-orange-700"
        />
        <KpiCard
          label="Тулгалтын хувь"
          value={`${summary.reconPct.toFixed(1)}%`}
          sub={<>&nbsp;</>}
          icon={<Percent className="w-4 h-4" />}
          gradient="from-purple-700 to-fuchsia-700"
        />
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded p-2 print:hidden">
        <form method="GET" className="flex flex-wrap items-center gap-2">
          {/* Hidden status — gets overridden by clicked chip's name=status value */}
          <input type="hidden" name="status" value={filters.status} />

          <div className="inline-flex rounded border border-slate-300 overflow-hidden text-xs">
            <ChipButton label="Бүгд" count={summary.cnt.total} active={!filters.status} value="" color="slate" />
            <ChipButton label="✓ Тулгасан" count={summary.cnt.match} active={filters.status === "match"} value="match" color="emerald" />
            <ChipButton label="Дутуу" count={summary.cnt.inv_more} active={filters.status === "inv_more"} value="inv_more" color="red" />
            <ChipButton label="Банк илүү" count={summary.cnt.bank_more} active={filters.status === "bank_more"} value="bank_more" color="blue" />
          </div>

          {/* Partner dropdown */}
          <label htmlFor="rc-partner" className="sr-only">Харилцагч</label>
          <select
            id="rc-partner"
            name="partner_id"
            defaultValue={filters.partnerId}
            className="px-2 py-1 border border-slate-300 rounded text-xs max-w-[260px]"
          >
            <option value="">— Бүх харилцагч —</option>
            {partnerOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Month dropdown */}
          <label htmlFor="rc-month" className="sr-only">Сар</label>
          <select
            id="rc-month"
            name="month"
            defaultValue={filters.month === "" ? "" : String(filters.month)}
            className="px-2 py-1 border border-slate-300 rounded text-xs"
          >
            <option value="">Бүх сар</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}-р сар</option>
            ))}
          </select>

          <button
            type="submit"
            className="px-3 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs"
          >
            Шүүх
          </button>

          {hasFilter && (
            <Link
              href="/recon/invoices"
              className="px-1.5 py-1 border border-red-300 text-red-700 rounded text-xs hover:bg-red-50 flex items-center gap-1"
              title="Шүүлт цэвэрлэх"
            >
              <X className="w-3 h-3" /> Цэвэрлэх
            </Link>
          )}
        </form>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 flex items-start gap-2 print:hidden">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Тулгалт татаж чадсангүй</div>
            <div className="text-xs opacity-80 mt-0.5">{error.message}</div>
          </div>
        </div>
      )}

      {/* Reconciliation table */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <div className="flex items-center px-3 py-2 text-white text-sm font-semibold" style={{ background: "#1a3c5e" }}>
          <Link2 className="w-4 h-4 mr-1.5" />
          Харилцагчаар нэхэмжлэл ↔ банк тулгалт
          {filters.status === "match" && " — ✓ Тулгасан"}
          {filters.status === "inv_more" && " — Дутуу"}
          {filters.status === "bank_more" && " — Банк илүү"}
          <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs">{filtered.length}</span>
          <span className="ml-auto text-xs opacity-80 flex items-center gap-1">
            <Users2 className="w-3 h-3" /> {filtered.length} харилцагч
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-700 text-white">
              <tr>
                <th className="px-2 py-2 text-center font-semibold w-10">№</th>
                <th className="px-2 py-2 text-left font-semibold">Харилцагч</th>
                <th className="px-2 py-2 text-right font-semibold w-32" style={{ color: "#81d4fa" }}>Нэхэмжлэл</th>
                <th className="px-2 py-2 text-right font-semibold w-32" style={{ color: "#a5d6a7" }}>Банк орлого</th>
                <th className="px-2 py-2 text-right font-semibold w-32" style={{ color: "#ffcc80" }}>Тулгасан</th>
                <th className="px-2 py-2 text-right font-semibold w-32">Зөрүү</th>
                <th className="px-2 py-2 text-center font-semibold w-24">Төлөв</th>
                <th className="px-2 py-2 text-center font-semibold w-28 print:hidden">Үйлдэл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto opacity-30 mb-2" />
                    Тулгах ажил алга
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => <ReconRowEl key={r.partner_id} r={r} index={i + 1} />)
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="text-white font-bold" style={{ background: "#37474f" }}>
                <tr>
                  <td colSpan={2} className="px-2 py-1.5 text-right text-[0.7rem]">
                    Нийт {filtered.length}:
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[0.72rem]" style={{ color: "#81d4fa" }}>
                    {fmtMoneyInt(filtered.reduce((s, r) => s + r.total_inv, 0))}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[0.72rem]" style={{ color: "#a5d6a7" }}>
                    {fmtMoneyInt(filtered.reduce((s, r) => s + r.total_bank, 0))}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[0.72rem]" style={{ color: "#ffcc80" }}>
                    {fmtMoneyInt(filtered.reduce((s, r) => s + r.matched, 0))}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[0.72rem]">
                    {(() => {
                      const td = filtered.reduce((s, r) => s + r.diff, 0);
                      if (Math.abs(td) < 1) return <span className="text-emerald-300">✓</span>;
                      if (td > 0) return <span className="text-blue-200">+{fmtMoneyInt(td)}</span>;
                      return <span className="text-red-300">{fmtMoneyInt(td)}</span>;
                    })()}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { background: white; }
          table { font-size: 8pt !important; }
        }
      `}</style>
    </div>
  );
}

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
  color: "slate" | "red" | "amber" | "emerald" | "blue";
}) {
  const palette = {
    slate:   { active: "bg-slate-700 text-white",     idle: "text-slate-700 hover:bg-slate-50",    badge: "bg-slate-200 text-slate-700"  },
    red:     { active: "bg-red-600 text-white",       idle: "text-red-700 hover:bg-red-50",        badge: "bg-red-100 text-red-700"       },
    amber:   { active: "bg-amber-500 text-white",     idle: "text-amber-700 hover:bg-amber-50",    badge: "bg-amber-100 text-amber-700"   },
    emerald: { active: "bg-emerald-600 text-white",   idle: "text-emerald-700 hover:bg-emerald-50", badge: "bg-emerald-100 text-emerald-700" },
    blue:    { active: "bg-blue-600 text-white",      idle: "text-blue-700 hover:bg-blue-50",      badge: "bg-blue-100 text-blue-700"     },
  }[color];

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

function ReconRowEl({ r, index }: { r: ReconRow; index: number }) {
  const rowBg =
    r.status === "match"
      ? "bg-emerald-50/60"
      : r.diff < -1
        ? "bg-red-50/60"
        : r.diff > 1
          ? "bg-blue-50/60"
          : "";

  return (
    <tr className={rowBg}>
      <td className="px-2 py-1.5 text-center text-slate-400 text-[0.7rem]">{index}</td>
      <td className="px-2 py-1.5">
        <Link
          href={`/partners/${r.partner_id}`}
          className="font-semibold text-blue-700 hover:underline text-[0.76rem]"
        >
          {r.partner_name}
        </Link>
        <div className="text-slate-500 text-[0.62rem] mt-0.5">
          {r.cnt_inv}нэхэмж · {r.cnt_bank}гүйлгээ
          {r.partner_register && <> · <span className="font-mono">{r.partner_register}</span></>}
        </div>
        {r.total_inv > 0 && (
          <div className="h-1 bg-slate-100 rounded overflow-hidden mt-1 w-40">
            <div
              className={`h-full ${
                r.matchPct >= 100
                  ? "bg-emerald-500"
                  : r.matchPct >= 50
                    ? "bg-amber-500"
                    : "bg-red-500"
              }`}
              style={{ width: `${r.matchPct}%` }}
            />
          </div>
        )}
      </td>
      <td className="px-2 py-1.5 text-right font-mono" style={{ color: "#0277bd" }}>
        {fmtMoneyInt(r.total_inv)}
      </td>
      <td className="px-2 py-1.5 text-right font-mono" style={{ color: "#2e7d32" }}>
        {fmtMoneyInt(r.total_bank)}
      </td>
      <td className="px-2 py-1.5 text-right font-mono" style={{ color: "#e65100" }}>
        {r.matched > 0 ? fmtMoneyInt(r.matched) : <span className="text-slate-400">—</span>}
      </td>
      <td className="px-2 py-1.5 text-right font-mono font-bold">
        {r.status === "match" ? (
          <span className="text-emerald-600">—</span>
        ) : r.diff > 0 ? (
          <span className="text-blue-700">+{fmtMoneyInt(r.diff)}</span>
        ) : (
          <span className="text-red-700">{fmtMoneyInt(r.diff)}</span>
        )}
      </td>
      <td className="px-2 py-1.5 text-center">
        {r.status === "match" ? (
          <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[0.65rem] font-semibold whitespace-nowrap">
            ✓ Тэнцэнэ
          </span>
        ) : r.diff > 0 ? (
          <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[0.65rem] font-semibold whitespace-nowrap">
            Банк илүү
          </span>
        ) : (
          <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 rounded text-[0.65rem] font-semibold whitespace-nowrap">
            Дутуу
          </span>
        )}
      </td>
      <td className="px-2 py-1.5 text-center print:hidden">
        {r.total_inv > 0 && r.total_bank > 0 && <AutoMatchPartner partnerId={r.partner_id} />}
      </td>
    </tr>
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
  sub: React.ReactNode;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <div className={`bg-gradient-to-br ${gradient} text-white rounded p-3 shadow-sm`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[0.7rem] opacity-90">{label}</div>
        {icon}
      </div>
      <div className="text-lg font-bold font-mono leading-tight">{value}</div>
      <div className="text-[0.65rem] opacity-80 mt-0.5">{sub}</div>
    </div>
  );
}

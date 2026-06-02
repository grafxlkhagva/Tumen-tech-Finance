import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/supabase/company";
import Link from "next/link";
import {
  HandCoins, FileText, CheckCircle2, Clock, Plus, AlertTriangle, Info, Eye,
} from "lucide-react";
import { fmtMoney } from "@/lib/format";
import { ToastFromURL } from "@/components/ui/Toast";
import { PrintButton } from "@/components/ui/PrintButton";
import {
  type ReceivableRpcRow,
  buildReceivableSummary,
  parseArStatus,
} from "@/lib/reports/receivables";

export const metadata = { title: "Авлагын бүртгэл — Тумэн Accounting" };

type SearchParams = Promise<{ status?: string }>;

// CRITICAL FIX #3 — NaN-safe number coercion. Number("abc") returns NaN which
// would otherwise propagate through reductions ("NaN₮" in the footer).
function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtInt(n: number): string {
  return fmtMoney(n).replace(/\.00$/, "");
}

export default async function ReceivablesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const status = parseArStatus(sp.status);

  const supabase = await createClient();
  const company = await getCurrentCompany(supabase);

  if (!company) {
    return (
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-2xl font-semibold flex items-center gap-2 mb-4">
          <HandCoins className="w-6 h-6" /> Авлагын бүртгэл
        </h1>
        <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-900">
          Байгууллага сонгогдоогүй байна.
        </div>
      </div>
    );
  }

  // Pull the FULL set (no status filter) so the chip counts are accurate;
  // narrow on the client below.
  const { data, error } = await supabase.rpc("fn_receivables_by_partner", {
    p_company_id: company.companyId,
    p_status: null,
  });

  const allRows = (data ?? []) as ReceivableRpcRow[];
  const summary = buildReceivableSummary(allRows);
  const filtered = status ? allRows.filter((r) => r.status === status) : allRows;

  return (
    <div className="space-y-3 max-w-[1600px] mx-auto">
      <ToastFromURL />

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <HandCoins className="w-6 h-6" /> Авлагын бүртгэл
          {/* CRITICAL FIX #2 — surface tenant name like the other rebuilt pages. */}
          <span className="text-base text-slate-500 font-normal">
            — &quot;{company.meta?.name ?? "—"}&quot; ХХК
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/receivables/new"
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Авлага нэмэх
          </Link>
          <PrintButton />
        </div>
      </div>

      {/* 3 KPI gradient cards (legacy parity) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard
          label="НИЙТ НЭХЭМЖЛЭЛ"
          value={`${fmtInt(summary.totals.invoiced)}₮`}
          sub={`${summary.cnt.total} харилцагч`}
          icon={<FileText className="w-5 h-5" />}
          gradient="from-blue-500 to-blue-700"
        />
        <KpiCard
          label="ЦУГЛАСАН ОРЛОГО"
          value={`${fmtInt(summary.totals.collected)}₮`}
          sub="Банкны орлогоор"
          icon={<CheckCircle2 className="w-5 h-5" />}
          gradient="from-emerald-500 to-emerald-700"
        />
        <KpiCard
          label="ҮЛДЭГДЭЛ АВЛАГА"
          value={`${fmtInt(summary.totals.remaining)}₮`}
          sub="Үлдэгдэлтэй"
          icon={<Clock className="w-5 h-5" />}
          gradient={summary.totals.remaining > 0
            ? "from-orange-500 to-orange-700"
            : "from-emerald-500 to-emerald-700"}
        />
      </div>

      {/* Status chips + info */}
      <div className="bg-white border border-slate-200 rounded p-2 flex items-center flex-wrap gap-2 print:hidden">
        <div className="inline-flex rounded border border-slate-300 overflow-hidden text-xs">
          <Chip
            label="Бүгд"
            count={summary.cnt.total}
            active={!status}
            href="/receivables"
            color="slate"
          />
          <Chip
            label="Нээлттэй"
            count={summary.cnt.open}
            active={status === "open"}
            href="/receivables?status=open"
            color="red"
          />
          <Chip
            label="Хэсэгчлэн"
            count={summary.cnt.partial}
            active={status === "partial"}
            href="/receivables?status=partial"
            color="amber"
          />
          <Chip
            label="Төлөгдсөн"
            count={summary.cnt.paid}
            active={status === "paid"}
            href="/receivables?status=paid"
            color="emerald"
          />
        </div>
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <Info className="w-3 h-3" />
          E-Баримт нэхэмжлэл + банкны орлогоос автоматаар тооцоолсон
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 flex items-start gap-2 print:hidden">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Өгөгдөл татаж чадсангүй</div>
            <div className="text-xs opacity-80 mt-0.5">{error.message}</div>
          </div>
        </div>
      )}

      {/* Print stylesheet — A4 landscape so the 9-column table fits. */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { background: white; }
          table { font-size: 8pt !important; }
          thead { background: #1a3c5e !important; color: white !important; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="px-2 py-2 text-left font-semibold w-28">Код</th>
                <th className="px-2 py-2 text-left font-semibold">Харилцагч</th>
                <th className="px-2 py-2 text-left font-semibold w-28">Регистр</th>
                <th className="px-2 py-2 text-right font-semibold w-36">E-Баримт дүн</th>
                <th className="px-2 py-2 text-right font-semibold w-32">Цугласан</th>
                <th className="px-2 py-2 text-right font-semibold w-32">Үлдэгдэл</th>
                <th className="px-2 py-2 text-left font-semibold w-28">Тулгалт</th>
                <th className="px-2 py-2 text-center font-semibold w-24">Төлөв</th>
                <th className="px-2 py-2 text-center font-semibold w-14 print:hidden"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400">
                    <FileText className="w-8 h-8 mx-auto opacity-30 mb-2" />
                    Бичлэг олдсонгүй
                  </td>
                </tr>
              ) : (
                filtered.map((r) => <ReceivableRowEl key={r.partner_id} r={r} />)
              )}
            </tbody>
            {filtered.length > 0 && (() => {
              // One pass for all three totals (was three reduces) + NaN-safe.
              const footerTotals = filtered.reduce(
                (s, r) => ({
                  inv: s.inv + safeNum(r.invoiced),
                  col: s.col + safeNum(r.collected),
                  rem: s.rem + safeNum(r.remaining),
                }),
                { inv: 0, col: 0, rem: 0 },
              );
              return (
                <tfoot className="bg-blue-50 font-bold">
                  <tr>
                    <td colSpan={3} className="px-2 py-1.5 text-right">
                      Нийт {filtered.length} харилцагч:
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {fmtInt(footerTotals.inv)}₮
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-emerald-700">
                      {fmtInt(footerTotals.col)}₮
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-red-700">
                      {fmtInt(footerTotals.rem)}₮
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              );
            })()}
          </table>
        </div>
      </div>
    </div>
  );
}

function Chip({
  label, count, active, href, color,
}: {
  label: string;
  count: number;
  active: boolean;
  href: string;
  color: "slate" | "red" | "amber" | "emerald";
}) {
  const palette = {
    slate:   { active: "bg-slate-700 text-white",   idle: "text-slate-700 hover:bg-slate-50",    badge: "bg-slate-200 text-slate-700"   },
    red:     { active: "bg-red-600 text-white",     idle: "text-red-700 hover:bg-red-50",        badge: "bg-red-100 text-red-700"        },
    amber:   { active: "bg-amber-500 text-white",   idle: "text-amber-700 hover:bg-amber-50",    badge: "bg-amber-100 text-amber-700"    },
    emerald: { active: "bg-emerald-600 text-white", idle: "text-emerald-700 hover:bg-emerald-50", badge: "bg-emerald-100 text-emerald-700" },
  }[color];
  return (
    <Link
      href={href}
      className={`px-3 py-1 flex items-center gap-1 border-r border-slate-200 last:border-r-0 ${active ? palette.active : palette.idle}`}
    >
      {label}
      <span className={`px-1.5 py-0.5 rounded text-[0.65rem] ${active ? "bg-white/25" : palette.badge}`}>
        {count}
      </span>
    </Link>
  );
}

function ReceivableRowEl({ r }: { r: ReceivableRpcRow }) {
  // NaN-safe column extraction — handles the case where the RPC returns
  // numeric-as-string and a bad row would otherwise render "NaN₮".
  const invoiced = safeNum(r.invoiced);
  const collected = safeNum(r.collected);
  const remaining = safeNum(r.remaining);
  const matchPct = safeNum(r.match_pct);

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-2 py-1.5 text-slate-500 font-mono text-[0.72rem]">
        {r.partner_code || "—"}
      </td>
      <td className="px-2 py-1.5">
        <Link
          href={`/partners/${r.partner_id}`}
          className="font-semibold text-slate-800 hover:text-blue-700 hover:underline text-[0.78rem]"
        >
          {r.partner_name}
        </Link>
      </td>
      <td className="px-2 py-1.5 text-slate-500 text-[0.72rem]">
        {r.partner_register || "—"}
      </td>
      <td className="px-2 py-1.5 text-right font-mono">{fmtInt(invoiced)}₮</td>
      <td className="px-2 py-1.5 text-right font-mono text-emerald-700">
        {fmtInt(collected)}₮
      </td>
      <td
        className={`px-2 py-1.5 text-right font-mono font-bold ${remaining > 0 ? "text-red-700" : "text-emerald-700"}`}
      >
        {fmtInt(remaining)}₮
      </td>
      <td className="px-2 py-1.5">
        <div className="h-1.5 bg-slate-100 rounded overflow-hidden w-20">
          <div
            className={`h-full ${matchPct >= 100 ? "bg-emerald-500" : matchPct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
            style={{ width: `${Math.min(100, matchPct)}%` }}
          />
        </div>
        <div className="text-[0.62rem] text-slate-500 mt-0.5">{matchPct.toFixed(0)}%</div>
      </td>
      <td className="px-2 py-1.5 text-center">
        {r.status === "paid" ? (
          <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[0.65rem] font-semibold">
            Төлөгдсөн
          </span>
        ) : r.status === "partial" ? (
          <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[0.65rem] font-semibold">
            Хэсэгчлэн
          </span>
        ) : (
          <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 rounded text-[0.65rem] font-semibold">
            Нээлттэй
          </span>
        )}
      </td>
      <td className="px-2 py-1.5 text-center print:hidden">
        <Link
          href={`/partners/${r.partner_id}`}
          className="inline-flex border border-slate-300 text-slate-700 hover:bg-slate-50 px-1.5 py-1 rounded"
          title="Дэлгэрэнгүй"
        >
          <Eye className="w-3 h-3" />
        </Link>
      </td>
    </tr>
  );
}

function KpiCard({
  label, value, sub, icon, gradient,
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
        <div className="text-xs opacity-90 uppercase tracking-wide font-semibold">{label}</div>
        {icon}
      </div>
      <div className="text-xl font-bold font-mono leading-tight">{value}</div>
      <div className="text-[0.7rem] opacity-80 mt-0.5">{sub}</div>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/supabase/company";
import Link from "next/link";
import {
  Wallet, FileText, Landmark, Scale, Plus, AlertTriangle, Info, Eye, Search, X,
} from "lucide-react";
import { fmtMoney } from "@/lib/format";
import { ToastFromURL } from "@/components/ui/Toast";
import { PrintButton } from "@/components/ui/PrintButton";
import {
  type PayableRpcRow,
  PAGE_LIMIT,
  buildPayableSummary,
  displayApStatus,
  parseApStatus,
  safeNum,
} from "@/lib/reports/payables";

export const metadata = { title: "Өглөгийн бүртгэл — Тумэн Accounting" };

type SearchParams = Promise<{ status?: string; q?: string }>;

function fmtInt(n: number): string {
  return fmtMoney(n).replace(/\.00$/, "");
}

export default async function PayablesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const status = parseApStatus(sp.status);
  const q = (sp.q ?? "").trim().slice(0, 100);

  const supabase = await createClient();
  const company = await getCurrentCompany(supabase);

  if (!company) {
    return (
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-2xl font-semibold flex items-center gap-2 mb-4">
          <Wallet className="w-6 h-6" /> Өглөгийн бүртгэл
        </h1>
        <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-900">
          Байгууллага сонгогдоогүй байна.
        </div>
      </div>
    );
  }

  // RPC pulls the unfiltered result set so chip counts are accurate; the
  // status chip filter is then applied client-side. Server-side ILIKE search
  // narrows the row set early (no point loading thousands of suppliers when
  // the user typed a name).
  const { data, error } = await supabase.rpc("fn_payables_by_partner", {
    p_company_id: company.companyId,
    p_status: null,
    p_search: q || null,
  });

  const allRows = (data ?? []) as PayableRpcRow[];
  const limitReached = allRows.length >= PAGE_LIMIT;
  const summary = buildPayableSummary(allRows);
  // Filter by the *display* status so "overpaid" is its own bucket and
  // "open" excludes overpaid suppliers.
  const filtered = status
    ? allRows.filter((r) => displayApStatus(r) === status)
    : allRows;

  return (
    <div className="space-y-3 max-w-[1600px] mx-auto">
      <ToastFromURL />

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <Wallet className="w-6 h-6" /> Өглөгийн бүртгэл
          <span className="text-base text-slate-500 font-normal">
            — &quot;{company.meta?.name ?? "—"}&quot; ХХК
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/payables/new"
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Өглөг нэмэх
          </Link>
          <PrintButton />
        </div>
      </div>

      {/* 3 KPI gradient cards (legacy red/purple/orange) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard
          label="НИЙТ НЭХЭМЖЛЭЛ"
          value={`${fmtInt(summary.totals.invoiced)}₮`}
          sub={`${summary.cnt.total} харилцагч`}
          icon={<FileText className="w-5 h-5" />}
          gradient="from-red-500 to-red-700"
        />
        <KpiCard
          label="НИЙТ ТӨЛСӨН"
          value={`${fmtInt(summary.totals.paid)}₮`}
          sub="Банкны зарлагаар"
          icon={<Landmark className="w-5 h-5" />}
          gradient="from-purple-600 to-fuchsia-700"
        />
        <KpiCard
          label="ҮЛДЭГДЭЛ ӨГЛӨГ"
          value={`${fmtInt(summary.totals.remaining)}₮`}
          sub="Тулгалтаар"
          icon={<Scale className="w-5 h-5" />}
          gradient={summary.totals.remaining > 0
            ? "from-orange-500 to-orange-700"
            : "from-emerald-500 to-emerald-700"}
        />
      </div>

      {/* Search + status chips */}
      <div className="bg-white border border-slate-200 rounded p-2 print:hidden">
        <form method="GET" className="flex items-center flex-wrap gap-2">
          {/* Hidden status preserves chip-selection unless a chip button
              overrides via its own name=status value. */}
          <input type="hidden" name="status" value={status} />

          {/* Search box */}
          <div className="flex items-center gap-1">
            <label htmlFor="ap-q" className="sr-only">Хайх</label>
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="ap-q"
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Харилцагч нэрээр хайх…"
                maxLength={100}
                className="pl-6 pr-2 py-1 border border-slate-300 rounded text-xs w-[240px]"
              />
            </div>
            {q && (
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

          {/* Status chips as form buttons — clicked button's value overrides
              the hidden status input, preserving the current search text. */}
          <div className="inline-flex rounded border border-slate-300 overflow-hidden text-xs">
            <ChipButton
              label="Бүгд"
              count={summary.cnt.total}
              active={!status}
              value=""
              color="slate"
            />
            <ChipButton
              label="Нээлттэй"
              count={summary.cnt.open}
              active={status === "open"}
              value="open"
              color="red"
            />
            <ChipButton
              label="Хэсэгчлэн"
              count={summary.cnt.partial}
              active={status === "partial"}
              value="partial"
              color="amber"
            />
            <ChipButton
              label="Төлөгдсөн"
              count={summary.cnt.paid}
              active={status === "paid"}
              value="paid"
              color="emerald"
            />
            {summary.cnt.overpaid > 0 && (
              <ChipButton
                label="Банк илүү"
                count={summary.cnt.overpaid}
                active={status === "overpaid"}
                value="overpaid"
                color="blue"
              />
            )}
          </div>

          <button
            type="submit"
            className="px-3 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs"
          >
            Шүүх
          </button>

          <span className="text-xs text-slate-500 flex items-center gap-1 ml-auto">
            <Info className="w-3 h-3" />
            E-Баримт нэхэмжлэл + банкны зарлагаас автоматаар тооцоолсон
          </span>
        </form>
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

      {limitReached && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900 flex items-start gap-2 print:hidden">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Хязгаар хүрсэн ({PAGE_LIMIT.toLocaleString()} мөр)</div>
            <div className="opacity-80 mt-0.5">
              Энэ хязгаараас илүү нийлүүлэгч бүртгэлд байгаа. Бүгдийг харахын тулд
              нэрээр хайх эсвэл төлвөөр шүүнэ үү.
            </div>
          </div>
        </div>
      )}

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
                <th className="px-2 py-2 text-left font-semibold w-24">Код</th>
                <th className="px-2 py-2 text-left font-semibold">Харилцагч</th>
                <th className="px-2 py-2 text-left font-semibold w-28">Регистр</th>
                <th className="px-2 py-2 text-right font-semibold w-32">Нэхэмжлэл</th>
                <th className="px-2 py-2 text-right font-semibold w-32">Төлсөн</th>
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
                    {q || status ? "Шүүлтэд тохирох бичлэг алга" : "Бичлэг олдсонгүй"}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => <PayableRowEl key={r.partner_id} r={r} />)
              )}
            </tbody>
            {filtered.length > 0 && (() => {
              const ft = filtered.reduce(
                (s, r) => ({
                  inv: s.inv + safeNum(r.invoiced),
                  paid: s.paid + safeNum(r.paid),
                  rem: s.rem + safeNum(r.remaining),
                }),
                { inv: 0, paid: 0, rem: 0 },
              );
              return (
                <tfoot className="bg-blue-50 font-bold">
                  <tr>
                    <td colSpan={3} className="px-2 py-1.5 text-right">
                      Нийт {filtered.length} харилцагч:
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {fmtInt(ft.inv)}₮
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-purple-700">
                      {fmtInt(ft.paid)}₮
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-orange-700">
                      {fmtInt(ft.rem)}₮
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

function ChipButton({
  label, count, active, value, color,
}: {
  label: string;
  count: number;
  active: boolean;
  value: string;
  color: "slate" | "red" | "amber" | "emerald" | "blue";
}) {
  const palette = {
    slate:   { active: "bg-slate-700 text-white",   idle: "text-slate-700 hover:bg-slate-50",    badge: "bg-slate-200 text-slate-700"  },
    red:     { active: "bg-red-600 text-white",     idle: "text-red-700 hover:bg-red-50",        badge: "bg-red-100 text-red-700"       },
    amber:   { active: "bg-amber-500 text-white",   idle: "text-amber-700 hover:bg-amber-50",    badge: "bg-amber-100 text-amber-700"   },
    emerald: { active: "bg-emerald-600 text-white", idle: "text-emerald-700 hover:bg-emerald-50", badge: "bg-emerald-100 text-emerald-700" },
    blue:    { active: "bg-blue-600 text-white",    idle: "text-blue-700 hover:bg-blue-50",      badge: "bg-blue-100 text-blue-700"     },
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

function PayableRowEl({ r }: { r: PayableRpcRow }) {
  const invoiced = safeNum(r.invoiced);
  const paid = safeNum(r.paid);
  const remaining = safeNum(r.remaining);
  const diff = safeNum(r.diff);
  const matchPct = safeNum(r.match_pct);
  const display = displayApStatus(r);

  return (
    <tr className={diff < -1 ? "bg-blue-50/40 hover:bg-blue-50" : "hover:bg-slate-50"}>
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
      <td className="px-2 py-1.5 text-right font-mono text-purple-700">
        {fmtInt(paid)}₮
      </td>
      {/*
        Legacy renders diff (can be negative = overpaid) as the headline, with
        red for remaining > 0 and blue for overpaid. `remaining` itself is
        always ≥0 (max with 0); we use `diff` to color and prefix the sign.
      */}
      <td
        className={`px-2 py-1.5 text-right font-mono font-bold ${
          diff > 1 ? "text-red-700"
          : diff < -1 ? "text-blue-700"
          : "text-emerald-700"
        }`}
      >
        {diff > 1 ? `${fmtInt(remaining)}₮` : diff < -1 ? `+${fmtInt(-diff)}₮` : "—"}
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
        {display === "paid" ? (
          <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[0.65rem] font-semibold">
            Төлөгдсөн
          </span>
        ) : display === "partial" ? (
          <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[0.65rem] font-semibold">
            Хэсэгчлэн
          </span>
        ) : display === "overpaid" ? (
          <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[0.65rem] font-semibold">
            Банк илүү
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

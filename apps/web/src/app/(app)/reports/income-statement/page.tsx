import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/supabase/company";
import {
  TrendingUp,
  TrendingDown,
  Percent,
  LineChart,
  Download,
  AlertTriangle,
} from "lucide-react";
import { fmtMoney } from "@/lib/format";
import { PrintButton } from "@/components/ui/PrintButton";
import { IncomeStatementFilters } from "./IncomeStatementFilters";
import {
  type IsAccountRow,
  type IsRow,
  buildIncomeStatement,
  parseIsPeriod,
} from "@/lib/reports/income-statement";

export const metadata = { title: "Орлогын дэлгэрэнгүй тайлан — Тумэн Accounting" };

type SearchParams = Promise<{
  date_from?: string;
  date_to?: string;
  year?: string;
  month?: string;
}>;

export default async function IncomeStatementPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const period = parseIsPeriod(sp);

  const supabase = await createClient();
  const company = await getCurrentCompany(supabase);

  if (!company) {
    return (
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-2xl font-semibold flex items-center gap-2 mb-4">
          <TrendingUp className="w-6 h-6" /> Орлогын дэлгэрэнгүй тайлан
        </h1>
        <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-900">
          Байгууллага сонгогдоогүй байна. Профайл хэсгээс үндсэн байгууллагаа сонгоно уу.
        </div>
      </div>
    );
  }

  const [curRes, prvRes] = await Promise.all([
    supabase.rpc("fn_income_statement", {
      p_company_id: company.companyId,
      p_start: period.from,
      p_end: period.to,
    }),
    supabase.rpc("fn_income_statement", {
      p_company_id: company.companyId,
      p_start: period.prevFrom,
      p_end: period.prevTo,
    }),
  ]);

  const rpcError = curRes.error?.message || prvRes.error?.message || null;
  const is = buildIncomeStatement(
    (curRes.data ?? []) as IsAccountRow[],
    (prvRes.data ?? []) as IsAccountRow[],
  );

  const grossMarginCur =
    is.totals.revenue.current > 0
      ? (is.totals.grossProfit.current / is.totals.revenue.current) * 100
      : 0;
  const grossMarginPrv =
    is.totals.revenue.previous > 0
      ? (is.totals.grossProfit.previous / is.totals.revenue.previous) * 100
      : 0;

  const exportParams = new URLSearchParams();
  if (sp.date_from) exportParams.set("date_from", sp.date_from);
  if (sp.date_to) exportParams.set("date_to", sp.date_to);
  if (sp.year) exportParams.set("year", sp.year);
  if (sp.month) exportParams.set("month", sp.month);
  const exportUrl = `/api/export/income-statement?${exportParams.toString()}`;

  return (
    <div className="space-y-3 max-w-6xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-6 h-6" /> Орлогын дэлгэрэнгүй тайлан
        </h1>
        <div className="flex items-center gap-2">
          <a
            href={exportUrl}
            className="border border-green-300 bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded text-xs flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" /> Excel
          </a>
          <PrintButton />
        </div>
      </div>

      {/* Filter bar */}
      <IncomeStatementFilters
        dateFrom={period.from}
        dateTo={period.to}
        currentYear={Number(period.from.slice(0, 4)) || new Date().getFullYear()}
      />

      {/* Error banner */}
      {rpcError && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 flex items-start gap-2 print:hidden">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Тайлан татаж чадсангүй</div>
            <div className="text-xs opacity-80 mt-0.5">{rpcError}</div>
          </div>
        </div>
      )}

      {/* Form header — Сангийн Сайдын маяг */}
      <div className="bg-white rounded border border-slate-200 p-3 text-center print:border-0">
        <div className="text-xs text-slate-500">
          Сангийн Сайдын 2017 оны 361 дүгээр тушаалын 3 дугаар хавсралт
        </div>
        <h2 className="text-lg font-bold text-slate-900 mt-1 mb-1 uppercase">
          ОРЛОГЫН ДЭЛГЭРЭНГҮЙ ТАЙЛАН
        </h2>
        <div className="text-sm text-slate-700">
          &quot;{company.meta?.name ?? "(Байгууллага сонгогдоогүй)"}&quot; ХХК
          {" · "}
          {period.label}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          {company.meta?.register && <>Регистр: {company.meta.register} | </>}
          {company.meta?.tin && <>ХРГ: {company.meta.tin} | </>}
          (төгрөгөөр)
        </div>
      </div>

      {/* Main table */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-white">
            <tr>
              <th className="px-2 py-2 text-left w-16 text-xs font-semibold">Мөр</th>
              <th className="px-2 py-2 text-left text-xs font-semibold">Үзүүлэлт</th>
              <th className="px-2 py-2 text-right w-44 text-xs font-semibold">
                {period.prevFrom} → {period.prevTo}
              </th>
              <th className="px-2 py-2 text-right w-44 text-xs font-semibold">
                {period.from} → {period.to}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {is.rows.map((row, i) => (
              <IsRowEl key={`r-${i}-${row.num}-${row.label}`} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
        <KpiCard
          label="Нийт орлого"
          current={is.totals.revenue.current}
          previous={is.totals.revenue.previous}
          icon={<TrendingUp className="w-4 h-4" />}
          color="bg-blue-600"
        />
        <KpiCard
          label="Борлуулалтын өртөг"
          current={is.totals.cogs.current}
          previous={is.totals.cogs.previous}
          icon={<TrendingDown className="w-4 h-4" />}
          color="bg-orange-500"
        />
        <KpiCard
          label="Нийт ашгийн хувь"
          current={grossMarginCur}
          previous={grossMarginPrv}
          icon={<Percent className="w-4 h-4" />}
          color="bg-teal-600"
          isPercent
        />
        <KpiCard
          label="Цэвэр ашиг"
          current={is.totals.netProfit.current}
          previous={is.totals.netProfit.previous}
          icon={<LineChart className="w-4 h-4" />}
          color={is.totals.netProfit.current >= 0 ? "bg-emerald-600" : "bg-red-600"}
        />
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { background: white; }
          table { font-size: 8pt !important; }
          thead { background: #1a3c5e !important; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}

function IsRowEl({ row }: { row: IsRow }) {
  if (row.kind === "total") {
    const positive = row.current >= 0;
    return (
      <tr
        className="text-white font-bold"
        style={{
          background: positive
            ? "linear-gradient(90deg,#388E3C,#66BB6A)"
            : "linear-gradient(90deg,#C62828,#EF5350)",
        }}
      >
        <td className="px-2 py-2 font-mono">{row.num}</td>
        <td className="px-2 py-2 uppercase tracking-wide">{row.label}</td>
        <td className="px-2 py-2 text-right font-mono">{fmtSignedInt(row.previous)}</td>
        <td className="px-2 py-2 text-right font-mono">{fmtSignedInt(row.current)}</td>
      </tr>
    );
  }

  if (row.kind === "subtotal") {
    return (
      <tr className="bg-slate-100 font-bold">
        <td className="px-2 py-1.5 font-mono text-xs">{row.num}</td>
        <td className="px-2 py-1.5">{row.label}</td>
        <td className="px-2 py-1.5 text-right font-mono">{fmtSignedInt(row.previous)}</td>
        <td className="px-2 py-1.5 text-right font-mono">{fmtSignedInt(row.current)}</td>
      </tr>
    );
  }

  if (row.kind === "section") {
    const padding = row.indent === 1 ? "pl-6" : row.indent === 2 ? "pl-10" : "";
    return (
      <tr className={row.indent ? "" : "bg-slate-50 font-semibold"}>
        <td className="px-2 py-1.5 font-mono text-xs text-slate-500">{row.num}</td>
        <td className={`px-2 py-1.5 ${padding}`}>
          {row.indent ? row.label : <strong>{row.label}</strong>}
        </td>
        <td className="px-2 py-1.5 text-right font-mono">{fmtSignedInt(row.previous)}</td>
        <td className="px-2 py-1.5 text-right font-mono">{fmtSignedInt(row.current)}</td>
      </tr>
    );
  }

  // detail
  const isExpense = row.code?.startsWith("7") || row.code?.startsWith("8") || row.code?.startsWith("9");
  return (
    <tr className={isExpense ? "bg-red-50/30" : "bg-emerald-50/30"}>
      <td className="px-2 py-1 font-mono text-[0.7rem] text-slate-500">{row.code}</td>
      <td className="px-2 py-1 pl-7 text-slate-700 text-xs">{row.label}</td>
      <td className="px-2 py-1 text-right font-mono text-xs text-slate-400">—</td>
      <td className={`px-2 py-1 text-right font-mono text-xs ${isExpense ? "text-red-700" : "text-emerald-700"}`}>
        {fmtSignedInt(row.current)}
      </td>
    </tr>
  );
}

function fmtSignedInt(n: number): string {
  if (!n || Math.abs(n) < 0.5) return "—";
  return n.toLocaleString("mn-MN", { maximumFractionDigits: 0 });
}

function KpiCard({
  label,
  current,
  previous,
  icon,
  color,
  isPercent = false,
}: {
  label: string;
  current: number;
  previous: number;
  icon: React.ReactNode;
  color: string;
  isPercent?: boolean;
}) {
  const fmtVal = (v: number) =>
    isPercent ? `${v.toFixed(1)}%` : fmtMoney(v).replace(/\.00$/, "");
  return (
    <div className={`${color} text-white rounded p-3`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs opacity-80">{label}</div>
        {icon}
      </div>
      <div className="text-xl font-bold font-mono">{fmtVal(current)}</div>
      <div className="text-[0.7rem] opacity-70 mt-0.5">
        өмнө: {fmtVal(previous)}
      </div>
    </div>
  );
}

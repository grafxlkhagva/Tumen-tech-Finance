import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ScrollText, Download, Table2, Landmark } from "lucide-react";
import { PrintButton } from "@/components/ui/PrintButton";
import {
  type CashflowMonthlyRow,
  buildInternalCashflow,
  buildOfficialCashflow,
  parseYear,
  MN_MONTH_LABELS,
} from "@/lib/reports/cashflow";
import { CashflowInternalTable } from "./CashflowInternalTable";
import { CashflowOfficialView } from "./CashflowOfficialView";

export const metadata = { title: "Мөнгөн гүйлгээний тайлан — Тумэн Accounting" };

type SearchParams = Promise<{ year?: string; mode?: string }>;

export default async function CashflowPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const year = parseYear(sp.year);
  const mode = sp.mode === "official" ? "official" : "internal";

  const supabase = await createClient();
  const { data: uc } = await supabase
    .from("user_companies")
    .select("company_id, companies(name, register, tin)")
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  const companyId = uc?.company_id ?? null;
  const companyMeta = (Array.isArray(uc?.companies) ? uc?.companies[0] : uc?.companies) ?? null;

  if (!companyId) {
    return (
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-2xl font-semibold flex items-center gap-2 mb-4">
          <ScrollText className="w-6 h-6" /> Мөнгөн гүйлгээний тайлан
        </h1>
        <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-800">
          Байгууллага сонгогдоогүй байна.
        </div>
      </div>
    );
  }

  const [flowRes, openRes] = await Promise.all([
    supabase.rpc("fn_cashflow_monthly", { p_company_id: companyId, p_year: year }),
    supabase.rpc("fn_cashflow_opening_cash", { p_company_id: companyId, p_year: year }),
  ]);

  const rpcError = flowRes.error?.message || openRes.error?.message || null;
  const rawRows = (flowRes.data ?? []) as CashflowMonthlyRow[];
  const openCash = Number(openRes.data ?? 0);

  const internal = buildInternalCashflow(rawRows, openCash);
  const official = buildOfficialCashflow(rawRows);

  const yearOptions = [year - 2, year - 1, year, year + 1].filter((y) => y > 2020);
  const exportUrl = `/api/export/cashflow?year=${year}&mode=${mode}`;

  return (
    <div className="space-y-3 max-w-[1600px] mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <ScrollText className="w-6 h-6" /> Мөнгөн гүйлгээний тайлан
        </h1>
        <div className="flex items-center gap-2">
          {/* Mode tabs */}
          <div className="inline-flex rounded border border-slate-300 overflow-hidden text-xs">
            <Link
              href={`/reports/cashflow?year=${year}&mode=internal`}
              className={`px-3 py-1.5 flex items-center gap-1 ${mode === "internal" ? "bg-blue-600 text-white" : "bg-white text-blue-700 hover:bg-blue-50"}`}
            >
              <Table2 className="w-3.5 h-3.5" /> Дотоод тайлан
            </Link>
            <Link
              href={`/reports/cashflow?year=${year}&mode=official`}
              className={`px-3 py-1.5 flex items-center gap-1 border-l border-slate-300 ${mode === "official" ? "bg-blue-600 text-white" : "bg-white text-blue-700 hover:bg-blue-50"}`}
            >
              <Landmark className="w-3.5 h-3.5" /> Сангийн яамны маягт
            </Link>
          </div>

          {/* Year selector */}
          <form method="GET" className="flex items-center gap-1.5">
            <input type="hidden" name="mode" value={mode} />
            <select
              name="year"
              defaultValue={year}
              className="px-2 py-1.5 border border-slate-300 rounded text-xs"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y} он</option>
              ))}
            </select>
            <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs">
              Үзэх
            </button>
          </form>

          <a
            href={exportUrl}
            className="border border-green-300 bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded text-xs flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" /> Excel
          </a>
          <PrintButton />
        </div>
      </div>

      {/* Error banner */}
      {rpcError && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 print:hidden">
          RPC алдаа: {rpcError}
        </div>
      )}

      {/* Mode-specific render */}
      {mode === "internal" ? (
        <>
          {/* Print + screen header */}
          <div
            className="rounded-xl text-white text-center py-3 px-4"
            style={{ background: "linear-gradient(135deg,#1a3c5e,#2196F3)" }}
          >
            <div className="text-xs opacity-75">
              {(companyMeta?.name ?? "Тумэн") + " ХХК"}
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-wide uppercase mt-1">
              МӨНГӨН УРСГАЛЫН ТАЙЛАН — {year} ОН
            </h2>
            <div className="text-xs opacity-75 mt-0.5">Шууд арга &nbsp;·&nbsp; MNT</div>
          </div>

          <CashflowInternalTable data={internal} months={MN_MONTH_LABELS} />

          <div className="text-xs text-slate-500 print:hidden">
            Эх сурвалж: бүх банкны cash_transactions &nbsp;·&nbsp; Эхний үлдэгдэл:&nbsp;
            <span className="font-mono">{internal.openCash.toLocaleString("mn-MN")}₮</span>
            &nbsp;({year - 1}-12-31)
          </div>
        </>
      ) : (
        <CashflowOfficialView
          data={official}
          companyMeta={companyMeta as { name?: string; register?: string | null } | null}
          year={year}
        />
      )}

      <style>{`
        @media print {
          @page { size: A3 landscape; margin: 10mm; }
          body { background: white; }
          .cf-tbl { font-size: 7pt !important; }
          .cf-tbl td, .cf-tbl th { padding: 2px 4px !important; }
        }
      `}</style>
    </div>
  );
}

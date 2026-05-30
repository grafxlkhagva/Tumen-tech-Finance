import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/supabase/company";
import Link from "next/link";
import { ScrollText, Download, Table2, Landmark, AlertTriangle } from "lucide-react";
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
  const company = await getCurrentCompany(supabase);

  // Тэргүүн алдаа #2: helper-р resolution → typed CompanyMeta авна.
  if (!company) {
    return (
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-2xl font-semibold flex items-center gap-2 mb-4">
          <ScrollText className="w-6 h-6" /> Мөнгөн гүйлгээний тайлан
        </h1>
        <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-900">
          Байгууллага сонгогдоогүй байна. Профайл хэсгээс үндсэн байгууллагаа сонгоно уу.
        </div>
      </div>
    );
  }

  const [flowRes, openRes] = await Promise.all([
    supabase.rpc("fn_cashflow_monthly", { p_company_id: company.companyId, p_year: year }),
    supabase.rpc("fn_cashflow_opening_cash", { p_company_id: company.companyId, p_year: year }),
  ]);

  const rpcError = flowRes.error?.message || openRes.error?.message || null;
  const rawRows = (flowRes.data ?? []) as CashflowMonthlyRow[];
  const openCash = Number(openRes.data ?? 0);

  const internal = buildInternalCashflow(rawRows, openCash);
  const official = buildOfficialCashflow(rawRows);

  // Тэргүүн алдаа #1: бүх жилийн dropdown — 2021-аас current+1 хүртэл.
  const minYear = 2021;
  const maxYear = new Date().getFullYear() + 1;
  const yearOptions = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);

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
            <label htmlFor="cf-year" className="sr-only">Жил</label>
            <select
              id="cf-year"
              name="year"
              defaultValue={year}
              className="px-2 py-1.5 border border-slate-300 rounded text-xs"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y} он</option>
              ))}
            </select>
            <button type="submit" className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs">
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
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 print:hidden flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Тайлан татаж чадсангүй</div>
            <div className="text-xs opacity-80 mt-0.5">{rpcError}</div>
          </div>
        </div>
      )}

      {/* Orphan categories warning — surfaces transactions tagged with codes
          that don't appear in the SPEC, so they're not silently dropped. */}
      {internal.orphanCategories.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900 print:hidden">
          <div className="font-semibold mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Ангилаагүй гүйлгээ илэрсэн ({internal.orphanCategories.length})
          </div>
          <div className="opacity-80 mb-1">
            Доорх категори SPEC-д ороогүй тул тайлангийн нийт дүнд орохгүй. Ангиллыг засна уу.
          </div>
          <ul className="space-y-0.5 list-disc list-inside">
            {internal.orphanCategories.slice(0, 5).map((o) => (
              <li key={`${o.direction}-${o.category}`}>
                <span className="font-mono">{o.category || "(хоосон)"}</span>
                {" "}({o.direction === "income" ? "орлого" : "зарлага"})
                {" — "}
                <span className="font-mono">
                  {o.total.toLocaleString("mn-MN", { maximumFractionDigits: 0 })}₮
                </span>
              </li>
            ))}
            {internal.orphanCategories.length > 5 && (
              <li>… бусад {internal.orphanCategories.length - 5} төрөл</li>
            )}
          </ul>
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
              {(company.meta?.name ?? "(Байгууллага сонгогдоогүй)") + " ХХК"}
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-wide uppercase mt-1">
              МӨНГӨН УРСГАЛЫН ТАЙЛАН — {year} ОН
            </h2>
            <div className="text-xs opacity-75 mt-0.5">Шууд арга &nbsp;·&nbsp; MNT</div>
          </div>

          <CashflowInternalTable data={internal} months={MN_MONTH_LABELS} />

          <div className="text-xs text-slate-500 print:hidden">
            Эх сурвалж: бүх банкны cash_transactions &nbsp;·&nbsp; Эхний үлдэгдэл:&nbsp;
            <span className="font-mono">
              {internal.openCash.toLocaleString("mn-MN", { maximumFractionDigits: 0 })}₮
            </span>
            &nbsp;({year - 1}-12-31)
          </div>
        </>
      ) : (
        <CashflowOfficialView
          data={official}
          companyMeta={company.meta}
          year={year}
          openCash={internal.openCash}
          closeCash={internal.grandClosing}
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

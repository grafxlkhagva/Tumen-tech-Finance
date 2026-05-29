import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Landmark, ArrowLeft, Download, AlertCircle } from "lucide-react";
import { fmtMoney } from "@/lib/format";
import { PrintButton } from "@/components/ui/PrintButton";
import {
  type BankFlowRow,
  type BankSection,
  type MonthCell,
  buildBankSections,
  parseYear,
} from "@/lib/reports/bank-summary";

export const metadata = { title: "Мөнгөн хөрөнгийн нэгтгэл — Тумэн Accounting" };

type SearchParams = Promise<{ year?: string }>;

export default async function BankSummaryPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const year = parseYear(sp.year);

  const supabase = await createClient();
  const { data: uc } = await supabase
    .from("user_companies")
    .select("company_id")
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  const companyId = uc?.company_id ?? null;

  const rpcResult = companyId
    ? await supabase.rpc("fn_bank_monthly_flow", {
        p_company_id: companyId,
        p_year: year,
      })
    : { data: [] };

  const { sections, consolidated } = buildBankSections((rpcResult.data ?? []) as BankFlowRow[]);

  const hasAnyMovement =
    sections.length > 0 &&
    sections.some((s) => s.totals.inc !== 0 || s.totals.exp !== 0 || s.opening !== 0);

  const exportUrl = `/api/export/bank-summary?year=${year}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden flex-wrap gap-3">
        <div>
          <Link
            href="/cash"
            className="text-xs text-slate-500 hover:underline flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="w-3 h-3" /> Банкны хуулга
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Landmark className="w-6 h-6" /> Мөнгөн хөрөнгийн нэгтгэл — {year} он
          </h1>
        </div>
        <div className="flex gap-2 items-center">
          <form method="GET" className="flex items-center gap-1.5">
            <input
              type="number"
              name="year"
              defaultValue={year}
              min="2000"
              max="2099"
              className="px-2 py-1.5 border border-slate-300 rounded text-sm w-24"
            />
            <button className="px-3 py-1.5 bg-slate-700 text-white rounded text-xs">Үзэх</button>
          </form>
          <a
            href={exportUrl}
            className="border border-green-300 bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded text-sm flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Excel
          </a>
          <PrintButton />
        </div>
      </div>

      {/* Empty: no active bank accounts */}
      {sections.length === 0 && (
        <div className="bg-white rounded-lg border border-slate-200 py-16 text-center">
          <Landmark className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <div className="text-sm font-medium text-slate-600">Идэвхтэй банкны данс олдсонгүй</div>
          <div className="text-xs text-slate-400 mt-1">
            Банкны данс нэмэх:{" "}
            <Link href="/cash" className="text-blue-600 hover:underline">
              Банкны хуулга
            </Link>
          </div>
        </div>
      )}

      {/* Banks exist but no movement in this year */}
      {sections.length > 0 && !hasAnyMovement && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <strong>{year} онд гүйлгээ бичигдээгүй байна.</strong> Өмнөх жил эсвэл өөр жил
            сонгоно уу.
          </div>
        </div>
      )}

      {sections.map((s) => (
        <BankTable key={s.bank_id} section={s} year={year} />
      ))}

      {consolidated && sections.length > 1 && (
        <div className="bg-white rounded-lg border-2 border-blue-300 overflow-x-auto">
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="inline-block bg-blue-600 text-white px-2 py-0.5 rounded text-xs font-bold">
                НЭГТГЭЛ
              </span>
              <span className="text-sm font-semibold text-slate-800">Бүх банкны нэгтгэсэн</span>
            </div>
            <BalanceSummary opening={consolidated.opening} closing={consolidated.closing} />
          </div>
          <FlowTable
            opening={consolidated.opening}
            monthly={consolidated.monthly}
            totals={consolidated.totals}
            year={year}
            glAccountId={null}
          />
        </div>
      )}

      <style>{`@media print { @page { size: landscape; margin: 0.3cm; } body { background: white; } }`}</style>
    </div>
  );
}

function BalanceSummary({ opening, closing }: { opening: number; closing: number }) {
  return (
    <div className="text-xs text-slate-600">
      Эхний үлдэгдэл:{" "}
      <span className="font-mono font-semibold">₮{fmtMoney(opening)}</span>
      {" · "}
      Эцсийн үлдэгдэл:{" "}
      <span className="font-mono font-semibold">₮{fmtMoney(closing)}</span>
    </div>
  );
}

function BankTable({ section, year }: { section: BankSection; year: number }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="inline-block bg-slate-700 text-white px-2 py-0.5 rounded text-xs font-bold font-mono">
            {section.gl_code ?? "—"}
          </span>
          <span className="text-sm font-semibold text-slate-800">{section.bank_name}</span>
        </div>
        <BalanceSummary opening={section.opening} closing={section.closing} />
      </div>
      <FlowTable
        opening={section.opening}
        monthly={section.monthly}
        totals={section.totals}
        year={year}
        glAccountId={section.gl_account_id}
      />
    </div>
  );
}

/** Build a /reports/ledger drilldown URL for a given GL + month window. */
function ledgerLink(glAccountId: string | null, year: number, month: number): string | null {
  if (!glAccountId) return null;
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate(); // 'month' is 1..12 → JS day 0 of next
  const qs = new URLSearchParams({
    account_id: glAccountId,
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  });
  return `/reports/ledger?${qs.toString()}`;
}

function NumCell({
  v,
  cls = "",
  href,
}: {
  v: number;
  cls?: string;
  href?: string | null;
}) {
  if (v === 0) {
    return <td className={`px-2 py-1.5 font-mono text-right text-slate-400 ${cls}`}>—</td>;
  }
  if (href) {
    return (
      <td className={`px-2 py-1.5 font-mono text-right ${cls}`}>
        <Link href={href} className="underline hover:no-underline">
          {fmtMoney(v)}
        </Link>
      </td>
    );
  }
  return <td className={`px-2 py-1.5 font-mono text-right ${cls}`}>{fmtMoney(v)}</td>;
}

function SignedCell({ v }: { v: number }) {
  if (v === 0) {
    return <td className="px-2 py-1.5 font-mono text-right text-slate-400">—</td>;
  }
  const color = v > 0 ? "text-green-700" : "text-red-700";
  return (
    <td className={`px-2 py-1.5 font-mono text-right font-medium ${color}`}>
      {v > 0 ? "+" : ""}
      {fmtMoney(v)}
    </td>
  );
}

function FlowTable({
  opening,
  monthly,
  totals,
  year,
  glAccountId,
}: {
  opening: number;
  monthly: MonthCell[];
  totals: { inc: number; exp: number; net: number };
  year: number;
  glAccountId: string | null;
}) {
  const closing = monthly[monthly.length - 1]?.close ?? opening;

  return (
    <table className="w-full text-xs">
      <thead className="bg-slate-50 text-slate-500">
        <tr>
          <th scope="col" className="px-3 py-2 text-left min-w-[140px]">
            Үзүүлэлт
          </th>
          {monthly.map((m) => (
            <th key={m.m} scope="col" className="px-2 py-2 text-right min-w-[90px]">
              {m.m}-р сар
            </th>
          ))}
          <th
            scope="col"
            className="px-3 py-2 text-right border-l border-slate-200 bg-slate-100 min-w-[100px]"
          >
            Нийт
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {/* Opening — show 0 as "0.00" so zero is distinguishable from missing data */}
        <tr>
          <th scope="row" className="px-3 py-1.5 text-left text-slate-600 font-normal">
            Эхний үлдэгдэл
          </th>
          {monthly.map((m) => (
            <td key={m.m} className="px-2 py-1.5 font-mono text-right text-slate-600">
              {fmtMoney(m.open)}
            </td>
          ))}
          <td className="px-3 py-1.5 font-mono text-right font-semibold border-l border-slate-200 bg-slate-50">
            {fmtMoney(opening)}
          </td>
        </tr>

        {/* Income — clickable into ledger drilldown */}
        <tr className="bg-green-50/40">
          <th scope="row" className="px-3 py-1.5 text-left text-green-700 font-normal">
            ↓ Орлого
          </th>
          {monthly.map((m) => (
            <NumCell
              key={m.m}
              v={m.inc}
              cls="text-green-700"
              href={ledgerLink(glAccountId, year, m.m)}
            />
          ))}
          <td className="px-3 py-1.5 font-mono text-right font-semibold text-green-700 border-l border-slate-200 bg-slate-50">
            {totals.inc === 0 ? "—" : fmtMoney(totals.inc)}
          </td>
        </tr>

        {/* Expense — drilldown */}
        <tr className="bg-red-50/40">
          <th scope="row" className="px-3 py-1.5 text-left text-red-700 font-normal">
            ↑ Зарлага
          </th>
          {monthly.map((m) => (
            <NumCell
              key={m.m}
              v={m.exp}
              cls="text-red-700"
              href={ledgerLink(glAccountId, year, m.m)}
            />
          ))}
          <td className="px-3 py-1.5 font-mono text-right font-semibold text-red-700 border-l border-slate-200 bg-slate-50">
            {totals.exp === 0 ? "—" : fmtMoney(totals.exp)}
          </td>
        </tr>

        {/* Net flow — signed +/- */}
        <tr className="bg-yellow-50/60">
          <th scope="row" className="px-3 py-1.5 text-left font-medium text-slate-700">
            Цэвэр урсгал
          </th>
          {monthly.map((m) => (
            <SignedCell key={m.m} v={m.net} />
          ))}
          {totals.net === 0 ? (
            <td className="px-3 py-1.5 font-mono text-right text-slate-500 border-l border-slate-200 bg-yellow-100/80">
              —
            </td>
          ) : (
            <td
              className={`px-3 py-1.5 font-mono text-right font-bold border-l border-slate-200 bg-yellow-100/80 ${
                totals.net > 0 ? "text-green-700" : "text-red-700"
              }`}
            >
              {totals.net > 0 ? "+" : ""}
              {fmtMoney(totals.net)}
            </td>
          )}
        </tr>

        {/* Closing */}
        <tr className="bg-slate-100 font-semibold">
          <th scope="row" className="px-3 py-1.5 text-left text-slate-700">
            Эцсийн үлдэгдэл
          </th>
          {monthly.map((m) => (
            <td key={m.m} className="px-2 py-1.5 font-mono text-right">
              {fmtMoney(m.close)}
            </td>
          ))}
          <td className="px-3 py-1.5 font-mono text-right border-l border-slate-300 bg-slate-200">
            {fmtMoney(closing)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

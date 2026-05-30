import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/supabase/company";
import { FileBarChart2, Download, AlertTriangle } from "lucide-react";
import { fmtMoneyOrDash, fmtMoney, fmtDateLong } from "@/lib/format";
import { PrintButton } from "@/components/ui/PrintButton";
import {
  type RawBalance,
  type BSRow,
  type BSWarning,
  buildBalanceSheet,
  parseAsOf,
  defaultPrevDate,
} from "@/lib/reports/balance-sheet";

export const metadata = { title: "Санхүү байдлын тайлан — Тумэн Accounting" };

type SearchParams = Promise<{ as_of?: string; prev?: string }>;

export default async function BalanceSheetPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const asOf = parseAsOf(sp.as_of);
  const prev = sp.prev && /^\d{4}-\d{2}-\d{2}$/.test(sp.prev) ? sp.prev : defaultPrevDate(asOf);

  const supabase = await createClient();
  const company = await getCurrentCompany(supabase);

  // Тэргүүн алдаа #3: company resolution бүтэлгүйтсэн бол хоосон тайлан үзүүлэхгүй.
  if (!company) {
    return (
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-2xl font-semibold flex items-center gap-2 mb-4">
          <FileBarChart2 className="w-6 h-6" /> Санхүү байдлын тайлан
        </h1>
        <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-900">
          Байгууллага сонгогдоогүй байна. Профайл хэсгээс үндсэн байгууллагаа сонгоно уу.
        </div>
      </div>
    );
  }

  const [curRes, prvRes] = await Promise.all([
    supabase.rpc("fn_account_balance_at", { p_company_id: company.companyId, p_as_of: asOf }),
    supabase.rpc("fn_account_balance_at", { p_company_id: company.companyId, p_as_of: prev }),
  ]);

  // Тэргүүн алдаа #2: RPC error-ыг чимээгүй "0=0 тэнцсэн" болгохгүй,
  // улаан banner-аар үзүүлнэ.
  const rpcError = curRes.error?.message || prvRes.error?.message || null;

  const bs = buildBalanceSheet(
    (curRes.data ?? []) as RawBalance[],
    (prvRes.data ?? []) as RawBalance[],
  );

  // Excel route-д prev-г URL-аар дамжуулах нь шаардлагагүй болсон —
  // сервер нь as_of-аас автомат тооцоолно. Гэвч user-ийн override-г хадгална.
  const exportParams = new URLSearchParams({ as_of: asOf });
  if (sp.prev) exportParams.set("prev", prev);
  const exportUrl = `/api/export/balance-sheet?${exportParams.toString()}`;

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between print:hidden flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <FileBarChart2 className="w-6 h-6" /> Санхүү байдлын тайлан
        </h1>
        <div className="flex gap-2 items-center">
          <form method="GET" className="flex items-center gap-1.5">
            <label htmlFor="bs-as-of" className="text-xs text-slate-500">
              Тайлагнах огноо:
            </label>
            <input
              id="bs-as-of"
              key={asOf}
              type="date"
              name="as_of"
              defaultValue={asOf}
              className="px-2 py-1.5 border border-slate-300 rounded text-sm"
            />
            {/*
              Тэргүүн алдаа #1: hidden `prev` талбарыг устгасан. Хэрэглэгч
              `as_of` солихол сервер шинээр `defaultPrevDate(asOf)` тооцоолно.
              Тусгай харьцуулалт хүсвэл URL-д `?prev=YYYY-MM-DD` нэмж болно.
            */}
            <button type="submit" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs">
              Харуулах
            </button>
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

      {/* RPC error banner */}
      {rpcError && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 print:hidden flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Тайлан татаж чадсангүй</div>
            <div className="text-xs opacity-80 mt-0.5">{rpcError}</div>
          </div>
        </div>
      )}

      {/* Chart-of-accounts mistype warnings */}
      {bs.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900 print:hidden">
          <div className="font-semibold mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Дансны тохиргооны анхааруулга
          </div>
          <ul className="space-y-0.5 list-disc list-inside">
            {bs.warnings.map((w) => (
              <li key={w.code}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Form header (Сангийн Сайдын маяг) */}
      <div className="bg-white rounded border border-slate-200 p-4 text-center print:border-0">
        <div className="text-xs text-slate-500">
          Сангийн Сайдын 2017 оны 361 дугаар тушаалын 2 дугаар хавсралт
        </div>
        <h2 className="text-xl font-bold text-slate-900 my-2 uppercase">
          САНХҮҮ БАЙДЛЫН ТАЙЛАН
        </h2>
        <div className="text-sm text-slate-700">
          <span className="font-semibold">
            &quot;{company.meta?.name ?? "(Байгууллага сонгогдоогүй)"}&quot; ХХК
          </span>
          {" · "}
          <span>{fmtDateLong(asOf)}-ний байдлаар</span>
        </div>
        <div className="text-xs text-slate-500 mt-1">
          {company.meta?.register && <>Регистр: {company.meta.register} | </>}
          {company.meta?.tin && <>ХРГ: {company.meta.tin} | </>}
          (төгрөгөөр)
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. ХӨРӨНГӨ */}
        <div className="bg-white rounded border border-slate-200 overflow-hidden">
          <div className="bg-blue-600 text-white px-4 py-2 flex items-center gap-2">
            <span className="text-xl">⊕</span>
            <span className="font-bold uppercase">1. ХӨРӨНГӨ</span>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th scope="col" className="px-2 py-2 text-left w-16">МӨР</th>
                <th scope="col" className="px-2 py-2 text-left">ҮЗҮҮЛЭЛТ</th>
                <th scope="col" className="px-2 py-2 text-right w-32">{asOf}</th>
                <th scope="col" className="px-2 py-2 text-right w-32">{prev}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {bs.assets.map((row) => (
                <BSRowEl key={row.code} row={row} />
              ))}
              <tr className="bg-blue-50 font-bold border-t-2 border-blue-300">
                <td className="px-2 py-2 font-mono">1.X</td>
                <td className="px-2 py-2 uppercase">ХӨРӨНГИЙН НИЙТ ДҮН</td>
                <td className="px-2 py-2 font-mono text-right">{fmtMoney(bs.totals.asset_total.current)}</td>
                <td className="px-2 py-2 font-mono text-right">{fmtMoney(bs.totals.asset_total.previous)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 2. ӨР ТӨЛБӨР + Эздийн өмч */}
        <div className="bg-white rounded border border-slate-200 overflow-hidden">
          <div className="bg-red-600 text-white px-4 py-2 flex items-center gap-2">
            <span className="text-xl">⊖</span>
            <span className="font-bold uppercase">2. ӨР ТӨЛБӨР</span>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th scope="col" className="px-2 py-2 text-left w-16">МӨР</th>
                <th scope="col" className="px-2 py-2 text-left">ҮЗҮҮЛЭЛТ</th>
                <th scope="col" className="px-2 py-2 text-right w-32">{asOf}</th>
                <th scope="col" className="px-2 py-2 text-right w-32">{prev}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {bs.liabilities.map((row) => (
                <BSRowEl key={row.code} row={row} />
              ))}
              <tr className="bg-red-50 font-bold border-t-2 border-red-300">
                <td className="px-2 py-2 font-mono">2.2</td>
                <td className="px-2 py-2">Өр төлбөрийн нийт дүн</td>
                <td className="px-2 py-2 font-mono text-right">{fmtMoney(bs.totals.liability_total.current)}</td>
                <td className="px-2 py-2 font-mono text-right">{fmtMoney(bs.totals.liability_total.previous)}</td>
              </tr>
              {bs.equity.map((row) => (
                <BSRowEl key={row.code} row={row} />
              ))}
              <tr className="bg-purple-100 font-bold border-t-2 border-purple-400">
                <td className="px-2 py-2 font-mono">2.X</td>
                <td className="px-2 py-2 uppercase">ӨР + ЭЗНИЙ ӨМЧИЙН НИЙТ</td>
                <td className="px-2 py-2 font-mono text-right">{fmtMoney(bs.totals.liab_equity_total.current)}</td>
                <td className="px-2 py-2 font-mono text-right">{fmtMoney(bs.totals.liab_equity_total.previous)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <BalanceCheck
        current={bs.totals.asset_total.current - bs.totals.liab_equity_total.current}
        previous={bs.totals.asset_total.previous - bs.totals.liab_equity_total.previous}
        hasData={!rpcError && (curRes.data?.length ?? 0) > 0}
      />

      <style>{`@media print { @page { size: A4 landscape; margin: 0.6cm; } body { background: white; } }`}</style>
    </div>
  );
}

function BSRowEl({ row }: { row: BSRow }) {
  const indentCls = row.indent === 1 ? "pl-6" : row.indent === 2 ? "pl-10" : "";
  return (
    <tr className={row.bold ? "bg-slate-50 font-semibold" : ""}>
      <td className="px-2 py-1 font-mono text-[0.7rem] text-slate-500 align-top">{row.code}</td>
      <td className={`px-2 py-1 ${indentCls}`}>
        {row.bold ? <strong>{row.label}</strong> : row.label}
      </td>
      <td className="px-2 py-1 font-mono text-right">{fmtMoneyOrDash(row.current)}</td>
      <td className="px-2 py-1 font-mono text-right">{fmtMoneyOrDash(row.previous)}</td>
    </tr>
  );
}

function BalanceCheck({
  current,
  previous,
  hasData,
}: {
  current: number;
  previous: number;
  hasData: boolean;
}) {
  // hasData=false бол "Хөрөнгө = Өр" гэсэн дүгнэлт хайхрамжтай (бүх утга 0).
  if (!hasData) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded p-3 text-sm text-slate-600 print:hidden">
        Энэ хугацааны хувьд бүртгэгдсэн дансны хөдөлгөөн алга байна.
      </div>
    );
  }
  const curOk = Math.abs(current) < 0.5;
  const prvOk = Math.abs(previous) < 0.5;
  if (curOk && prvOk) {
    return (
      <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800 print:hidden">
        ✓ Тэнцлийн шалгалт амжилттай — Хөрөнгө = Өр төлбөр + Эзний өмч (хоёр огнооны хувьд)
      </div>
    );
  }
  return (
    <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 print:hidden">
      ⚠ Тэнцлийн зөрүү илэрлээ:
      {!curOk && <span> Энэ огноо: ±₮{fmtMoney(Math.abs(current))}</span>}
      {!prvOk && <span> · Өмнөх огноо: ±₮{fmtMoney(Math.abs(previous))}</span>}
    </div>
  );
}

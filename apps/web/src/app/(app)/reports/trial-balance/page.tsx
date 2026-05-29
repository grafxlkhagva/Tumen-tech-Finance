import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Calculator, Download, FileWarning } from "lucide-react";
import { fmtMoneyOrDash, fmtMoney } from "@/lib/format";
import { GROUP_LABELS, SECTION_LABELS } from "@/lib/i18n/account-groups";
import { ToastFromURL } from "@/components/ui/Toast";
import { PrintButton } from "@/components/ui/PrintButton";
import { TrialBalanceFilters } from "./TrialBalanceFilters";
import {
  type TBDisplayRow,
  type TBRpcRow,
  type TBTotals,
  parseTbPeriod,
  transformTbRows,
} from "@/lib/reports/trial-balance";

export const metadata = { title: "Гүйлгээ баланс — Тумэн Accounting" };

type SearchParams = Promise<{
  range?: string;
  date_from?: string;
  date_to?: string;
  show_zero?: string;
}>;

type RenderedRow =
  | ({ kind: "data" } & TBDisplayRow)
  | { kind: "header"; label: string; key: string }
  | ({ kind: "subtotal"; label: string; key: string } & TBTotals)
  | ({ kind: "section"; label: string; key: string } & TBTotals)
  | { kind: "spacer"; key: string };

function sumRows(buf: TBDisplayRow[]): TBTotals {
  return buf.reduce<TBTotals>(
    (s, r) => ({
      ob_dt: s.ob_dt + r.ob_dt,
      ob_kt: s.ob_kt + r.ob_kt,
      p_dt:  s.p_dt  + r.p_dt,
      p_kt:  s.p_kt  + r.p_kt,
      cl_dt: s.cl_dt + r.cl_dt,
      cl_kt: s.cl_kt + r.cl_kt,
    }),
    { ob_dt: 0, ob_kt: 0, p_dt: 0, p_kt: 0, cl_dt: 0, cl_kt: 0 },
  );
}

export default async function TrialBalancePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const period = parseTbPeriod(sp);
  const showZero = sp.show_zero === "1";

  const supabase = await createClient();

  // Resolve the user's company (RLS would filter anyway, but the RPC needs it explicitly).
  const { data: uc } = await supabase
    .from("user_companies")
    .select("company_id")
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  const companyId = uc?.company_id ?? null;

  const rpcResult = companyId
    ? await supabase.rpc("fn_account_balances_period", {
        p_company_id: companyId,
        p_start_date: period.dateFrom,
        p_end_date: period.dateTo,
      })
    : { data: [] };
  const pgRows = rpcResult.data;

  const { rows, totals } = transformTbRows((pgRows ?? []) as TBRpcRow[], showZero);

  // ── Group by 2-digit prefix + 1-digit section (mirrors legacy app.py) ────
  const final: RenderedRow[] = [];
  let curSection: string | null = null;
  let curPrefix: string | null = null;
  let grpBuf: TBDisplayRow[] = [];
  let secBuf: TBDisplayRow[] = [];

  function flushGrp() {
    if (grpBuf.length === 0) return;
    const pf = grpBuf[0].code.slice(0, 2);
    const lbl = GROUP_LABELS[pf] ?? `${pf}xx`;
    final.push({ kind: "header", label: `${pf}xx — ${lbl}`, key: `h_${pf}` });
    for (const r of grpBuf) final.push({ kind: "data", ...r });
    final.push({ kind: "subtotal", label: `${pf}xx нийт`, key: `st_${pf}`, ...sumRows(grpBuf) });
    secBuf.push(...grpBuf);
    grpBuf = [];
  }

  function flushSec() {
    if (secBuf.length === 0) return;
    const sec = curSection ?? "";
    const lbl = SECTION_LABELS[sec] ?? `${sec}xxx`;
    final.push({ kind: "section", label: `${lbl} — НИЙТ`, key: `sec_${sec}`, ...sumRows(secBuf) });
    final.push({ kind: "spacer", key: `sp_${sec}` });
    secBuf = [];
  }

  for (const row of rows) {
    const pf = row.code.slice(0, 2);
    const sec = row.code.slice(0, 1);
    if (sec !== curSection) {
      flushGrp(); flushSec();
      curSection = sec; curPrefix = null;
    }
    if (pf !== curPrefix) {
      flushGrp(); curPrefix = pf;
    }
    grpBuf.push(row);
  }
  flushGrp(); flushSec();

  // Build the export URL preserving the user's range intent
  const exportQs = new URLSearchParams();
  if (period.raw.range === "all") {
    exportQs.set("range", "all");
  } else {
    if (period.dateFrom) exportQs.set("date_from", period.dateFrom);
    if (period.dateTo)   exportQs.set("date_to",   period.dateTo);
  }
  if (showZero) exportQs.set("show_zero", "1");
  const exportUrl = `/api/export/trial-balance?${exportQs.toString()}`;

  const balanced = Math.abs(totals.cl_dt - totals.cl_kt) < 0.5;

  return (
    <div className="space-y-4">
      <ToastFromURL />

      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Calculator className="w-6 h-6" /> Гүйлгээ баланс
          </h1>
          <p className="text-xs text-slate-500">{period.label}</p>
        </div>
        <div className="flex gap-2 items-center">
          <a
            href={exportUrl}
            className="border border-green-300 bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded text-sm flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Excel
          </a>
          <PrintButton />
        </div>
      </div>

      <TrialBalanceFilters
        dateFrom={period.dateFrom ?? ""}
        dateTo={period.dateTo ?? ""}
        showZero={showZero}
        isAllTime={period.raw.range === "all"}
        rowCount={rows.length}
      />

      {/* Empty state */}
      {final.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 py-16 text-center">
          <FileWarning className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <div className="text-sm font-medium text-slate-600">
            Энэ хугацаанд гүйлгээ хийгдээгүй байна
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Огноог өөрчилж эсвэл &quot;Тэг данс харуулах&quot;-ыг идэвхжүүлнэ үү
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th rowSpan={2} scope="col" className="px-3 py-2 text-left border-r border-slate-200 align-middle w-24">
                  <div className="text-[0.7rem] uppercase">Дансны<br/>дугаар</div>
                </th>
                <th rowSpan={2} scope="col" className="px-3 py-2 text-left border-r border-slate-200 align-middle min-w-[280px]">
                  <div className="text-[0.7rem] uppercase">Дансны нэр</div>
                </th>
                <th colSpan={2} scope="colgroup" className="px-3 py-1.5 text-center border-r border-slate-200 border-b border-slate-200 text-[0.7rem] uppercase">
                  Эхний үлдэгдэл
                </th>
                <th colSpan={2} scope="colgroup" className="px-3 py-1.5 text-center border-r border-slate-200 border-b border-slate-200 text-[0.7rem] uppercase bg-blue-50/40">
                  Гүйлгээний дүн
                </th>
                <th colSpan={2} scope="colgroup" className="px-3 py-1.5 text-center border-b border-slate-200 text-[0.7rem] uppercase">
                  Эцсийн үлдэгдэл
                </th>
              </tr>
              <tr className="text-[0.7rem]">
                <th scope="col" className="px-2 py-1 text-right border-r border-slate-100">ДТ</th>
                <th scope="col" className="px-2 py-1 text-right border-r border-slate-200">КТ</th>
                <th scope="col" className="px-2 py-1 text-right border-r border-slate-100 bg-blue-50/40">ДТ</th>
                <th scope="col" className="px-2 py-1 text-right border-r border-slate-200 bg-blue-50/40">КТ</th>
                <th scope="col" className="px-2 py-1 text-right border-r border-slate-100">ДТ</th>
                <th scope="col" className="px-2 py-1 text-right">КТ</th>
              </tr>
            </thead>
            <tbody>
              {final.map((r) => {
                if (r.kind === "header") {
                  return (
                    <tr key={r.key} className="bg-slate-100/80">
                      <td colSpan={8} className="px-3 py-1.5 text-[0.75rem] font-semibold text-slate-700">
                        <span className="inline-block w-2 h-2 bg-blue-500 rounded mr-2 align-middle"></span>
                        {r.label}
                      </td>
                    </tr>
                  );
                }
                if (r.kind === "subtotal") {
                  return (
                    <tr key={r.key} className="bg-slate-50 border-y border-slate-200 font-semibold">
                      <td colSpan={2} className="px-3 py-1.5 text-xs italic text-slate-700">{r.label}</td>
                      <CellMoney v={r.ob_dt} cls="text-blue-700" />
                      <CellMoney v={r.ob_kt} cls="text-red-600 border-r border-slate-200" />
                      <CellMoney v={r.p_dt}  cls="text-blue-700 bg-blue-50/40" />
                      <CellMoney v={r.p_kt}  cls="text-red-600 bg-blue-50/40 border-r border-slate-200" />
                      <CellMoney v={r.cl_dt} cls="text-blue-700" />
                      <CellMoney v={r.cl_kt} cls="text-red-600" />
                    </tr>
                  );
                }
                if (r.kind === "section") {
                  return (
                    <tr key={r.key} className="border-y-2 border-slate-700 font-bold">
                      <td colSpan={2} className="px-3 py-2 text-sm uppercase">{r.label}</td>
                      <CellMoney v={r.ob_dt} cls="text-blue-700" />
                      <CellMoney v={r.ob_kt} cls="text-red-600 border-r border-slate-200" />
                      <CellMoney v={r.p_dt}  cls="text-blue-700 bg-blue-50/40" />
                      <CellMoney v={r.p_kt}  cls="text-red-600 bg-blue-50/40 border-r border-slate-200" />
                      <CellMoney v={r.cl_dt} cls="text-blue-700" />
                      <CellMoney v={r.cl_kt} cls="text-red-600" />
                    </tr>
                  );
                }
                if (r.kind === "spacer") {
                  return <tr key={r.key}><td colSpan={8} className="h-2"></td></tr>;
                }
                // data row
                return (
                  <tr key={r.account_id} className="hover:bg-slate-50">
                    <td className="px-3 py-1 font-mono text-xs text-slate-700 border-r border-slate-100">{r.code}</td>
                    <td className="px-3 py-1 text-xs border-r border-slate-100">{r.name}</td>
                    <CellMoney v={r.ob_dt} cls="text-blue-700"             linkAcc={r.account_id} dateFrom={null} dateTo={period.dateFrom} />
                    <CellMoney v={r.ob_kt} cls="text-red-600 border-r border-slate-200" linkAcc={r.account_id} dateFrom={null} dateTo={period.dateFrom} />
                    <CellMoney v={r.p_dt}  cls="text-blue-700 bg-blue-50/40" linkAcc={r.account_id} dateFrom={period.dateFrom} dateTo={period.dateTo} />
                    <CellMoney v={r.p_kt}  cls="text-red-600 bg-blue-50/40 border-r border-slate-200" linkAcc={r.account_id} dateFrom={period.dateFrom} dateTo={period.dateTo} />
                    <CellMoney v={r.cl_dt} cls="text-blue-700"             linkAcc={r.account_id} dateFrom={null} dateTo={period.dateTo} />
                    <CellMoney v={r.cl_kt} cls="text-red-600"              linkAcc={r.account_id} dateFrom={null} dateTo={period.dateTo} />
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-700">
              <tr>
                <td colSpan={2} className="px-3 py-2 text-right uppercase text-xs">НИЙТ ДҮН</td>
                <CellMoney v={totals.ob_dt} cls="text-blue-800" />
                <CellMoney v={totals.ob_kt} cls="text-red-700 border-r border-slate-300" />
                <CellMoney v={totals.p_dt}  cls="text-blue-800 bg-blue-100" />
                <CellMoney v={totals.p_kt}  cls="text-red-700 bg-blue-100 border-r border-slate-300" />
                <CellMoney v={totals.cl_dt} cls="text-blue-800" />
                <CellMoney v={totals.cl_kt} cls="text-red-700" />
              </tr>
              <tr className={balanced ? "bg-green-50" : "bg-red-50"}>
                <td colSpan={6} className="px-3 py-1.5 text-right text-xs uppercase">
                  {balanced ? "✓ Эцсийн үлдэгдэл тэнцсэн" : "⚠ Эцсийн үлдэгдэлд зөрүү"}
                </td>
                <td
                  colSpan={2}
                  className={`px-3 py-1.5 font-mono text-right text-xs ${balanced ? "text-green-700" : "text-red-700"}`}
                >
                  ₮{fmtMoney(totals.cl_dt - totals.cl_kt)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <style>{`@media print { @page { size: landscape; margin: 0.5cm; } body { background: white; } }`}</style>
    </div>
  );
}

/** Inline money cell with optional ledger drilldown link. */
function CellMoney({
  v, cls, linkAcc, dateFrom, dateTo,
}: {
  v: number;
  cls?: string;
  linkAcc?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
}) {
  const txt = fmtMoneyOrDash(v);
  if (linkAcc && v !== 0) {
    const qs = new URLSearchParams();
    qs.set("account_id", linkAcc);
    if (dateFrom) qs.set("from", dateFrom);
    if (dateTo) qs.set("to", dateTo);
    return (
      <td className={`px-2 py-1 font-mono text-right ${cls ?? ""}`}>
        <Link href={`/reports/ledger?${qs.toString()}`} className="underline hover:no-underline">
          {txt}
        </Link>
      </td>
    );
  }
  return <td className={`px-2 py-1 font-mono text-right ${cls ?? ""}`}>{txt}</td>;
}

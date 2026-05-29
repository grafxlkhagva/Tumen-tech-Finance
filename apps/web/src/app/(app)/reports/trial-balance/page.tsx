import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Calculator, Download, Printer } from "lucide-react";
import { fmtMoneyOrDash, fmtMoney, fmtDate } from "@/lib/format";
import { GROUP_LABELS, SECTION_LABELS } from "@/lib/i18n/account-groups";
import { ToastFromURL } from "@/components/ui/Toast";
import { PrintButton } from "@/components/ui/PrintButton";
import { TrialBalanceFilters } from "./TrialBalanceFilters";

export const metadata = { title: "Гүйлгээ баланс — Тумэн Accounting" };

const COMPANY_ID = "00000000-0000-0000-0000-000000000001";

type SearchParams = Promise<{
  date_from?: string;
  date_to?: string;
  show_zero?: string;
}>;

type Row = {
  account_id: string;
  code: string;
  name: string;
  acc_type: string;
  ob_dt: number;
  ob_kt: number;
  p_dt: number;
  p_kt: number;
  cl_dt: number;
  cl_kt: number;
};

type RenderedRow =
  | ({ kind: "data" } & Row)
  | { kind: "header"; label: string; key: string }
  | { kind: "subtotal"; label: string; key: string; ob_dt: number; ob_kt: number; p_dt: number; p_kt: number; cl_dt: number; cl_kt: number }
  | { kind: "section"; label: string; key: string; ob_dt: number; ob_kt: number; p_dt: number; p_kt: number; cl_dt: number; cl_kt: number }
  | { kind: "spacer"; key: string };

export default async function TrialBalancePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;

  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const dateFrom = sp.date_from || yearStart;
  const dateTo = sp.date_to || today;
  const showZero = sp.show_zero === "1";

  const supabase = await createClient();

  // Pull period balances via the existing fn_account_balances_period RPC
  const { data: pgRows } = await supabase.rpc("fn_account_balances_period", {
    p_company_id: COMPANY_ID,
    p_start_date: dateFrom,
    p_end_date: dateTo,
  });

  // Filter postable rows and compute display columns (opening Dr/Cr, period Dr/Cr, closing Dr/Cr)
  const rawRows = (pgRows ?? []) as Array<{
    account_id: string;
    code: string;
    name: string;
    type: string;
    is_postable: boolean;
    opening_balance: number;
    period_debit: number;
    period_credit: number;
    closing_balance: number;
  }>;

  const rows: Row[] = [];
  let totObDt = 0, totObKt = 0, totDt = 0, totKt = 0, totClDt = 0, totClKt = 0;

  for (const r of rawRows) {
    if (!r.is_postable) continue;

    const ob = Number(r.opening_balance ?? 0);
    const pDt = Number(r.period_debit ?? 0);
    const pKt = Number(r.period_credit ?? 0);
    const cl = Number(r.closing_balance ?? 0);

    // Signed balance is already in account-type direction (Asset/Expense Dr-positive,
    // Liability/Equity/Income Cr-positive). Render the magnitude on the matching side.
    const isDrSide = r.type === "asset" || r.type === "expense";
    const obDt = isDrSide ? (ob >= 0 ? ob : 0) : (ob < 0 ? -ob : 0);
    const obKt = isDrSide ? (ob < 0 ? -ob : 0) : (ob >= 0 ? ob : 0);
    const clDt = isDrSide ? (cl >= 0 ? cl : 0) : (cl < 0 ? -cl : 0);
    const clKt = isDrSide ? (cl < 0 ? -cl : 0) : (cl >= 0 ? cl : 0);

    if (!showZero && ob === 0 && pDt === 0 && pKt === 0) continue;

    rows.push({
      account_id: r.account_id,
      code: r.code,
      name: r.name,
      acc_type: r.type,
      ob_dt: obDt, ob_kt: obKt,
      p_dt: pDt, p_kt: pKt,
      cl_dt: clDt, cl_kt: clKt,
    });
    totObDt += obDt; totObKt += obKt;
    totDt += pDt; totKt += pKt;
    totClDt += clDt; totClKt += clKt;
  }

  // ── Group by 2-digit prefix + 1-digit section (mirrors legacy app.py) ────
  const final: RenderedRow[] = [];
  let curSection: string | null = null;
  let curPrefix: string | null = null;
  let grpBuf: Row[] = [];
  let secBuf: Row[] = [];

  function sumBuf(buf: Row[]) {
    return {
      ob_dt: buf.reduce((s, r) => s + r.ob_dt, 0),
      ob_kt: buf.reduce((s, r) => s + r.ob_kt, 0),
      p_dt:  buf.reduce((s, r) => s + r.p_dt, 0),
      p_kt:  buf.reduce((s, r) => s + r.p_kt, 0),
      cl_dt: buf.reduce((s, r) => s + r.cl_dt, 0),
      cl_kt: buf.reduce((s, r) => s + r.cl_kt, 0),
    };
  }

  function flushGrp() {
    if (grpBuf.length === 0) return;
    const pf = grpBuf[0].code.slice(0, 2);
    const lbl = GROUP_LABELS[pf] ?? `${pf}xx`;
    final.push({ kind: "header", label: `${pf}xx — ${lbl}`, key: `h_${pf}` });
    for (const r of grpBuf) final.push({ kind: "data", ...r });
    const s = sumBuf(grpBuf);
    final.push({ kind: "subtotal", label: `${pf}xx нийт`, key: `st_${pf}`, ...s });
    secBuf.push(...grpBuf);
    grpBuf = [];
  }

  function flushSec() {
    if (secBuf.length === 0) return;
    const sec = curSection ?? "";
    const lbl = SECTION_LABELS[sec] ?? `${sec}xxx`;
    const s = sumBuf(secBuf);
    final.push({ kind: "section", label: `${lbl} — НИЙТ`, key: `sec_${sec}`, ...s });
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

  const exportUrl = `/api/export/trial-balance?date_from=${dateFrom}&date_to=${dateTo}${showZero ? "&show_zero=1" : ""}`;

  return (
    <div className="space-y-4">
      <ToastFromURL />

      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Calculator className="w-6 h-6" /> Гүйлгээ баланс
          </h1>
          <p className="text-xs text-slate-500">{fmtDate(dateFrom)} → {fmtDate(dateTo)}</p>
        </div>
        <div className="flex gap-2 items-center">
          <a href={exportUrl} className="border border-green-300 bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded text-sm flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Excel
          </a>
          <PrintButton />
        </div>
      </div>

      <TrialBalanceFilters dateFrom={dateFrom} dateTo={dateTo} showZero={showZero} rowCount={rows.length} />

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th rowSpan={2} className="px-3 py-2 text-left border-r border-slate-200 align-middle w-24">
                <div className="text-[0.7rem] uppercase">Дансны<br/>дугаар</div>
              </th>
              <th rowSpan={2} className="px-3 py-2 text-left border-r border-slate-200 align-middle min-w-[280px]">
                <div className="text-[0.7rem] uppercase">Дансны нэр</div>
              </th>
              <th colSpan={2} className="px-3 py-1.5 text-center border-r border-slate-200 border-b border-slate-200 text-[0.7rem] uppercase">
                Эхний үлдэгдэл
              </th>
              <th colSpan={2} className="px-3 py-1.5 text-center border-r border-slate-200 border-b border-slate-200 text-[0.7rem] uppercase bg-blue-50/40">
                Гүйлгээний дүн
              </th>
              <th colSpan={2} className="px-3 py-1.5 text-center border-b border-slate-200 text-[0.7rem] uppercase">
                Эцсийн үлдэгдэл
              </th>
            </tr>
            <tr className="text-[0.7rem]">
              <th className="px-2 py-1 text-right border-r border-slate-100">ДТ</th>
              <th className="px-2 py-1 text-right border-r border-slate-200">КТ</th>
              <th className="px-2 py-1 text-right border-r border-slate-100 bg-blue-50/40">ДТ</th>
              <th className="px-2 py-1 text-right border-r border-slate-200 bg-blue-50/40">КТ</th>
              <th className="px-2 py-1 text-right border-r border-slate-100">ДТ</th>
              <th className="px-2 py-1 text-right">КТ</th>
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
                  <CellMoney v={r.ob_dt} cls="text-blue-700" linkAcc={r.account_id} dateFrom={null} dateTo={dateFrom} />
                  <CellMoney v={r.ob_kt} cls="text-red-600 border-r border-slate-200" linkAcc={r.account_id} dateFrom={null} dateTo={dateFrom} />
                  <CellMoney v={r.p_dt}  cls="text-blue-700 bg-blue-50/40" linkAcc={r.account_id} dateFrom={dateFrom} dateTo={dateTo} />
                  <CellMoney v={r.p_kt}  cls="text-red-600 bg-blue-50/40 border-r border-slate-200" linkAcc={r.account_id} dateFrom={dateFrom} dateTo={dateTo} />
                  <CellMoney v={r.cl_dt} cls="text-blue-700" linkAcc={r.account_id} dateFrom={null} dateTo={dateTo} />
                  <CellMoney v={r.cl_kt} cls="text-red-600" linkAcc={r.account_id} dateFrom={null} dateTo={dateTo} />
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-700">
            <tr>
              <td colSpan={2} className="px-3 py-2 text-right uppercase text-xs">НИЙТ ДҮН</td>
              <CellMoney v={totObDt} cls="text-blue-800" />
              <CellMoney v={totObKt} cls="text-red-700 border-r border-slate-300" />
              <CellMoney v={totDt}   cls="text-blue-800 bg-blue-100" />
              <CellMoney v={totKt}   cls="text-red-700 bg-blue-100 border-r border-slate-300" />
              <CellMoney v={totClDt} cls="text-blue-800" />
              <CellMoney v={totClKt} cls="text-red-700" />
            </tr>
            <tr className={Math.abs(totClDt - totClKt) < 0.5 ? "bg-green-50" : "bg-red-50"}>
              <td colSpan={6} className="px-3 py-1.5 text-right text-xs uppercase">
                {Math.abs(totClDt - totClKt) < 0.5 ? "✓ Эцсийн үлдэгдэл балансгүй" : "⚠ Зөрүү"}
              </td>
              <td colSpan={2} className={`px-3 py-1.5 font-mono text-right text-xs ${Math.abs(totClDt - totClKt) < 0.5 ? "text-green-700" : "text-red-700"}`}>
                ₮{fmtMoney(totClDt - totClKt)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <style>{`@media print { @page { size: landscape; margin: 0.5cm; } body { background: white; } }`}</style>
    </div>
  );
}

/** Inline money cell with optional ledger link */
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
        <Link href={`/reports/ledger?${qs.toString()}`} className="underline hover:no-underline">{txt}</Link>
      </td>
    );
  }
  return <td className={`px-2 py-1 font-mono text-right ${cls ?? ""}`}>{txt}</td>;
}

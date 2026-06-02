"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { calcSalary } from "@/lib/payroll/calc";
import { fmtMoney } from "@/lib/format";
import { SALARY_STATUS } from "@/lib/i18n/labels";
import { Badge } from "@/components/ui/Badge";
import { AccountPicker } from "@/components/ui/AccountPicker";
import {
  recalcPayrollMonth, updateSalaryCell, approveMonth, postSalaryBatch,
} from "./actions";
import {
  Calculator, CheckCircle2, FileText, Coins, HeartPulse, Building2,
  Percent, HandCoins, Info,
} from "lucide-react";

type Employee = {
  id: string;
  first_name: string;
  last_name: string | null;
  full_name: string;
  title: string | null;
  base_salary: number;
  phone_allowance: number;
  adv_base?: number | null;
};

type Record = {
  id: string;
  employee_id: string;
  status: string;
  worked_hours: number;
  base_salary: number;
  phone_allowance: number;
  sales_bonus: number;
  leave_pay: number;
  bod_salary: number;
  total_income: number;
  emndsh: number;
  hhoat: number;
  advance: number;
  net_pay: number;
};

const EMP_COLORS = [
  "#ef4444", "#f59e0b", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6",
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
];

function fmtInt(n: number): string {
  return fmtMoney(n).replace(/\.00$/, "");
}

export function SalaryGrid({
  year, month, totalHours, employees, records,
}: {
  year: number;
  month: number;
  totalHours: number;
  employees: Employee[];
  records: Record[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const recMap = new Map(records.map((r) => [r.employee_id, r]));

  const [salaryExp, setSalaryExp] = useState("");
  const [salaryPay, setSalaryPay] = useState("");
  const [emndshPay, setEmndshPay] = useState("");
  const [hhoatPay, setHhoatPay] = useState("");
  const [showPostForm, setShowPostForm] = useState(false);

  // HIGH FIX #5: legacy used "all-or-nothing" status detection — but a single
  // new draft row would hide every workflow button. Count by status and let
  // the user act on the partial subset.
  const statusCounts = records.reduce(
    (acc, r) => {
      if (r.status === "draft")    acc.draft++;
      else if (r.status === "approved") acc.approved++;
      else if (r.status === "posted")   acc.posted++;
      return acc;
    },
    { draft: 0, approved: 0, posted: 0 },
  );
  const hasDraft    = statusCounts.draft    > 0;
  const hasApproved = statusCounts.approved > 0;
  const allPosted   = records.length > 0 && statusCounts.posted === records.length;

  function notify(s: string) {
    setMsg(s);
    setTimeout(() => setMsg(null), 3000);
  }

  function handleRecalc() {
    startTransition(async () => {
      const r = await recalcPayrollMonth(year, month);
      if (r.error) notify(`⚠ ${r.error}`);
      else notify(r.success ?? "OK");
      router.refresh();
    });
  }

  function handleCellChange(recordId: string | null, field: string, value: number) {
    // CRITICAL FIX #2: emit feedback so users aren't typing into a black hole.
    // Previously `if (!recordId) return` silently dropped the keystroke.
    if (!recordId) {
      notify("⚠ Эхлээд 'Тооцоолох / Сэргээх' дарж бүртгэл үүсгэнэ үү");
      return;
    }
    startTransition(async () => {
      const r = await updateSalaryCell(recordId, field, value);
      if (r.error) notify(`⚠ ${r.error}`);
      router.refresh();
    });
  }

  function handleApprove() {
    startTransition(async () => {
      const r = await approveMonth(year, month);
      if (r.error) notify(`⚠ ${r.error}`);
      else notify(r.success ?? "OK");
      router.refresh();
    });
  }

  function handlePost() {
    if (!salaryExp || !salaryPay || !emndshPay || !hhoatPay) {
      notify("⚠ Бүх данс сонгоно уу");
      return;
    }
    startTransition(async () => {
      const r = await postSalaryBatch(year, month, salaryExp, salaryPay, emndshPay, hhoatPay);
      if (r.error) notify(`⚠ ${r.error}`);
      else {
        notify(r.success ?? "OK");
        setShowPostForm(false);
      }
      router.refresh();
    });
  }

  // Compute live preview totals from records (so we never desync with DB)
  const rowPreviews = employees.map((e) => {
    const rec = recMap.get(e.id);
    const preview = rec
      ? calcSalary({
          base_salary: rec.base_salary,
          worked_hours: rec.worked_hours,
          month,
          phone_allowance: rec.phone_allowance,
          sales_bonus: rec.sales_bonus,
          leave_pay: rec.leave_pay,
          bod_salary: rec.bod_salary,
          advance_override: rec.advance,
        })
      : null;
    return { e, rec, preview };
  });

  // NaN-safe number coercion — `Number(undefined)` is NaN which would poison sums.
  const safeNum = (v: number | null | undefined): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // HIGH FIX #8 helper — Enter inside a numeric cell blurs it so the onBlur
  // commit handler fires (spreadsheet UX expectation). Down/Up arrow keys are
  // left to the browser's native number-spinner.
  const enterToBlur = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === "Enter") ev.currentTarget.blur();
  };

  const totals = rowPreviews.reduce(
    (s, { rec, preview }) => {
      if (!rec) return s;
      return {
        bod:        s.bod        + (preview?.bod        ?? 0),
        niit:       s.niit       + (preview?.niit       ?? safeNum(rec.total_income)),
        emndsh:     s.emndsh     + (preview?.emndsh     ?? safeNum(rec.emndsh)),
        emndsh_org: s.emndsh_org + (preview?.emndsh_org ?? 0),
        hhoat:      s.hhoat      + (preview?.hhoat      ?? safeNum(rec.hhoat)),
        adv:        s.adv        + (preview?.adv        ?? safeNum(rec.advance)),
        gart:       s.gart       + (preview?.gart       ?? safeNum(rec.net_pay)),
        count:      s.count + 1,
      };
    },
    { bod: 0, niit: 0, emndsh: 0, emndsh_org: 0, hhoat: 0, adv: 0, gart: 0, count: 0 },
  );

  return (
    <div className="space-y-3">
      {/* ── Top stat strip (badges) ── */}
      <div className="flex flex-wrap items-center gap-1.5 print:hidden">
        <span className="bg-emerald-500 text-white px-2 py-0.5 rounded text-[0.7rem] font-semibold">
          Нийт орлого: {fmtInt(totals.niit)}₮
        </span>
        <span className="bg-red-500 text-white px-2 py-0.5 rounded text-[0.7rem] font-semibold">
          ЭМНДШ(а): {fmtInt(totals.emndsh)}₮
        </span>
        <span className="bg-purple-600 text-white px-2 py-0.5 rounded text-[0.7rem] font-semibold">
          ЭМНДШ(б): {fmtInt(totals.emndsh_org)}₮
        </span>
        <span className="bg-amber-500 text-white px-2 py-0.5 rounded text-[0.7rem] font-semibold">
          ХХОАТ: {fmtInt(totals.hhoat)}₮
        </span>
        <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[0.7rem] font-semibold">
          Гарт: {fmtInt(totals.gart)}₮
        </span>
      </div>

      {/* ── 5 gradient KPI cards (legacy parity) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <KpiCard
          label="Нийт ЦАЛИНЖИЛТ"
          value={`${fmtInt(totals.niit)}₮`}
          sub={`${totals.count} ажилтан`}
          icon={<Coins className="w-5 h-5" />}
          gradient="from-blue-500 to-blue-700"
        />
        <KpiCard
          label="ЭМНДШ — АЖИЛТАН"
          value={`${fmtInt(totals.emndsh)}₮`}
          sub="11.5% суутгал"
          icon={<HeartPulse className="w-5 h-5" />}
          gradient="from-red-500 to-red-700"
        />
        <KpiCard
          label="ЭМНДШ — БАЙГУУЛЛАГА"
          value={`${fmtInt(totals.emndsh_org)}₮`}
          sub="12.5% нэмж төлнө"
          icon={<Building2 className="w-5 h-5" />}
          gradient="from-purple-600 to-fuchsia-700"
        />
        <KpiCard
          label="ХХОАТ"
          value={`${fmtInt(totals.hhoat)}₮`}
          sub="10% орлогын татвар"
          icon={<Percent className="w-5 h-5" />}
          gradient="from-orange-500 to-orange-700"
        />
        <KpiCard
          label="ГАРТ ОЛГОХ"
          value={`${fmtInt(totals.gart)}₮`}
          sub="Урьдчилгаа хасч"
          icon={<HandCoins className="w-5 h-5" />}
          gradient="from-emerald-500 to-emerald-700"
        />
      </div>

      {/* ── Org-cost banner ── */}
      <div className="bg-fuchsia-50 border border-fuchsia-200 rounded p-2.5 text-sm flex items-center gap-2 print:hidden">
        <Calculator className="w-4 h-4 text-purple-700 shrink-0" />
        <strong className="text-slate-800">Байгууллагын нийт цалингийн зардал:</strong>
        <span className="font-bold font-mono text-purple-800">
          {fmtInt(totals.niit + totals.emndsh_org)}₮
        </span>
        <span className="text-xs text-slate-500">
          (Нийт орлого + Байгууллагын ЭМНДШ {fmtInt(totals.emndsh_org)}₮)
        </span>
      </div>

      {/* ── Action bar ── */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded p-2 flex-wrap gap-2 print:hidden">
        <div className="flex gap-2">
          <button
            onClick={handleRecalc}
            disabled={pending}
            className="border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded text-xs flex items-center gap-1.5 disabled:opacity-60"
          >
            <Calculator className="w-3.5 h-3.5" /> Тооцоолох / Сэргээх
          </button>
          {hasDraft && (
            <button
              onClick={handleApprove}
              disabled={pending}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded text-xs flex items-center gap-1.5 disabled:opacity-60"
              title={`${statusCounts.draft} ноорог бичлэг баталгаажих`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Баталгаажуулах
              <span className="ml-0.5 px-1.5 py-0 bg-white/25 rounded text-[0.65rem]">
                {statusCounts.draft}
              </span>
            </button>
          )}
          {hasApproved && !showPostForm && (
            <button
              onClick={() => setShowPostForm(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs flex items-center gap-1.5"
              title={`${statusCounts.approved} баталгаажсан бичлэг журналд орох`}
            >
              <FileText className="w-3.5 h-3.5" /> Журналд оруулах
              <span className="ml-0.5 px-1.5 py-0 bg-white/25 rounded text-[0.65rem]">
                {statusCounts.approved}
              </span>
            </button>
          )}
          {allPosted && <Badge color="bg-emerald-100 text-emerald-700">Журналд орсон</Badge>}
          {/* Status legend for mixed state — surfaces e.g. "ноорог:1 батлсан:5"
              so the accountant sees why both Approve + Post buttons can show
              at the same time. */}
          {(() => {
            const nonZero = (statusCounts.draft > 0 ? 1 : 0) + (statusCounts.approved > 0 ? 1 : 0) + (statusCounts.posted > 0 ? 1 : 0);
            if (nonZero < 2) return null;
            return (
              <span className="text-[0.65rem] text-slate-500 ml-1">
                {statusCounts.draft > 0 && <>ноорог:{statusCounts.draft} </>}
                {statusCounts.approved > 0 && <>батлсан:{statusCounts.approved} </>}
                {statusCounts.posted > 0 && <>журналд:{statusCounts.posted}</>}
              </span>
            );
          })()}
        </div>
        {msg && <span className="text-xs text-slate-600">{msg}</span>}
      </div>

      {/* ── Batch-post form ── */}
      {showPostForm && (
        <div className="bg-white border border-emerald-200 rounded p-4 space-y-3">
          <h3 className="text-sm font-semibold">Журналд оруулах — дансууд</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Цалингийн зардал (Dr)</label>
              <AccountPicker name="salary_exp" filterType="expense" placeholder="71..." onChange={(o) => setSalaryExp(o?.id ?? "")} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Цалингийн өглөг (Cr)</label>
              <AccountPicker name="salary_pay" filterType="liability" placeholder="21..." onChange={(o) => setSalaryPay(o?.id ?? "")} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">ЭМНДШ-ын өглөг (Cr)</label>
              <AccountPicker name="emndsh_pay" filterType="liability" placeholder="21..." onChange={(o) => setEmndshPay(o?.id ?? "")} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">ХХОАТ-ын өглөг (Cr)</label>
              <AccountPicker name="hhoat_pay" filterType="liability" placeholder="21..." onChange={(o) => setHhoatPay(o?.id ?? "")} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowPostForm(false)} className="px-3 py-1.5 border border-slate-300 rounded text-xs">Цуцлах</button>
            <button onClick={handlePost} disabled={pending} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs disabled:opacity-60">
              {pending ? "Оруулж байна..." : "Батлах + Журналд оруулах"}
            </button>
          </div>
        </div>
      )}

      {/* ── Salary grid table ── */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <div className="px-3 py-2 text-white text-sm font-semibold flex items-center gap-1.5" style={{ background: "#1a3c5e" }}>
          <FileText className="w-4 h-4" />
          {year} оны {month}-р сарын цалингийн бүртгэл
          <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs">{employees.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            {/* Grouped headers (rowspan/colspan) */}
            <thead style={{ background: "#263238", color: "#fff" }}>
              <tr>
                <th rowSpan={2} className="px-2 py-1.5 text-left font-semibold" style={{ minWidth: 160 }}>Ажилтан</th>
                <th rowSpan={2} className="px-2 py-1.5 text-right font-semibold" style={{ width: 100 }}>Үндсэн цалин</th>
                <th rowSpan={2} className="px-2 py-1.5 text-center font-semibold" style={{ width: 90 }}>
                  Ажилласан ц <span className="opacity-60 text-[0.6rem]">/{totalHours}ц</span>
                </th>
                <th rowSpan={2} className="px-2 py-1.5 text-right font-semibold" style={{ width: 90 }}>Борлуулалт</th>
                <th rowSpan={2} className="px-2 py-1.5 text-right font-semibold" style={{ width: 90 }}>ЭА нэмэгдэл</th>
                <th colSpan={2} className="px-2 py-1.5 text-center font-semibold" style={{ color: "#81d4fa", borderBottom: "1px solid #455a64" }}>
                  Нийт орлого
                </th>
                <th colSpan={2} className="px-2 py-1.5 text-center font-semibold" style={{ color: "#ef9a9a", borderBottom: "1px solid #455a64" }}>
                  Суутгал
                </th>
                <th rowSpan={2} className="px-2 py-1.5 text-right font-semibold" style={{ width: 100, color: "#ffcc80" }}>Урьдчилгаа</th>
                <th rowSpan={2} className="px-2 py-1.5 text-right font-semibold" style={{ width: 100, color: "#a5d6a7" }}>Гарт авах</th>
                <th rowSpan={2} className="px-2 py-1.5 text-center font-semibold print:hidden" style={{ width: 50 }}>Статус</th>
              </tr>
              <tr>
                <th className="px-2 py-1.5 text-right font-semibold" style={{ color: "#81d4fa", width: 100 }}>Бодогдсон</th>
                <th className="px-2 py-1.5 text-right font-semibold" style={{ color: "#81d4fa", width: 100 }}>Нийт</th>
                <th className="px-2 py-1.5 text-right font-semibold" style={{ color: "#ef9a9a", width: 90 }}>ЭМНДШ</th>
                <th className="px-2 py-1.5 text-right font-semibold" style={{ color: "#ef9a9a", width: 90 }}>ХХОАТ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rowPreviews.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-10 text-slate-400">
                    Ажилтан байхгүй байна.
                  </td>
                </tr>
              ) : (
                rowPreviews.map(({ e, rec, preview }, idx) => {
                  const color = EMP_COLORS[idx % EMP_COLORS.length];
                  // Use the live preview when we have a record; fall back to
                  // raw DB columns. NaN-safe via the outer `safeNum` helper.
                  const niitVal   = preview?.niit   ?? safeNum(rec?.total_income);
                  const bodVal    = preview?.bod    ?? safeNum(rec?.bod_salary);
                  const emndshVal = preview?.emndsh ?? safeNum(rec?.emndsh);
                  const hhoatVal  = preview?.hhoat  ?? safeNum(rec?.hhoat);
                  const ded23Val  = preview?.ded23  ?? 0;
                  const advVal    = preview?.adv    ?? safeNum(rec?.advance);
                  const gartVal   = preview?.gart   ?? safeNum(rec?.net_pay);
                  // CRITICAL FIX #3: only compute the percent when we actually
                  // have a payroll record. Otherwise the column would falsely
                  // read "100%" (because default = totalHours / totalHours)
                  // for employees who never punched in this month.
                  const workedPct = rec && totalHours > 0
                    ? (rec.worked_hours / totalHours) * 100
                    : null;
                  return (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-2 py-1.5">
                        <div className="flex items-start gap-1.5">
                          <span
                            className="inline-block rounded-full mt-1 shrink-0"
                            style={{ width: 9, height: 9, background: color }}
                          />
                          <div>
                            <Link
                              href={`/salary/employees/${e.id}/edit`}
                              className="font-semibold text-slate-800 hover:text-blue-700 hover:underline text-[0.78rem]"
                            >
                              {e.full_name}
                            </Link>
                            {e.title && <div className="text-[0.65rem] text-slate-500">{e.title}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">{fmtInt(e.base_salary)}</td>
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="number" min="0" max="300" step="0.5"
                          defaultValue={rec?.worked_hours ?? totalHours}
                          onBlur={(ev) => {
                            const v = Number(ev.target.value);
                            if (rec && v !== rec.worked_hours) handleCellChange(rec.id, "worked_hours", v);
                          }}
                          onKeyDown={enterToBlur}
                          disabled={!rec}
                          className="w-16 px-1 py-0.5 border border-slate-300 rounded text-right text-xs font-mono disabled:bg-slate-50"
                        />
                        <div className="text-[0.62rem] text-slate-400 mt-0.5">
                          {workedPct === null ? "—" : `${workedPct.toFixed(0)}%`}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input
                          type="number" min="0" step="1000"
                          defaultValue={rec?.sales_bonus ?? 0}
                          onBlur={(ev) => {
                            const v = Number(ev.target.value);
                            if (rec && v !== rec.sales_bonus) handleCellChange(rec.id, "sales_bonus", v);
                          }}
                          onKeyDown={enterToBlur}
                          disabled={!rec}
                          placeholder="0"
                          className="w-20 px-1 py-0.5 border border-slate-300 rounded text-right text-xs font-mono disabled:bg-slate-50"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input
                          type="number" min="0" step="1000"
                          defaultValue={rec?.leave_pay || ""}
                          onBlur={(ev) => {
                            const v = Number(ev.target.value);
                            if (rec && v !== rec.leave_pay) handleCellChange(rec.id, "leave_pay", v);
                          }}
                          onKeyDown={enterToBlur}
                          disabled={!rec}
                          placeholder="0"
                          className="w-20 px-1 py-0.5 border border-slate-300 rounded text-right text-xs font-mono disabled:bg-slate-50"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono" style={{ color: "#0277bd" }}>
                        {fmtInt(bodVal)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-bold" style={{ color: "#0277bd" }}>
                        {fmtInt(niitVal)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono" style={{ color: "#c62828" }}>
                        {fmtInt(emndshVal)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono" style={{ color: "#c62828" }}>
                        <div>{fmtInt(hhoatVal)}</div>
                        {ded23Val > 0 && (
                          <div className="text-[0.6rem] text-slate-400 font-normal">хөнгөлт: {fmtInt(ded23Val)}</div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right" style={{ color: "#e65100" }}>
                        <input
                          type="number" min="0" step="1000"
                          defaultValue={rec?.advance ?? 0}
                          onBlur={(ev) => {
                            const v = Number(ev.target.value);
                            if (rec && v !== rec.advance) handleCellChange(rec.id, "advance", v);
                          }}
                          onKeyDown={enterToBlur}
                          disabled={!rec}
                          className="w-24 px-1 py-0.5 border border-slate-300 rounded text-right text-xs font-mono disabled:bg-slate-50"
                          style={{ color: "#e65100" }}
                        />
                        <div className="text-[0.6rem] text-slate-400 mt-0.5">
                          {e.adv_base ? "тогтмол" : "40%"}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-bold" style={{ color: gartVal >= 0 ? "#2e7d32" : "#c62828" }}>
                        {fmtInt(gartVal)}₮
                      </td>
                      <td className="px-2 py-1.5 text-center print:hidden">
                        {rec ? (
                          <Badge color={
                            rec.status === "posted" ? "bg-emerald-100 text-emerald-700"
                            : rec.status === "approved" ? "bg-yellow-100 text-yellow-800"
                            : "bg-slate-200 text-slate-700"
                          }>{SALARY_STATUS[rec.status as keyof typeof SALARY_STATUS]}</Badge>
                        ) : (
                          <span className="text-slate-300" title="Recalc хийгээгүй">
                            <Info className="w-3 h-3 inline" />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {totals.count > 0 && (
              <tfoot className="text-white font-bold" style={{ background: "#263238" }}>
                <tr>
                  <td colSpan={5} className="px-2 py-1.5 text-right text-[0.7rem]">
                    Нийт {totals.count} ажилтан:
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[0.72rem]" style={{ color: "#81d4fa" }}>
                    {fmtInt(totals.bod)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[0.72rem]" style={{ color: "#81d4fa" }}>
                    {fmtInt(totals.niit)}₮
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[0.72rem]" style={{ color: "#ef9a9a" }}>
                    {fmtInt(totals.emndsh)}₮
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[0.72rem]" style={{ color: "#ef9a9a" }}>
                    {fmtInt(totals.hhoat)}₮
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[0.72rem]" style={{ color: "#ffcc80" }}>
                    {fmtInt(totals.adv)}₮
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[0.72rem]" style={{ color: "#a5d6a7" }}>
                    {fmtInt(totals.gart)}₮
                  </td>
                  <td className="print:hidden"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body { background: white; }
          table { font-size: 7.5pt !important; }
          input { border: none !important; background: transparent !important; }
        }
      `}</style>
    </div>
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
        <div className="text-[0.65rem] opacity-90 uppercase tracking-wide font-semibold">{label}</div>
        {icon}
      </div>
      <div className="text-lg font-bold font-mono leading-tight">{value}</div>
      <div className="text-[0.65rem] opacity-80 mt-0.5">{sub}</div>
    </div>
  );
}

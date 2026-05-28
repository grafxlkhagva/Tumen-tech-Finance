"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { calcSalary } from "@/lib/payroll/calc";
import { fmtMoney } from "@/lib/format";
import { SALARY_STATUS } from "@/lib/i18n/labels";
import { Badge } from "@/components/ui/Badge";
import { AccountPicker } from "@/components/ui/AccountPicker";
import {
  recalcPayrollMonth, updateSalaryCell, approveMonth, postSalaryBatch,
} from "./actions";
import { Calculator, CheckCircle2, FileText, Zap } from "lucide-react";

type Employee = {
  id: string;
  first_name: string;
  last_name: string | null;
  full_name: string;
  title: string | null;
  base_salary: number;
  phone_allowance: number;
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

export function SalaryGrid({
  year, month, employees, records,
}: {
  year: number;
  month: number;
  employees: Employee[];
  records: Record[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  // Map records by employee_id
  const recMap = new Map(records.map((r) => [r.employee_id, r]));

  // For batch post
  const [salaryExp, setSalaryExp] = useState("");
  const [salaryPay, setSalaryPay] = useState("");
  const [emndshPay, setEmndshPay] = useState("");
  const [hhoatPay, setHhoatPay] = useState("");
  const [showPostForm, setShowPostForm] = useState(false);

  const allApproved = records.length > 0 && records.every((r) => r.status === "approved");
  const allDraft = records.length > 0 && records.every((r) => r.status === "draft");
  const allPosted = records.length > 0 && records.every((r) => r.status === "posted");

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
    if (!recordId) return; // record must exist (recalc first)
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

  // Totals
  const totals = records.reduce(
    (s, r) => ({
      niit: s.niit + Number(r.total_income || 0),
      emndsh: s.emndsh + Number(r.emndsh || 0),
      hhoat: s.hhoat + Number(r.hhoat || 0),
      adv: s.adv + Number(r.advance || 0),
      gart: s.gart + Number(r.net_pay || 0),
    }),
    { niit: 0, emndsh: 0, hhoat: 0, adv: 0, gart: 0 },
  );

  return (
    <div className="space-y-3">
      {/* Action bar */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded p-3 flex-wrap gap-2">
        <div className="flex gap-2">
          <button
            onClick={handleRecalc}
            disabled={pending}
            className="border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded text-sm flex items-center gap-1.5 disabled:opacity-60"
          >
            <Calculator className="w-3.5 h-3.5" /> Тооцоолох / Сэргээх
          </button>
          {records.length > 0 && allDraft && (
            <button
              onClick={handleApprove}
              disabled={pending}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1.5 disabled:opacity-60"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Баталгаажуулах
            </button>
          )}
          {records.length > 0 && allApproved && !showPostForm && (
            <button
              onClick={() => setShowPostForm(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" /> Журналд оруулах
            </button>
          )}
          {allPosted && <Badge color="bg-green-100 text-green-700">Журналд орсон</Badge>}
        </div>
        {msg && <span className="text-xs text-slate-600">{msg}</span>}
      </div>

      {/* Batch post form */}
      {showPostForm && (
        <div className="bg-white border border-green-200 rounded p-4 space-y-3">
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
            <button onClick={handlePost} disabled={pending} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs disabled:opacity-60">
              {pending ? "Оруулж байна..." : "Батлах + Журналд оруулах"}
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-2 py-2 text-left min-w-[180px]">Ажилтан</th>
              <th className="px-2 py-2 text-right w-20">Цаг</th>
              <th className="px-2 py-2 text-right w-24">Утас</th>
              <th className="px-2 py-2 text-right w-24">Бонус</th>
              <th className="px-2 py-2 text-right w-24">Чөлөө</th>
              <th className="px-2 py-2 text-right w-28">Нийт</th>
              <th className="px-2 py-2 text-right w-24">ЭМНДШ</th>
              <th className="px-2 py-2 text-right w-24">ХХОАТ</th>
              <th className="px-2 py-2 text-right w-28">Аванс</th>
              <th className="px-2 py-2 text-right w-28">Гарт</th>
              <th className="px-2 py-2 text-center w-20">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((e) => {
              const rec = recMap.get(e.id);
              // Live preview (recompute using TS twin) — DB updates async
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
              return (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-2 py-2">
                    <div className="text-sm">{e.full_name}</div>
                    {e.title && <div className="text-[0.65rem] text-slate-500">{e.title}</div>}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number" step="0.5" defaultValue={rec?.worked_hours ?? 176}
                      onBlur={(ev) => {
                        const v = Number(ev.target.value);
                        if (rec && v !== rec.worked_hours) handleCellChange(rec.id, "worked_hours", v);
                      }}
                      className="w-20 px-1.5 py-1 border border-slate-300 rounded text-right text-xs font-mono"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number" step="1" defaultValue={rec?.phone_allowance ?? e.phone_allowance ?? 0}
                      onBlur={(ev) => {
                        const v = Number(ev.target.value);
                        if (rec && v !== rec.phone_allowance) handleCellChange(rec.id, "phone_allowance", v);
                      }}
                      className="w-24 px-1.5 py-1 border border-slate-300 rounded text-right text-xs font-mono"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number" step="1" defaultValue={rec?.sales_bonus ?? 0}
                      onBlur={(ev) => {
                        const v = Number(ev.target.value);
                        if (rec && v !== rec.sales_bonus) handleCellChange(rec.id, "sales_bonus", v);
                      }}
                      className="w-24 px-1.5 py-1 border border-slate-300 rounded text-right text-xs font-mono"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number" step="1" defaultValue={rec?.leave_pay ?? 0}
                      onBlur={(ev) => {
                        const v = Number(ev.target.value);
                        if (rec && v !== rec.leave_pay) handleCellChange(rec.id, "leave_pay", v);
                      }}
                      className="w-24 px-1.5 py-1 border border-slate-300 rounded text-right text-xs font-mono"
                    />
                  </td>
                  <td className="px-2 py-2 font-mono text-right text-xs font-semibold">
                    {fmtMoney(preview?.niit ?? rec?.total_income ?? 0)}
                  </td>
                  <td className="px-2 py-2 font-mono text-right text-xs text-red-600">
                    {fmtMoney(preview?.emndsh ?? rec?.emndsh ?? 0)}
                  </td>
                  <td className="px-2 py-2 font-mono text-right text-xs text-red-600">
                    {fmtMoney(preview?.hhoat ?? rec?.hhoat ?? 0)}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number" step="1" defaultValue={rec?.advance ?? 0}
                      onBlur={(ev) => {
                        const v = Number(ev.target.value);
                        if (rec && v !== rec.advance) handleCellChange(rec.id, "advance", v);
                      }}
                      className="w-28 px-1.5 py-1 border border-slate-300 rounded text-right text-xs font-mono"
                    />
                  </td>
                  <td className="px-2 py-2 font-mono text-right text-xs font-bold text-green-700">
                    {fmtMoney(preview?.gart ?? rec?.net_pay ?? 0)}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {rec ? (
                      <Badge color={
                        rec.status === "posted" ? "bg-green-100 text-green-700"
                        : rec.status === "approved" ? "bg-yellow-100 text-yellow-800"
                        : "bg-slate-200 text-slate-700"
                      }>{SALARY_STATUS[rec.status as keyof typeof SALARY_STATUS]}</Badge>
                    ) : (
                      <span className="text-[0.65rem] text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {records.length > 0 && (
              <tr className="bg-slate-100 font-semibold">
                <td colSpan={5} className="px-2 py-2 text-right text-xs uppercase">Нийт</td>
                <td className="px-2 py-2 font-mono text-right">{fmtMoney(totals.niit)}</td>
                <td className="px-2 py-2 font-mono text-right">{fmtMoney(totals.emndsh)}</td>
                <td className="px-2 py-2 font-mono text-right">{fmtMoney(totals.hhoat)}</td>
                <td className="px-2 py-2 font-mono text-right">{fmtMoney(totals.adv)}</td>
                <td className="px-2 py-2 font-mono text-right">{fmtMoney(totals.gart)}</td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

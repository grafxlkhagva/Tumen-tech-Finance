import type { CFOfficial } from "@/lib/reports/cashflow";
import type { CompanyMeta } from "@/lib/supabase/company";
import { ArrowDownToLine, ArrowUpFromLine, Equal, ArrowLeftRight, Building, HandCoins, BarChart3 } from "lucide-react";

const fmt = (n: number) =>
  n ? Math.abs(n).toLocaleString("mn-MN", { maximumFractionDigits: 0 }) : "—";

const fmtSigned = (n: number) =>
  n === 0 ? "—" : n.toLocaleString("mn-MN", { maximumFractionDigits: 0 });

const MN = ["", "1-р", "2-р", "3-р", "4-р", "5-р", "6-р", "7-р", "8-р", "9-р", "10-р", "11-р", "12-р"];

/**
 * Official cashflow — Сангийн Сайдын 2017 оны 361 дугаар тушаалын 4 дугаар
 * хавсралтын маяг. Two-column layout: 3 section cards (operating/investing/
 * financing) + total card on left, monthly summary + KPI cards on right.
 */
export function CashflowOfficialView({
  data,
  companyMeta,
  year,
  openCash,
  closeCash,
}: {
  data: CFOfficial;
  companyMeta: CompanyMeta | null;
  year: number;
  openCash: number;
  closeCash: number;
}) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-white rounded border border-slate-200 text-center py-3 px-4">
        <div className="text-xs text-slate-500">
          Сангийн Сайдын 2017 оны 361 дугаар тушаалын 4 дугаар хавсралт
        </div>
        <h2 className="text-lg font-bold mt-2 mb-1 uppercase">МӨНГӨН ГҮЙЛГЭЭНИЙ ТАЙЛАН</h2>
        <div className="text-sm text-slate-700">
          &quot;{companyMeta?.name ?? "(Байгууллага сонгогдоогүй)"}&quot; ХХК &nbsp;·&nbsp; {year} он
        </div>
        <div className="text-xs text-slate-500">
          {companyMeta?.register && <>Регистр: {companyMeta.register} &nbsp;|&nbsp; </>}
          {companyMeta?.tin && <>ХРГ: {companyMeta.tin} &nbsp;|&nbsp; </>}
          (төгрөгөөр)
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left: 3 sections + summary card (2/3 width) */}
        <div className="lg:col-span-2 space-y-3">
          <SectionCard
            number={1}
            title="ҮНДСЭН ҮЙЛ АЖИЛЛАГААНЫ МӨНГӨН ГҮЙЛГЭЭ"
            color="linear-gradient(90deg,#1565C0,#1976D2)"
            icon={<ArrowLeftRight className="w-4 h-4" />}
            rows={[
              { code: "1.1",   label: "Мөнгө орлого", value: data.op_income, indent: 1 },
              { code: "1.1.1", label: "Борлуулалтаас орсон мөнгө", value: data.op_income, indent: 2 },
              { code: "1.2",   label: "Мөнгө зарлага", value: data.op_expense, indent: 1 },
              { code: "1.2.1", label: "Нийлүүлэгч, бусадт төлсөн мөнгө", value: data.op_expense, indent: 2 },
            ]}
            netCode="1.3"
            netLabel="Үндсэн үйл ажиллагааны цэвэр мөнгөн гүйлгээ"
            netValue={data.op_net}
          />

          <SectionCard
            number={2}
            title="ХӨРӨНГӨ ОРУУЛАЛТЫН МӨНГӨН ГҮЙЛГЭЭ"
            color="linear-gradient(90deg,#6A1B9A,#8E24AA)"
            icon={<Building className="w-4 h-4" />}
            rows={[
              { code: "2.1", label: "Мөнгө орлого (хөрөнгө борлуулсан)", value: data.inv_income, indent: 1 },
              { code: "2.2", label: "Мөнгө зарлага (хөрөнгө худалдан авсан)", value: data.inv_expense, indent: 1 },
            ]}
            netCode="2.3"
            netLabel="Хөрөнгө оруулалтын цэвэр мөнгөн гүйлгээ"
            netValue={data.inv_net}
          />

          <SectionCard
            number={3}
            title="САНХҮҮГИЙН МӨНГӨН ГҮЙЛГЭЭ"
            color="linear-gradient(90deg,#B71C1C,#E53935)"
            icon={<HandCoins className="w-4 h-4" />}
            rows={[
              { code: "3.1", label: "Зээл, зогсоол авсан", value: data.fin_income, indent: 1 },
              { code: "3.2", label: "Зээл, зогсоол төлсөн", value: data.fin_expense, indent: 1 },
            ]}
            netCode="3.3"
            netLabel="Санхүүгийн цэвэр мөнгөн гүйлгээ"
            netValue={data.fin_net}
          />

          {/* Grand total card */}
          <div
            className="rounded-xl text-white py-3 px-4"
            style={{ background: "linear-gradient(135deg,#1a3c5e,#2196F3)" }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs opacity-75">
                4. МӨНГӨН ХӨРӨНГИЙН ЦЭВЭР ӨСӨЛТ / (БУУРАЛТ)
              </div>
              <div className="text-2xl font-bold font-mono">
                {data.total_net.toLocaleString("mn-MN", { maximumFractionDigits: 0 })}₮
              </div>
            </div>
            <hr className="border-white/25 my-2" />
            <div className="flex items-center justify-between gap-3 text-xs opacity-75">
              <div>5. Эхний үлдэгдэл (тайлант үе эхлэх)</div>
              <div className="font-mono">{fmtSigned(openCash)}₮</div>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs opacity-90">
              <div>6. Эцсийн үлдэгдэл (тайлант үе дуусах)</div>
              <div className="font-mono font-semibold">{fmtSigned(closeCash)}₮</div>
            </div>
          </div>
        </div>

        {/* Right: monthly summary + KPI (1/3 width) */}
        <div className="space-y-3">
          <div className="bg-white rounded border border-slate-200 overflow-hidden">
            <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" /> Сарын хөдөлгөөн — {year} он
            </div>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Сар</th>
                  <th className="px-2 py-1.5 text-right font-medium text-emerald-600">Орлого</th>
                  <th className="px-2 py-1.5 text-right font-medium text-red-600">Зарлага</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.monthly.map((m) => (
                  <tr key={m.month}>
                    <td className="px-2 py-1">{MN[m.month] ?? m.month}</td>
                    <td className="px-2 py-1 text-right font-mono text-emerald-700">
                      {fmt(m.income)}
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-red-700">
                      {fmt(m.expense)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold">
                <tr>
                  <td className="px-2 py-1.5">Нийт</td>
                  <td className="px-2 py-1.5 text-right font-mono text-emerald-700">
                    {fmt(data.op_income + data.inv_income + data.fin_income)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-red-700">
                    {fmt(data.op_expense + data.inv_expense + data.fin_expense)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <KpiCard
            label="Нийт мөнгө орлого"
            value={data.op_income + data.inv_income + data.fin_income}
            icon={<ArrowDownToLine className="w-4 h-4" />}
            color="bg-blue-600"
          />
          <KpiCard
            label="Нийт мөнгө зарлага"
            value={data.op_expense + data.inv_expense + data.fin_expense}
            icon={<ArrowUpFromLine className="w-4 h-4" />}
            color="bg-red-600"
          />
          <KpiCard
            label="Цэвэр гүйлгээ"
            value={data.total_net}
            icon={<Equal className="w-4 h-4" />}
            color={data.total_net >= 0 ? "bg-emerald-600" : "bg-orange-600"}
          />
        </div>
      </div>
    </div>
  );
}

type SectionRow = { code: string; label: string; value: number; indent: 1 | 2 };

function SectionCard({
  number,
  title,
  color,
  icon,
  rows,
  netCode,
  netLabel,
  netValue,
}: {
  number: number;
  title: string;
  color: string;
  icon: React.ReactNode;
  rows: SectionRow[];
  netCode: string;
  netLabel: string;
  netValue: number;
}) {
  return (
    <div className="bg-white rounded border border-slate-200 overflow-hidden">
      <div className="px-3 py-2 text-white font-bold text-sm flex items-center gap-2" style={{ background: color }}>
        {icon} {number}. {title}
      </div>
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium" style={{ width: 50 }}>Мөр</th>
            <th className="px-2 py-1.5 text-left font-medium">Үзүүлэлт</th>
            <th className="px-2 py-1.5 text-right font-medium" style={{ width: 140 }}>Дүн</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.code}>
              <td className="px-2 py-1 text-slate-500 font-mono text-[0.7rem]">{r.code}</td>
              <td
                className="px-2 py-1"
                style={{ paddingLeft: r.indent === 2 ? 28 : 12 }}
              >
                {r.label}
              </td>
              <td className={`px-2 py-1 text-right font-mono ${r.value < 0 ? "text-red-600" : ""}`}>
                {fmt(r.value)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-white font-bold text-xs" style={{ background: color }}>
            <td className="px-2 py-1.5 font-mono">{netCode}</td>
            <td className="px-2 py-1.5">{netLabel}</td>
            <td className="px-2 py-1.5 text-right font-mono">{fmt(netValue)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`${color} text-white rounded p-3`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs opacity-80">{label}</div>
        {icon}
      </div>
      <div className="text-xl font-bold font-mono">
        {value.toLocaleString("mn-MN", { maximumFractionDigits: 0 })}₮
      </div>
    </div>
  );
}

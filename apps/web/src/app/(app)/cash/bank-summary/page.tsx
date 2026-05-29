import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Landmark, ArrowLeft, Download } from "lucide-react";
import { fmtMoney, fmtMoneyOrDash } from "@/lib/format";
import { PrintButton } from "@/components/ui/PrintButton";

export const metadata = { title: "Мөнгөн хөрөнгийн нэгтгэл — Тумэн Accounting" };

type SearchParams = Promise<{ year?: string }>;

type FlowRow = {
  bank_id: string;
  bank_name: string;
  gl_code: string | null;
  gl_name: string | null;
  opening_balance: number;
  month: number;
  income: number;
  expense: number;
};

type BankSection = {
  bank_id: string;
  bank_name: string;
  gl_code: string | null;
  gl_name: string | null;
  opening: number;
  monthly: { m: number; open: number; inc: number; exp: number; net: number; close: number }[];
  totals: { inc: number; exp: number; net: number };
  closing: number;
};

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default async function BankSummaryPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const year = parseInt(sp.year ?? String(new Date().getFullYear()), 10);

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

  const rows = ((rpcResult.data ?? []) as FlowRow[]).map((r) => ({
    ...r,
    opening_balance: Number(r.opening_balance ?? 0),
    income: Number(r.income ?? 0),
    expense: Number(r.expense ?? 0),
  }));

  // Group by bank → build running balance per month
  const byBank = new Map<string, FlowRow[]>();
  for (const r of rows) {
    if (!byBank.has(r.bank_id)) byBank.set(r.bank_id, []);
    byBank.get(r.bank_id)!.push(r);
  }

  const sections: BankSection[] = [];
  for (const bankRows of byBank.values()) {
    const sorted = [...bankRows].sort((a, b) => a.month - b.month);
    const first = sorted[0];
    let bal = first.opening_balance;
    const monthly = sorted.map((r) => {
      const open = bal;
      const net = r.income - r.expense;
      const close = open + net;
      bal = close;
      return { m: r.month, open, inc: r.income, exp: r.expense, net, close };
    });
    const totals = {
      inc: monthly.reduce((s, m) => s + m.inc, 0),
      exp: monthly.reduce((s, m) => s + m.exp, 0),
      net: 0,
    };
    totals.net = totals.inc - totals.exp;
    sections.push({
      bank_id: first.bank_id,
      bank_name: first.bank_name,
      gl_code: first.gl_code,
      gl_name: first.gl_name,
      opening: first.opening_balance,
      monthly,
      totals,
      closing: monthly[monthly.length - 1]?.close ?? first.opening_balance,
    });
  }

  // Stable order: by GL code (1101, 1102, 1103, 1110, ...)
  sections.sort((a, b) => (a.gl_code ?? "z").localeCompare(b.gl_code ?? "z"));

  // Consolidated section: sum of every bank's monthly values + their openings
  const consolidatedOpen = sections.reduce((s, x) => s + x.opening, 0);
  const consolidatedMonthly = MONTHS.map((m, idx) => {
    const inc = sections.reduce((s, x) => s + (x.monthly[idx]?.inc ?? 0), 0);
    const exp = sections.reduce((s, x) => s + (x.monthly[idx]?.exp ?? 0), 0);
    return { m, inc, exp, net: inc - exp };
  });
  const consolidatedTotals = {
    inc: consolidatedMonthly.reduce((s, m) => s + m.inc, 0),
    exp: consolidatedMonthly.reduce((s, m) => s + m.exp, 0),
  };
  // Apply running balance to consolidated
  let cbBal = consolidatedOpen;
  const cbMonthlyWithBalance = consolidatedMonthly.map((m) => {
    const open = cbBal;
    const close = open + m.net;
    cbBal = close;
    return { ...m, open, close };
  });
  const consolidatedClosing = cbMonthlyWithBalance[11]?.close ?? consolidatedOpen;

  const exportUrl = `/api/export/cash?month=${year}-01&year=${year}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <Link href="/cash" className="text-xs text-slate-500 hover:underline flex items-center gap-1 mb-1">
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
              min="2020"
              max="2099"
              className="px-2 py-1.5 border border-slate-300 rounded text-sm w-24"
            />
            <button className="px-3 py-1.5 bg-slate-700 text-white rounded text-xs">Үзэх</button>
          </form>
          <a href={exportUrl} className="border border-green-300 bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded text-sm flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Excel
          </a>
          <PrintButton />
        </div>
      </div>

      {sections.length === 0 && (
        <div className="bg-white rounded-lg border border-slate-200 py-16 text-center">
          <Landmark className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <div className="text-sm font-medium text-slate-600">Банкны данс олдсонгүй</div>
        </div>
      )}

      {sections.map((s) => (
        <BankTable key={s.bank_id} section={s} />
      ))}

      {sections.length > 1 && (
        <div className="bg-white rounded-lg border-2 border-blue-300 overflow-x-auto">
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-block bg-blue-600 text-white px-2 py-0.5 rounded text-xs font-bold">НЭГТГЭЛ</span>
              <span className="text-sm font-semibold text-slate-800">Бүх банкны нэгтгэсэн</span>
            </div>
            <div className="text-xs text-slate-600">
              Эхний үлдэгдэл: <span className="font-mono font-semibold">₮{fmtMoney(consolidatedOpen)}</span>
              {" · "}
              Эцсийн үлдэгдэл: <span className="font-mono font-semibold">₮{fmtMoney(consolidatedClosing)}</span>
            </div>
          </div>
          <FlowTable
            opening={consolidatedOpen}
            monthly={cbMonthlyWithBalance}
            totals={{
              inc: consolidatedTotals.inc,
              exp: consolidatedTotals.exp,
              net: consolidatedTotals.inc - consolidatedTotals.exp,
            }}
          />
        </div>
      )}

      <style>{`@media print { @page { size: landscape; margin: 0.4cm; } body { background: white; } }`}</style>
    </div>
  );
}

function BankTable({ section }: { section: BankSection }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="inline-block bg-slate-700 text-white px-2 py-0.5 rounded text-xs font-bold font-mono">
            {section.gl_code ?? "—"}
          </span>
          <span className="text-sm font-semibold text-slate-800">{section.bank_name}</span>
        </div>
        <div className="text-xs text-slate-600">
          Эхний үлдэгдэл: <span className="font-mono font-semibold">₮{fmtMoney(section.opening)}</span>
          {" · "}
          Эцсийн үлдэгдэл: <span className="font-mono font-semibold">₮{fmtMoney(section.closing)}</span>
        </div>
      </div>
      <FlowTable opening={section.opening} monthly={section.monthly} totals={section.totals} />
    </div>
  );
}

function FlowTable({
  opening,
  monthly,
  totals,
}: {
  opening: number;
  monthly: { m: number; open: number; inc: number; exp: number; net: number; close: number }[];
  totals: { inc: number; exp: number; net: number };
}) {
  return (
    <table className="w-full text-xs">
      <thead className="bg-slate-50 text-slate-500">
        <tr>
          <th scope="col" className="px-3 py-2 text-left min-w-[140px]">Үзүүлэлт</th>
          {monthly.map((m) => (
            <th key={m.m} scope="col" className="px-2 py-2 text-right min-w-[90px]">
              {m.m}-р сар
            </th>
          ))}
          <th scope="col" className="px-3 py-2 text-right border-l border-slate-200 bg-slate-100 min-w-[100px]">Нийт</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        <tr>
          <th scope="row" className="px-3 py-1.5 text-left text-slate-600 font-normal">Эхний үлдэгдэл</th>
          {monthly.map((m) => (
            <td key={m.m} className="px-2 py-1.5 font-mono text-right text-slate-600">
              {fmtMoneyOrDash(m.open)}
            </td>
          ))}
          <td className="px-3 py-1.5 font-mono text-right font-semibold border-l border-slate-200 bg-slate-50">
            {fmtMoneyOrDash(opening)}
          </td>
        </tr>
        <tr className="bg-green-50/40">
          <th scope="row" className="px-3 py-1.5 text-left text-green-700 font-normal">↓ Орлого</th>
          {monthly.map((m) => (
            <td key={m.m} className="px-2 py-1.5 font-mono text-right text-green-700">
              {fmtMoneyOrDash(m.inc)}
            </td>
          ))}
          <td className="px-3 py-1.5 font-mono text-right font-semibold text-green-700 border-l border-slate-200 bg-slate-50">
            {fmtMoneyOrDash(totals.inc)}
          </td>
        </tr>
        <tr className="bg-red-50/40">
          <th scope="row" className="px-3 py-1.5 text-left text-red-700 font-normal">↑ Зарлага</th>
          {monthly.map((m) => (
            <td key={m.m} className="px-2 py-1.5 font-mono text-right text-red-700">
              {fmtMoneyOrDash(m.exp)}
            </td>
          ))}
          <td className="px-3 py-1.5 font-mono text-right font-semibold text-red-700 border-l border-slate-200 bg-slate-50">
            {fmtMoneyOrDash(totals.exp)}
          </td>
        </tr>
        <tr className="bg-yellow-50/60">
          <th scope="row" className="px-3 py-1.5 text-left font-medium text-slate-700">Цэвэр урсгал</th>
          {monthly.map((m) => (
            <td
              key={m.m}
              className={`px-2 py-1.5 font-mono text-right font-medium ${
                m.net === 0 ? "text-slate-500" : m.net > 0 ? "text-green-700" : "text-red-700"
              }`}
            >
              {m.net === 0 ? "—" : `${m.net > 0 ? "+" : ""}${fmtMoney(m.net)}`}
            </td>
          ))}
          <td
            className={`px-3 py-1.5 font-mono text-right font-bold border-l border-slate-200 bg-yellow-100/80 ${
              totals.net === 0 ? "text-slate-500" : totals.net > 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            {totals.net === 0 ? "—" : `${totals.net > 0 ? "+" : ""}${fmtMoney(totals.net)}`}
          </td>
        </tr>
        <tr className="bg-slate-100 font-semibold">
          <th scope="row" className="px-3 py-1.5 text-left text-slate-700">Эцсийн үлдэгдэл</th>
          {monthly.map((m) => (
            <td key={m.m} className="px-2 py-1.5 font-mono text-right">
              {fmtMoneyOrDash(m.close)}
            </td>
          ))}
          <td className="px-3 py-1.5 font-mono text-right border-l border-slate-300 bg-slate-200">
            {fmtMoneyOrDash(monthly[monthly.length - 1]?.close ?? opening)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

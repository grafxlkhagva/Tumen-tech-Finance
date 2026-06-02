import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/supabase/company";
import Link from "next/link";
import {
  Banknote, Filter, FileSpreadsheet, ArrowDownToLine, ArrowUpFromLine,
  Wallet, Link2Off, Search,
} from "lucide-react";
import { fmtMoney } from "@/lib/format";
import { Pagination } from "@/components/ui/Pagination";
import { ToastFromURL } from "@/components/ui/Toast";
import { PrintButton } from "@/components/ui/PrintButton";
import { CashRow } from "./_components/CashRow";
import { AutoLinkButton } from "./_components/AutoLinkButton";

export const metadata = { title: "Банкны хуулга — Тумэн Accounting" };

const PAGE_SIZE = 100;

type SearchParams = Promise<{
  page?: string;
  bank?: string;
  direction?: string;
  month?: string;        // "YYYY-MM"
  date_from?: string;
  date_to?: string;
  partner?: string;
  unlinked?: string;
}>;

const isoDate = (s: string | undefined): string | null =>
  s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;

function fmtInt(n: number): string {
  return fmtMoney(n).replace(/\.00$/, "");
}

export default async function CashPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const pageNum = Math.max(1, parseInt(sp.page || "1", 10));
  const offset = (pageNum - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const company = await getCurrentCompany(supabase);

  if (!company) {
    return (
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-2xl font-semibold flex items-center gap-2 mb-4">
          <Banknote className="w-6 h-6" /> Банкны хуулга
        </h1>
        <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-900">
          Байгууллага сонгогдоогүй байна.
        </div>
      </div>
    );
  }

  // Resolve the date window: an explicit month overrides date_from/date_to.
  const partnerQ = (sp.partner ?? "").trim().slice(0, 100);
  let dateFrom = isoDate(sp.date_from);
  let dateTo = isoDate(sp.date_to);
  if (sp.month && /^\d{4}-\d{2}$/.test(sp.month)) {
    const [y, m] = sp.month.split("-").map(Number);
    dateFrom = `${y}-${String(m).padStart(2, "0")}-01`;
    dateTo = m === 12 ? `${y}-12-31` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    // exclusive upper bound handled below via .lt for the row query; for RPC
    // we pass an inclusive last day, so recompute:
    const lastDay = new Date(y, m, 0).getDate();
    dateTo = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  }

  // ── Paginated rows query ──
  let q = supabase
    .from("cash_transactions")
    .select(
      "id, txn_date, direction, amount, description, partner_name, partner_id, category, contra_account_id, journal_id, is_reconciled, bank_account_id, partner:partners(id, name), contra_account:accounts!cash_transactions_contra_account_id_fkey(id, code, name), bank:bank_accounts(id, name, bank_name)",
      { count: "exact" },
    )
    .eq("company_id", company.companyId)
    .is("deleted_at", null)
    .order("txn_date", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (sp.bank) q = q.eq("bank_account_id", sp.bank);
  if (sp.direction && ["income", "expense"].includes(sp.direction)) {
    q = q.eq("direction", sp.direction as "income" | "expense");
  }
  if (dateFrom) q = q.gte("txn_date", dateFrom);
  if (dateTo) q = q.lte("txn_date", dateTo);
  if (partnerQ) q = q.ilike("partner_name", `%${partnerQ}%`);
  if (sp.unlinked === "1") q = q.is("contra_account_id", null);

  // ── Full-dataset totals (KPI cards) — same filters, via RPC ──
  const [rowsRes, summaryRes, banksRes] = await Promise.all([
    q,
    supabase.rpc("fn_cash_summary", {
      p_company_id: company.companyId,
      p_bank: sp.bank || null,
      p_direction: sp.direction === "income" || sp.direction === "expense" ? sp.direction : null,
      p_date_from: dateFrom,
      p_date_to: dateTo,
      p_partner: partnerQ || null,
      p_unlinked: sp.unlinked === "1",
    }),
    supabase
      .from("bank_accounts")
      .select("id, name, bank_name")
      .eq("company_id", company.companyId)
      .is("deleted_at", null)
      .order("name"),
  ]);

  const rows = rowsRes.data ?? [];
  const count = rowsRes.count ?? 0;
  const totalPages = Math.ceil(count / PAGE_SIZE);
  const banks = banksRes.data ?? [];

  const summary = (Array.isArray(summaryRes.data) ? summaryRes.data[0] : summaryRes.data) as
    | { total_income: number; total_expense: number; net_flow: number; unlinked_count: number; txn_count: number }
    | null;
  const income = Number(summary?.total_income ?? 0);
  const expense = Number(summary?.total_expense ?? 0);
  const netFlow = Number(summary?.net_flow ?? 0);
  const unlinkedCount = Number(summary?.unlinked_count ?? 0);
  const txnCount = Number(summary?.txn_count ?? count);

  // Quick-month buttons for the current year
  const thisYear = new Date().getFullYear();
  const filterParams = { partner: partnerQ, bank: sp.bank, direction: sp.direction, unlinked: sp.unlinked };
  const monthHref = (m: number) => {
    const u = new URLSearchParams();
    u.set("month", `${thisYear}-${String(m).padStart(2, "0")}`);
    for (const [k, v] of Object.entries(filterParams)) if (v) u.set(k, v);
    return `/cash?${u.toString()}`;
  };
  const yearHref = (() => {
    const u = new URLSearchParams();
    u.set("date_from", `${thisYear}-01-01`);
    u.set("date_to", `${thisYear}-12-31`);
    for (const [k, v] of Object.entries(filterParams)) if (v) u.set(k, v);
    return `/cash?${u.toString()}`;
  })();
  const hasFilter = !!(sp.bank || sp.direction || sp.month || sp.date_from || sp.date_to || partnerQ || sp.unlinked);

  return (
    <div className="space-y-3 max-w-[1700px] mx-auto">
      <ToastFromURL />

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <Banknote className="w-6 h-6" /> Мөнгөн хөрөнгийн хөдөлгөөн
          <span className="text-base text-slate-500 font-normal">
            — &quot;{company.meta?.name ?? "—"}&quot; ХХК
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <AutoLinkButton />
          <Link
            href="/cash/batch-journal"
            className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Сарын батч
          </Link>
          <PrintButton />
        </div>
      </div>

      {/* 4 gradient KPI cards (legacy parity) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="НИЙТ ОРЛОГО"
          value={`${fmtInt(income)}₮`}
          sub={`${txnCount} гүйлгээ`}
          icon={<ArrowDownToLine className="w-5 h-5" />}
          gradient="from-emerald-500 to-emerald-700"
        />
        <KpiCard
          label="НИЙТ ЗАРЛАГА"
          value={`${fmtInt(expense)}₮`}
          sub="&nbsp;"
          icon={<ArrowUpFromLine className="w-5 h-5" />}
          gradient="from-red-500 to-red-700"
        />
        <KpiCard
          label="ЦЭВЭР УРСГАЛ"
          value={`${fmtInt(netFlow)}₮`}
          sub="&nbsp;"
          icon={<Wallet className="w-5 h-5" />}
          gradient={netFlow >= 0 ? "from-blue-500 to-blue-700" : "from-orange-500 to-orange-700"}
        />
        <KpiCard
          label="ХОЛБОГДООГҮЙ"
          value={`${unlinkedCount}`}
          sub="Данс оноогдоогүй"
          icon={<Link2Off className="w-5 h-5" />}
          gradient="from-orange-500 to-orange-700"
        />
      </div>

      {/* Filters */}
      <form method="GET" className="bg-white border border-slate-200 rounded p-3 space-y-2 text-sm print:hidden">
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="w-4 h-4 text-slate-400" />
          {/* Partner search */}
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              name="partner"
              defaultValue={partnerQ}
              placeholder="Харилцагч нэрээр хайх…"
              maxLength={100}
              className="pl-6 pr-2 py-1.5 border border-slate-300 rounded text-xs w-[200px]"
            />
          </div>
          <input type="date" name="date_from" defaultValue={sp.date_from ?? ""} className="px-2 py-1.5 border border-slate-300 rounded text-xs" />
          <span className="text-xs text-slate-400">→</span>
          <input type="date" name="date_to" defaultValue={sp.date_to ?? ""} className="px-2 py-1.5 border border-slate-300 rounded text-xs" />
          <select name="bank" defaultValue={sp.bank ?? ""} className="px-2 py-1.5 border border-slate-300 rounded text-xs bg-white">
            <option value="">Бүх банк</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select name="direction" defaultValue={sp.direction ?? ""} className="px-2 py-1.5 border border-slate-300 rounded text-xs bg-white">
            <option value="">Бүгд</option>
            <option value="income">Орлого</option>
            <option value="expense">Зарлага</option>
          </select>
          <label className="inline-flex items-center gap-1 text-xs">
            <input type="checkbox" name="unlinked" value="1" defaultChecked={sp.unlinked === "1"} />
            <span>Журналд ороогүй</span>
          </label>
          <button type="submit" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs">Хайх</button>
          {hasFilter && (
            <Link href="/cash" className="px-3 py-1.5 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50">Цэвэрлэх</Link>
          )}
        </div>
        {/* Quick month buttons */}
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-xs text-slate-400">Хурдан:</span>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <Link
              key={m}
              href={monthHref(m)}
              className={`px-2 py-1 border border-slate-300 rounded text-xs hover:bg-slate-50 ${sp.month === `${thisYear}-${String(m).padStart(2, "0")}` ? "bg-slate-700 text-white" : ""}`}
            >
              {m}-р сар
            </Link>
          ))}
          <Link href={yearHref} className="px-2 py-1 border border-slate-300 rounded text-xs hover:bg-slate-50">
            Жилээр
          </Link>
          <span className="text-xs text-slate-500 ml-2">{txnCount} гүйлгээ · ✏ ДТ/КТ засахын тулд мөр дарна уу</span>
        </div>
      </form>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-2 py-2 text-left w-20">Огноо</th>
              <th className="px-2 py-2 text-left w-24">Банк</th>
              <th className="px-2 py-2 text-left w-16">Чиглэл</th>
              <th className="px-2 py-2 text-right w-28">Дүн</th>
              <th className="px-2 py-2 text-left">Тайлбар / Партнер</th>
              <th className="px-2 py-2 text-left min-w-[200px]">Контр данс</th>
              <th className="px-2 py-2 text-center w-16">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const bank = Array.isArray(r.bank) ? r.bank[0] : r.bank;
              const contra = Array.isArray(r.contra_account) ? r.contra_account[0] : r.contra_account;
              const partner = Array.isArray(r.partner) ? r.partner[0] : r.partner;
              return (
                <CashRow
                  key={r.id}
                  row={{
                    id: r.id,
                    txn_date: r.txn_date,
                    direction: r.direction as "income" | "expense",
                    amount: Number(r.amount || 0),
                    description: r.description ?? "",
                    partner_name: r.partner_name ?? "",
                    partner_id: r.partner_id ?? "",
                    partner_label: partner?.name ?? "",
                    category: r.category ?? "",
                    contra_account_id: r.contra_account_id ?? "",
                    contra_label: contra ? `${contra.code} ${contra.name}` : "",
                    journal_id: r.journal_id,
                    bank_name: bank?.name ?? "",
                  }}
                />
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs text-slate-400">
                  Гүйлгээ олдсонгүй
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={pageNum}
        totalPages={totalPages}
        basePath="/cash"
        search={{
          bank: sp.bank,
          direction: sp.direction,
          month: sp.month,
          date_from: sp.date_from,
          date_to: sp.date_to,
          partner: partnerQ || undefined,
          unlinked: sp.unlinked,
        }}
      />

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { background: white; }
          table { font-size: 8pt !important; }
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
        <div className="text-xs opacity-90 uppercase tracking-wide font-semibold">{label}</div>
        {icon}
      </div>
      <div className="text-xl font-bold font-mono leading-tight">{value}</div>
      <div className="text-[0.7rem] opacity-80 mt-0.5">{sub}</div>
    </div>
  );
}

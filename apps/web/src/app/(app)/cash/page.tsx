import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Banknote, Filter, Zap, FileSpreadsheet } from "lucide-react";
import { fmtDate, fmtMoney } from "@/lib/format";
import { Pagination } from "@/components/ui/Pagination";
import { ToastFromURL } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { CashRow } from "./_components/CashRow";
import { AutoLinkButton } from "./_components/AutoLinkButton";

export const metadata = { title: "Банкны хуулга — Тумэн Accounting" };

const PAGE_SIZE = 100;

type SearchParams = Promise<{
  page?: string;
  bank?: string;
  direction?: string;
  month?: string;
  partner?: string;
  unlinked?: string;
}>;

export default async function CashPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const pageNum = Math.max(1, parseInt(sp.page || "1", 10));
  const offset = (pageNum - 1) * PAGE_SIZE;

  const supabase = await createClient();

  // Build query
  let q = supabase
    .from("cash_transactions")
    .select(
      "id, txn_date, direction, amount, description, partner_name, partner_id, category, contra_account_id, journal_id, is_reconciled, bank_account_id, partner:partners(id, name), contra_account:accounts!cash_transactions_contra_account_id_fkey(id, code, name), bank:bank_accounts(id, name, bank_name)",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("txn_date", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (sp.bank) q = q.eq("bank_account_id", sp.bank);
  if (sp.direction && ["income", "expense"].includes(sp.direction)) {
    q = q.eq("direction", sp.direction as "income" | "expense");
  }
  if (sp.month) {
    const [y, m] = sp.month.split("-").map(Number);
    if (y && m) {
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      q = q.gte("txn_date", start).lt("txn_date", end);
    }
  }
  if (sp.unlinked === "1") {
    q = q.is("journal_id", null);
  }

  const { data: rows, count } = await q;
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  // Fetch bank list for filter
  const { data: banks } = await supabase
    .from("bank_accounts")
    .select("id, name, bank_name")
    .is("deleted_at", null)
    .order("name");

  // Totals
  const totals = (rows ?? []).reduce(
    (acc, r) => {
      if (r.direction === "income") acc.income += Number(r.amount || 0);
      else acc.expense += Number(r.amount || 0);
      return acc;
    },
    { income: 0, expense: 0 },
  );

  return (
    <div className="space-y-4">
      <ToastFromURL />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Banknote className="w-6 h-6" /> Банкны хуулга
          </h1>
          <p className="text-sm text-slate-500">{count ?? 0} гүйлгээ · Орлого: <span className="font-mono">{fmtMoney(totals.income)}</span> · Зарлага: <span className="font-mono">{fmtMoney(totals.expense)}</span></p>
        </div>
        <div className="flex gap-2">
          <AutoLinkButton />
          <Link
            href="/cash/batch-journal"
            className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded text-sm font-medium flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" /> Сарын батч
          </Link>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="bg-white border border-slate-200 rounded p-3 flex flex-wrap gap-2 items-center text-sm">
        <Filter className="w-4 h-4 text-slate-400" />
        <select name="bank" defaultValue={sp.bank ?? ""} className="px-2 py-1.5 border border-slate-300 rounded text-xs bg-white">
          <option value="">Бүх банк</option>
          {(banks ?? []).map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select name="direction" defaultValue={sp.direction ?? ""} className="px-2 py-1.5 border border-slate-300 rounded text-xs bg-white">
          <option value="">Бүгд</option>
          <option value="income">Орлого</option>
          <option value="expense">Зарлага</option>
        </select>
        <input
          type="month"
          name="month"
          defaultValue={sp.month ?? ""}
          className="px-2 py-1.5 border border-slate-300 rounded text-xs"
        />
        <label className="inline-flex items-center gap-1 text-xs">
          <input type="checkbox" name="unlinked" value="1" defaultChecked={sp.unlinked === "1"} />
          <span>Журналд ороогүй</span>
        </label>
        <button type="submit" className="px-3 py-1.5 bg-slate-700 text-white rounded text-xs">Шүүх</button>
        {(sp.bank || sp.direction || sp.month || sp.unlinked) && (
          <Link href="/cash" className="px-3 py-1.5 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50">Цэвэрлэх</Link>
        )}
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
            {(rows ?? []).map((r) => {
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
            {(rows?.length ?? 0) === 0 && (
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
          unlinked: sp.unlinked,
        }}
      />
    </div>
  );
}

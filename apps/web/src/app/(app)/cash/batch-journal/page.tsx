import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { fmtMoney, fmtYearMonth } from "@/lib/format";
import { ToastFromURL } from "@/components/ui/Toast";
import { BatchJournalButton } from "./BatchJournalButton";

export const metadata = { title: "Сарын батч журнал — Тумэн Accounting" };

export default async function BatchJournalPage() {
  const supabase = await createClient();

  // Get all months that have unbatched cash txns
  const { data: rows } = await supabase
    .from("cash_transactions")
    .select("txn_date, direction, amount, contra_account_id, journal_id")
    .is("deleted_at", null)
    .order("txn_date", { ascending: false });

  // Group by year+month
  type Bucket = {
    year: number;
    month: number;
    incomeTotal: number;
    expenseTotal: number;
    incomeCount: number;
    expenseCount: number;
    readyCount: number;
    pendingCount: number;
    alreadyBatched: number;
  };
  const buckets = new Map<string, Bucket>();
  for (const r of rows ?? []) {
    const d = new Date(r.txn_date);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const key = `${y}-${m}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        year: y, month: m,
        incomeTotal: 0, expenseTotal: 0,
        incomeCount: 0, expenseCount: 0,
        readyCount: 0, pendingCount: 0, alreadyBatched: 0,
      });
    }
    const b = buckets.get(key)!;
    const amt = Number(r.amount || 0);
    if (r.direction === "income") {
      b.incomeTotal += amt;
      b.incomeCount += 1;
    } else {
      b.expenseTotal += amt;
      b.expenseCount += 1;
    }
    if (r.journal_id) b.alreadyBatched += 1;
    else if (r.contra_account_id) b.readyCount += 1;
    else b.pendingCount += 1;
  }

  const sorted = Array.from(buckets.values()).sort((a, b) =>
    b.year !== a.year ? b.year - a.year : b.month - a.month,
  );

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <ToastFromURL />

      <Link href="/cash" className="text-xs text-slate-500 hover:underline flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Банкны хуулга
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6" /> Сарын батч журнал
        </h1>
        <p className="text-sm text-slate-500">
          Сар бүрд бэлэн болсон cash txn-уудаас 1 нийлбэр журнал үүсгэх.
          Контр данс тогтоогдсон зөвхөн мөрүүд оруулагдана.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Сар</th>
              <th className="px-4 py-2 text-right">Орлого</th>
              <th className="px-4 py-2 text-right">Зарлага</th>
              <th className="px-4 py-2 text-center">Бэлэн</th>
              <th className="px-4 py-2 text-center">Дутуу</th>
              <th className="px-4 py-2 text-center">Батчилсан</th>
              <th className="px-4 py-2 text-right w-40">Үйлдэл</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((b) => (
              <tr key={`${b.year}-${b.month}`} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-medium">{fmtYearMonth(b.year, b.month)}</td>
                <td className="px-4 py-2 text-right font-mono text-xs text-green-700">
                  {fmtMoney(b.incomeTotal)}
                  <div className="text-[0.6rem] text-slate-400">{b.incomeCount} тгэг</div>
                </td>
                <td className="px-4 py-2 text-right font-mono text-xs text-red-700">
                  {fmtMoney(b.expenseTotal)}
                  <div className="text-[0.6rem] text-slate-400">{b.expenseCount} тгэг</div>
                </td>
                <td className="px-4 py-2 text-center text-xs">
                  <span className="text-green-600 font-semibold">{b.readyCount}</span>
                </td>
                <td className="px-4 py-2 text-center text-xs">
                  <span className={b.pendingCount > 0 ? "text-orange-600 font-semibold" : "text-slate-400"}>
                    {b.pendingCount}
                  </span>
                </td>
                <td className="px-4 py-2 text-center text-xs">
                  <span className="text-blue-600">{b.alreadyBatched}</span>
                </td>
                <td className="px-4 py-2 text-right">
                  {b.readyCount > 0 && (
                    <BatchJournalButton year={b.year} month={b.month} readyCount={b.readyCount} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

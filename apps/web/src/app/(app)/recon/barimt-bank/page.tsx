import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Link2 } from "lucide-react";
import { fmtDate, fmtMoney, fmtYearMonth } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { ToastFromURL } from "@/components/ui/Toast";

export const metadata = { title: "Баримт тулгалт — Тумэн Accounting" };

type SearchParams = Promise<{ month?: string }>;

export default async function BarimtBankReconPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const supabase = await createClient();

  // VAT records + cash transactions for the period, grouped by partner
  const month = sp.month ?? new Date().toISOString().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

  const [vatResult, cashResult] = await Promise.all([
    supabase
      .from("vat_records")
      .select("id, direction, date, ddtd, total_amount, partner_id, partner_name, partner:partners(id, name)")
      .is("deleted_at", null)
      .gte("date", start)
      .lt("date", end)
      .order("partner_id"),
    supabase
      .from("cash_transactions")
      .select("id, direction, txn_date, amount, description, partner_id, partner_name, partner:partners(id, name)")
      .is("deleted_at", null)
      .gte("txn_date", start)
      .lt("txn_date", end),
  ]);

  // Group by partner
  type Bucket = {
    partner_id: string | null;
    partner_name: string;
    vat_in_total: number;
    vat_out_total: number;
    cash_in_total: number;
    cash_out_total: number;
    vat_rows: Array<typeof vatResult.data extends Array<infer R> ? R : never>;
    cash_rows: Array<typeof cashResult.data extends Array<infer R> ? R : never>;
  };

  const buckets = new Map<string, Bucket>();
  function ensureBucket(pid: string | null, name: string): Bucket {
    const key = pid ?? `_:${name}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        partner_id: pid,
        partner_name: name,
        vat_in_total: 0,
        vat_out_total: 0,
        cash_in_total: 0,
        cash_out_total: 0,
        vat_rows: [],
        cash_rows: [],
      });
    }
    return buckets.get(key)!;
  }

  for (const v of vatResult.data ?? []) {
    const p = Array.isArray(v.partner) ? v.partner[0] : v.partner;
    const b = ensureBucket(p?.id ?? null, p?.name ?? v.partner_name ?? "(тулгаагүй)");
    if (v.direction === "outbound") b.vat_out_total += Number(v.total_amount || 0);
    else b.vat_in_total += Number(v.total_amount || 0);
    // @ts-expect-error narrow shape
    b.vat_rows.push(v);
  }
  for (const c of cashResult.data ?? []) {
    const p = Array.isArray(c.partner) ? c.partner[0] : c.partner;
    if (!p?.id && !c.partner_name) continue;
    const b = ensureBucket(p?.id ?? null, p?.name ?? c.partner_name ?? "(тулгаагүй)");
    if (c.direction === "income") b.cash_in_total += Number(c.amount || 0);
    else b.cash_out_total += Number(c.amount || 0);
    // @ts-expect-error narrow shape
    b.cash_rows.push(c);
  }

  const sorted = Array.from(buckets.values()).sort((a, b) =>
    Math.max(b.vat_in_total + b.vat_out_total, b.cash_in_total + b.cash_out_total) -
    Math.max(a.vat_in_total + a.vat_out_total, a.cash_in_total + a.cash_out_total),
  );

  return (
    <div className="space-y-4">
      <ToastFromURL />

      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <Link2 className="w-6 h-6" /> Баримт ↔ Банк тулгалт
        </h1>
        <p className="text-sm text-slate-500">{fmtYearMonth(y, m)} — Партнер тус бүрийн eBarimt vs Банкны гүйлгээ</p>
      </div>

      <form method="GET" className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Сар:</span>
        <input type="month" name="month" defaultValue={month} className="px-2 py-1.5 border border-slate-300 rounded text-xs" />
        <button className="px-3 py-1.5 bg-slate-700 text-white rounded text-xs">Үзэх</button>
      </form>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Харилцагч</th>
              <th className="px-3 py-2 text-right">eBarimt out</th>
              <th className="px-3 py-2 text-right">Касс орлого</th>
              <th className="px-3 py-2 text-right">Зөрүү</th>
              <th className="px-3 py-2 text-right">eBarimt in</th>
              <th className="px-3 py-2 text-right">Касс зарлага</th>
              <th className="px-3 py-2 text-right">Зөрүү</th>
              <th className="px-3 py-2 text-center w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((b) => {
              const outDiff = b.vat_out_total - b.cash_in_total;
              const inDiff = b.vat_in_total - b.cash_out_total;
              return (
                <tr key={b.partner_id ?? b.partner_name} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-xs">
                    {b.partner_id ? (
                      <Link href={`/partners/${b.partner_id}`} className="text-blue-600 hover:underline font-medium">{b.partner_name}</Link>
                    ) : (
                      <span className="text-slate-400 italic">{b.partner_name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-right text-xs text-green-700">{b.vat_out_total ? fmtMoney(b.vat_out_total) : "—"}</td>
                  <td className="px-3 py-2 font-mono text-right text-xs text-blue-600">{b.cash_in_total ? fmtMoney(b.cash_in_total) : "—"}</td>
                  <td className={`px-3 py-2 font-mono text-right text-xs ${Math.abs(outDiff) < 0.01 ? "text-green-600" : "text-red-600"}`}>
                    {outDiff === 0 ? "✓" : fmtMoney(Math.abs(outDiff))}
                  </td>
                  <td className="px-3 py-2 font-mono text-right text-xs text-purple-700">{b.vat_in_total ? fmtMoney(b.vat_in_total) : "—"}</td>
                  <td className="px-3 py-2 font-mono text-right text-xs text-red-600">{b.cash_out_total ? fmtMoney(b.cash_out_total) : "—"}</td>
                  <td className={`px-3 py-2 font-mono text-right text-xs ${Math.abs(inDiff) < 0.01 ? "text-green-600" : "text-red-600"}`}>
                    {inDiff === 0 ? "✓" : fmtMoney(Math.abs(inDiff))}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {Math.abs(outDiff) < 0.01 && Math.abs(inDiff) < 0.01 ? (
                      <Badge color="bg-green-100 text-green-700">OK</Badge>
                    ) : (
                      <Badge color="bg-yellow-100 text-yellow-800">Зөрөө</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-xs text-slate-400">Данс олдсонгүй</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

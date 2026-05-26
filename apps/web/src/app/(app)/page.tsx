import { createClient } from "@/lib/supabase/server";
import { FileText, Users, Receipt, BookOpen, ArrowRight } from "lucide-react";
import Link from "next/link";

function fmt(n: number | null | undefined) {
  return new Intl.NumberFormat("mn-MN").format(n ?? 0);
}
function fmtMoney(n: number | null | undefined) {
  return new Intl.NumberFormat("mn-MN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0);
}

export default async function Dashboard() {
  const supabase = await createClient();

  const [
    journalsCount, partnersCount, vatCount, accountsCount,
    recentJournals, tb,
  ] = await Promise.all([
    supabase.from("journals").select("*", { count: "exact", head: true }),
    supabase.from("partners").select("*", { count: "exact", head: true }),
    supabase.from("vat_records").select("*", { count: "exact", head: true }),
    supabase.from("accounts").select("*", { count: "exact", head: true }),
    supabase.from("journals")
      .select("id, number, date, description, status, total_debit")
      .order("date", { ascending: false }).limit(8),
    supabase.from("v_trial_balance")
      .select("debit_balance, credit_balance"),
  ]);

  const tbDebit  = (tb.data ?? []).reduce((s, r) => s + Number(r.debit_balance ?? 0), 0);
  const tbCredit = (tb.data ?? []).reduce((s, r) => s + Number(r.credit_balance ?? 0), 0);

  const cards = [
    { href: "/journals",     label: "Журналууд",        n: journalsCount.count,  icon: FileText, color: "bg-blue-50 text-blue-600" },
    { href: "/accounts",     label: "Дансны төл.",      n: accountsCount.count,  icon: BookOpen, color: "bg-purple-50 text-purple-600" },
    { href: "/partners",     label: "Харилцагчид",      n: partnersCount.count,  icon: Users,    color: "bg-green-50 text-green-600" },
    { href: "/vat",          label: "НӨАТ бичлэг",      n: vatCount.count,       icon: Receipt,  color: "bg-orange-50 text-orange-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Хяналтын самбар</h1>
        <p className="text-sm text-slate-500">Системийн ерөнхий мэдээлэл</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.href} href={c.href}
                className="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md transition group">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded ${c.color}`}>
                <c.icon className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{fmt(c.n)}</div>
            <div className="text-xs text-slate-500 mt-1">{c.label}</div>
          </Link>
        ))}
      </div>

      {/* Trial balance summary */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Шалгах балансын товч</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-slate-500">Нийт дебит</div>
            <div className="text-lg font-mono font-semibold text-slate-900 mt-1">
              ₮{fmtMoney(tbDebit)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Нийт кредит</div>
            <div className="text-lg font-mono font-semibold text-slate-900 mt-1">
              ₮{fmtMoney(tbCredit)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Зөрүү</div>
            <div className={`text-lg font-mono font-semibold mt-1 ${
              Math.abs(tbDebit - tbCredit) < 0.01 ? "text-green-600" : "text-red-600"
            }`}>
              ₮{fmtMoney(tbDebit - tbCredit)}
              {Math.abs(tbDebit - tbCredit) < 0.01 && " ✓"}
            </div>
          </div>
        </div>
      </div>

      {/* Recent journals */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Сүүлийн журналууд</h2>
          <Link href="/journals" className="text-xs text-blue-600 hover:underline">
            Бүгдийг харах →
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-2 text-left">Дугаар</th>
              <th className="px-5 py-2 text-left">Огноо</th>
              <th className="px-5 py-2 text-left">Тайлбар</th>
              <th className="px-5 py-2 text-right">Дүн (₮)</th>
              <th className="px-5 py-2 text-center">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(recentJournals.data ?? []).map((j) => (
              <tr key={j.id} className="hover:bg-slate-50">
                <td className="px-5 py-2 font-mono text-xs">{j.number}</td>
                <td className="px-5 py-2 text-xs text-slate-600">{j.date}</td>
                <td className="px-5 py-2 truncate max-w-xs">{j.description || "—"}</td>
                <td className="px-5 py-2 font-mono text-right">{fmtMoney(Number(j.total_debit))}</td>
                <td className="px-5 py-2 text-center">
                  <span className={`inline-block px-2 py-0.5 text-[0.65rem] uppercase rounded font-semibold ${
                    j.status === "posted" ? "bg-green-100 text-green-700"
                    : j.status === "draft" ? "bg-slate-200 text-slate-700"
                    : "bg-red-100 text-red-700"
                  }`}>{j.status}</span>
                </td>
              </tr>
            ))}
            {(recentJournals.data?.length ?? 0) === 0 && (
              <tr><td colSpan={5} className="px-5 py-6 text-center text-slate-400 text-xs">
                Журнал байхгүй
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

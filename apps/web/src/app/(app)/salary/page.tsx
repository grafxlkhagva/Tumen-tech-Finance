import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Coins, Users } from "lucide-react";
import { fmtMoney, fmtYearMonth } from "@/lib/format";
import { ToastFromURL } from "@/components/ui/Toast";
import { SalaryGrid } from "./SalaryGrid";

export const metadata = { title: "Цалингийн бүртгэл — Тумэн Accounting" };

type SearchParams = Promise<{ month?: string }>;

export default async function SalaryPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const month = sp.month ?? new Date().toISOString().slice(0, 7);
  const [y, m] = month.split("-").map(Number);

  const supabase = await createClient();
  const [employeesRes, recordsRes] = await Promise.all([
    supabase
      .from("employees")
      .select("id, first_name, last_name, full_name, title, base_salary, phone_allowance")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("full_name"),
    supabase
      .from("salary_records")
      .select("*")
      .eq("year", y)
      .eq("month", m),
  ]);

  return (
    <div className="space-y-4">
      <ToastFromURL />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Coins className="w-6 h-6" /> Цалингийн бүртгэл — {fmtYearMonth(y, m)}
          </h1>
          <p className="text-sm text-slate-500">{(employeesRes.data ?? []).length} ажилтан</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/salary/employees"
            className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 rounded text-sm flex items-center gap-2"
          >
            <Users className="w-4 h-4" /> Ажилтнууд
          </Link>
        </div>
      </div>

      <form method="GET" className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Сар:</span>
        <input type="month" name="month" defaultValue={month} className="px-2 py-1.5 border border-slate-300 rounded text-xs" />
        <button className="px-3 py-1.5 bg-slate-700 text-white rounded text-xs">Үзэх</button>
      </form>

      <SalaryGrid
        year={y}
        month={m}
        employees={employeesRes.data ?? []}
        records={recordsRes.data ?? []}
      />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/supabase/company";
import Link from "next/link";
import { Coins, Users } from "lucide-react";
import { ToastFromURL } from "@/components/ui/Toast";
import { PrintButton } from "@/components/ui/PrintButton";
import { MONTH_HOURS } from "@/lib/payroll/calc";
import { SalaryGrid } from "./SalaryGrid";

export const metadata = { title: "Цалингийн бүртгэл — Тумэн Accounting" };

type SearchParams = Promise<{ month?: string; year?: string }>;

const MN_MONTHS: Record<number, string> = {
  1: "Нэгдүгээр", 2: "Хоёрдугаар", 3: "Гуравдугаар", 4: "Дөрөвдүгээр",
  5: "Тавдугаар", 6: "Зургаадугаар", 7: "Долдугаар", 8: "Наймдугаар",
  9: "Есдүгээр", 10: "Аравдугаар", 11: "Арван нэгдүгээр", 12: "Арван хоёрдугаар",
};

export default async function SalaryPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const now = new Date();
  // Support both legacy ?month=06&year=2026 and combined ?month=2026-06
  let y = now.getFullYear();
  let m = now.getMonth() + 1;
  if (sp.month && /^\d{4}-\d{2}$/.test(sp.month)) {
    [y, m] = sp.month.split("-").map(Number);
  } else {
    const mNum = Number(sp.month);
    const yNum = Number(sp.year);
    if (mNum >= 1 && mNum <= 12) m = mNum;
    if (yNum > 2000 && yNum < 3000) y = yNum;
  }

  const supabase = await createClient();
  const company = await getCurrentCompany(supabase);

  if (!company) {
    return (
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-2xl font-semibold flex items-center gap-2 mb-4">
          <Coins className="w-6 h-6" /> Цалингийн бүртгэл
        </h1>
        <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-900">
          Байгууллага сонгогдоогүй байна.
        </div>
      </div>
    );
  }

  const [employeesRes, recordsRes] = await Promise.all([
    supabase
      .from("employees")
      .select("id, first_name, last_name, full_name, title, base_salary, phone_allowance, adv_base")
      .eq("company_id", company.companyId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("base_salary", { ascending: false }),
    supabase
      .from("salary_records")
      .select("*")
      .eq("company_id", company.companyId)
      .eq("year", y)
      .eq("month", m),
  ]);

  const employees = employeesRes.data ?? [];
  const records = recordsRes.data ?? [];
  const totalHours = MONTH_HOURS[m] ?? 176;

  return (
    <div className="space-y-3 max-w-[1700px] mx-auto">
      <ToastFromURL />

      {/* Title bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <Coins className="w-6 h-6" /> Цалингийн бүртгэл
          <span className="text-base text-slate-500 font-normal">
            — &quot;{company.meta?.name ?? "—"}&quot; ХХК
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/salary/employees"
            className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-xs flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5" /> Ажилтнууд
          </Link>
          <PrintButton />
        </div>
      </div>

      {/* Month/year selector + total-hours hint */}
      <div className="flex items-center gap-2 flex-wrap print:hidden">
        <form method="GET" className="flex items-center gap-2">
          <select
            name="month"
            defaultValue={String(m)}
            className="px-2 py-1.5 border border-slate-300 rounded text-xs w-[180px]"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((mm) => (
              <option key={mm} value={mm}>
                {String(mm).padStart(2, "0")} — {MN_MONTHS[mm]} сар
              </option>
            ))}
          </select>
          <select
            name="year"
            defaultValue={String(y)}
            className="px-2 py-1.5 border border-slate-300 rounded text-xs w-[90px]"
          >
            {[2024, 2025, 2026, 2027].map((yy) => (
              <option key={yy} value={yy}>{yy}</option>
            ))}
          </select>
          <button type="submit" className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs">
            Үзэх
          </button>
        </form>
        <span className="text-xs text-slate-500">
          Сарын ажлын цаг: <b className="text-slate-700">{totalHours}ц</b>
        </span>
      </div>

      <SalaryGrid
        year={y}
        month={m}
        totalHours={totalHours}
        employees={employees}
        records={records}
      />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/format";
import { ToastFromURL } from "@/components/ui/Toast";

export const metadata = { title: "Ажилтнууд — Тумэн Accounting" };

export default async function EmployeesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select("id, full_name, tin, title, department, base_salary, hire_date, is_active")
    .is("deleted_at", null)
    .order("full_name");

  return (
    <div className="space-y-4">
      <ToastFromURL />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6" /> Ажилтнууд
          </h1>
          <p className="text-sm text-slate-500">Нийт {data?.length ?? 0} ажилтан</p>
        </div>
        <Link href="/salary/employees/new" className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Шинэ ажилтан
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Нэр</th>
              <th className="px-3 py-2 text-left">ТТД</th>
              <th className="px-3 py-2 text-left">Албан тушаал</th>
              <th className="px-3 py-2 text-right">Гэрээт цалин</th>
              <th className="px-3 py-2 text-left">Ажилласан</th>
              <th className="px-3 py-2 text-center">Идэвхтэй</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(data ?? []).map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-xs">
                  <Link href={`/salary/employees/${e.id}/edit`} className="text-blue-600 hover:underline font-medium">{e.full_name}</Link>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{e.tin ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{e.title ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-right text-xs">{fmtMoney(e.base_salary)}</td>
                <td className="px-3 py-2 text-xs">{fmtDate(e.hire_date)}</td>
                <td className="px-3 py-2 text-center text-xs">{e.is_active ? "✓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { BookOpen } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  asset: "Хөрөнгө", liability: "Өр төлбөр", equity: "Эзний өмч",
  income: "Орлого",  expense: "Зардал",
};
const TYPE_COLOR: Record<string, string> = {
  asset: "bg-blue-100 text-blue-700", liability: "bg-orange-100 text-orange-700",
  equity: "bg-purple-100 text-purple-700", income: "bg-green-100 text-green-700",
  expense: "bg-red-100 text-red-700",
};

export default async function AccountsPage() {
  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name, type, parent_id, is_postable, is_active")
    .is("deleted_at", null)
    .order("code");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-6 h-6" /> Дансны төлөвлөгөө
        </h1>
        <p className="text-sm text-slate-500">Нийт {accounts?.length ?? 0} данс</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Код</th>
              <th className="px-4 py-2 text-left">Нэр</th>
              <th className="px-4 py-2 text-left">Төрөл</th>
              <th className="px-4 py-2 text-center">Postable</th>
              <th className="px-4 py-2 text-center">Идэвхтэй</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(accounts ?? []).map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-xs font-semibold text-slate-700">{a.code}</td>
                <td className="px-4 py-2">{a.name}</td>
                <td className="px-4 py-2">
                  <span className={`inline-block px-2 py-0.5 text-[0.65rem] rounded font-semibold ${TYPE_COLOR[a.type] ?? "bg-slate-100"}`}>
                    {TYPE_LABEL[a.type] ?? a.type}
                  </span>
                </td>
                <td className="px-4 py-2 text-center text-xs">
                  {a.is_postable ? "✓" : "—"}
                </td>
                <td className="px-4 py-2 text-center text-xs">
                  {a.is_active ? "✓" : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

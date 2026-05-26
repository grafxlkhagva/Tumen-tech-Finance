import { createClient } from "@/lib/supabase/server";
import { Users } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  customer: "Захиалагч", supplier: "Нийлүүлэгч", both: "Холимог",
  employee: "Ажилтан",   other: "Бусад",
};

export default async function PartnersPage() {
  const supabase = await createClient();
  const { data: partners, count } = await supabase
    .from("partners")
    .select("id, code, name, register, type, phone, email, is_active", { count: "exact" })
    .is("deleted_at", null)
    .order("name")
    .limit(200);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <Users className="w-6 h-6" /> Харилцагчид
        </h1>
        <p className="text-sm text-slate-500">Нийт {count ?? 0} харилцагч (эхний 200)</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Код</th>
              <th className="px-4 py-2 text-left">Нэр</th>
              <th className="px-4 py-2 text-left">Регистр</th>
              <th className="px-4 py-2 text-left">Төрөл</th>
              <th className="px-4 py-2 text-left">Утас</th>
              <th className="px-4 py-2 text-center">Идэвхтэй</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(partners ?? []).map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-xs">{p.code ?? "—"}</td>
                <td className="px-4 py-2 font-medium">{p.name}</td>
                <td className="px-4 py-2 font-mono text-xs text-slate-600">{p.register ?? "—"}</td>
                <td className="px-4 py-2 text-xs">{TYPE_LABEL[p.type] ?? p.type}</td>
                <td className="px-4 py-2 text-xs">{p.phone ?? "—"}</td>
                <td className="px-4 py-2 text-center text-xs">{p.is_active ? "✓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

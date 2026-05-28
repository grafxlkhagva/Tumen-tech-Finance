import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Users, Plus, Pencil } from "lucide-react";
import { PARTNER_TYPE, type PartnerType } from "@/lib/i18n/labels";
import { ToastFromURL } from "@/components/ui/Toast";

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
      <ToastFromURL />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6" /> Харилцагчид
          </h1>
          <p className="text-sm text-slate-500">Нийт {count ?? 0} харилцагч (эхний 200)</p>
        </div>
        <Link
          href="/partners/new"
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Шинэ харилцагч
        </Link>
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
              <th className="px-4 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(partners ?? []).map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 group">
                <td className="px-4 py-2 font-mono text-xs">{p.code ?? "—"}</td>
                <td className="px-4 py-2 font-medium">
                  <Link href={`/partners/${p.id}`} className="hover:underline text-slate-900">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-slate-600">{p.register ?? "—"}</td>
                <td className="px-4 py-2 text-xs">{PARTNER_TYPE[p.type as PartnerType] ?? p.type}</td>
                <td className="px-4 py-2 text-xs">{p.phone ?? "—"}</td>
                <td className="px-4 py-2 text-center text-xs">{p.is_active ? "✓" : "—"}</td>
                <td className="px-4 py-2">
                  <Link
                    href={`/partners/${p.id}/edit`}
                    className="invisible group-hover:visible text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 text-xs"
                  >
                    <Pencil className="w-3 h-3" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

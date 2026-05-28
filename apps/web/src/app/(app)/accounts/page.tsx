import { createClient } from "@/lib/supabase/server";
import { BookOpen, Plus, Pencil } from "lucide-react";
import Link from "next/link";
import { ACCOUNT_TYPE, ACCOUNT_TYPE_COLOR, type AccountType } from "@/lib/i18n/labels";
import { Badge } from "@/components/ui/Badge";
import { ToastFromURL } from "@/components/ui/Toast";

export const metadata = { title: "Дансны жагсаалт — Тумэн Accounting" };

export default async function AccountsPage() {
  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name, type, parent_id, is_postable, is_active")
    .is("deleted_at", null)
    .order("code");

  return (
    <div className="space-y-4">
      <ToastFromURL />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6" /> Дансны жагсаалт
          </h1>
          <p className="text-sm text-slate-500">Нийт {accounts?.length ?? 0} данс</p>
        </div>
        <Link
          href="/accounts/new"
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Шинэ данс
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Код</th>
              <th className="px-4 py-2 text-left">Нэр</th>
              <th className="px-4 py-2 text-left">Төрөл</th>
              <th className="px-4 py-2 text-center">Бичигдэх</th>
              <th className="px-4 py-2 text-center">Идэвхтэй</th>
              <th className="px-4 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(accounts ?? []).map((a) => (
              <tr key={a.id} className="hover:bg-slate-50 group">
                <td className="px-4 py-2 font-mono text-xs font-semibold text-slate-700">{a.code}</td>
                <td className="px-4 py-2">{a.name}</td>
                <td className="px-4 py-2">
                  <Badge color={ACCOUNT_TYPE_COLOR[a.type as AccountType]}>
                    {ACCOUNT_TYPE[a.type as AccountType]}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-center text-xs">{a.is_postable ? "✓" : "—"}</td>
                <td className="px-4 py-2 text-center text-xs">{a.is_active ? "✓" : "—"}</td>
                <td className="px-4 py-2">
                  <Link
                    href={`/accounts/${a.id}/edit`}
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

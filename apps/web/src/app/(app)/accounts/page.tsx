import { createClient } from "@/lib/supabase/server";
import { BookOpen, Plus } from "lucide-react";
import Link from "next/link";
import { ToastFromURL } from "@/components/ui/Toast";
import { AccountsTable, type AccountRow } from "./AccountsTable";

export const metadata = { title: "Дансны жагсаалт — Тумэн Accounting" };

export default async function AccountsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounts")
    .select("id, code, name, type, parent_id")
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("code");

  const accounts = data ?? [];
  // Resolve parent names from the same fetch (no extra round-trip).
  const nameById = new Map(accounts.map((a) => [a.id, a.name]));
  const rows: AccountRow[] = accounts.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    type: a.type,
    parent_id: a.parent_id,
    parent_name: a.parent_id ? (nameById.get(a.parent_id) ?? null) : null,
  }));

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      <ToastFromURL />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-6 h-6" /> Дансны жагсаалт
        </h1>
        <Link
          href="/accounts/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Данс нэмэх
        </Link>
      </div>

      <AccountsTable rows={rows} />
    </div>
  );
}

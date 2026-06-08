import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/company";
import { Shield } from "lucide-react";
import { ToastFromURL } from "@/components/ui/Toast";
import { UsersTable, type UserRow } from "./UsersTable";

export const metadata = { title: "Хэрэглэгчид — Тумэн Accounting" };

export default async function AdminUsersPage() {
  const { companyId } = await requireAdmin();

  // Company role map (RLS-scoped normal client)
  const supabase = await createClient();
  const { data: ucs } = await supabase
    .from("user_companies")
    .select("user_id, role, is_default")
    .eq("company_id", companyId);
  const roleByUser = new Map(
    (ucs ?? []).map((u) => [u.user_id, { role: u.role as string, isDefault: !!u.is_default }]),
  );

  // Auth users (service role — emails + sign-in metadata)
  const admin = createAdminClient();
  const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 1000 });

  const rows: UserRow[] = (list?.users ?? [])
    .filter((u) => roleByUser.has(u.id)) // only users belonging to this company
    .map((u) => ({
      id: u.id,
      email: u.email ?? "—",
      role: roleByUser.get(u.id)?.role ?? "viewer",
      isDefault: roleByUser.get(u.id)?.isDefault ?? false,
      confirmed: !!u.email_confirmed_at,
      lastSignIn: u.last_sign_in_at ?? null,
      createdAt: u.created_at ?? null,
    }))
    .sort((a, b) => a.email.localeCompare(b.email));

  return (
    <div className="space-y-4 max-w-[1100px] mx-auto">
      <ToastFromURL />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <Shield className="w-6 h-6" /> Хэрэглэгчид
        </h1>
        <span className="text-sm text-slate-500">{rows.length} хэрэглэгч</span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
          Хэрэглэгчдийг татаж чадсангүй: {error.message}
        </div>
      )}

      <p className="text-xs text-slate-500">
        Зөвхөн админ хандах боломжтой. Хэрэглэгчид нууц үгээ мартсан үед энд сэргээх имэйл
        илгээх эсвэл түр нууц үг шууд тохируулж болно.
      </p>

      <UsersTable rows={rows} />
    </div>
  );
}

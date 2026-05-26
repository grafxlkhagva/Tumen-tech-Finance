import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./ProfileForm";
import { User } from "lucide-react";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: uc } = user ? await supabase
    .from("user_companies")
    .select("role, companies(name)")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle() : { data: null };

  const company = uc?.companies && (Array.isArray(uc.companies) ? uc.companies[0] : uc.companies);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-2xl font-bold">
          {user?.email?.[0]?.toUpperCase() ?? "U"}
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <User className="w-6 h-6" /> Хувийн профайл
          </h1>
          <p className="text-sm text-slate-500">{user?.email}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-5">
        <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-100 pb-2">
          Хэрэглэгчийн мэдээлэл
        </h2>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="text-slate-500">И-мэйл</div>
          <div className="col-span-2">{user?.email}</div>

          <div className="text-slate-500">Үүрэг</div>
          <div className="col-span-2">
            <span className="inline-block px-2 py-0.5 text-xs uppercase rounded font-semibold bg-red-100 text-red-700">
              {uc?.role ?? "viewer"}
            </span>
          </div>

          <div className="text-slate-500">Компани</div>
          <div className="col-span-2">{company?.name ?? "—"}</div>

          <div className="text-slate-500">Хэрэглэгчийн ID</div>
          <div className="col-span-2 font-mono text-xs text-slate-600">{user?.id}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-100 pb-2 mb-4">
          Нууц үг солих
        </h2>
        <ProfileForm />
      </div>
    </div>
  );
}

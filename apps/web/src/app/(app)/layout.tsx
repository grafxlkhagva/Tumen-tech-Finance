import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Resolve company + role + company name
  const { data: uc } = await supabase
    .from("user_companies")
    .select("company_id, role, companies(name)")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!uc) {
    redirect("/login?error=no-company");
  }

  const company = Array.isArray(uc.companies) ? uc.companies[0] : uc.companies;

  return (
    <AppShell
      user={{ email: user.email!, id: user.id }}
      role={uc.role}
      companyName={company?.name ?? "Тумэн"}
    >
      {children}
    </AppShell>
  );
}

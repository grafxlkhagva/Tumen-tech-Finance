import { createClient } from "@/lib/supabase/server";
import { AccountForm } from "../../_components/AccountForm";
import { updateAccount } from "../../actions";
import { notFound } from "next/navigation";

export const metadata = { title: "Данс засах — Тумэн Accounting" };

type RouteParams = Promise<{ id: string }>;

export default async function EditAccountPage({
  params,
}: {
  params: RouteParams;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [accountResult, parentsResult] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, code, name, name_en, type, parent_id, is_postable, is_active, currency, notes")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("accounts")
      .select("id, code, name")
      .is("deleted_at", null)
      .neq("id", id)
      .order("code"),
  ]);

  if (!accountResult.data) notFound();

  return (
    <AccountForm
      mode="edit"
      initialData={accountResult.data}
      parentOptions={parentsResult.data ?? []}
      action={updateAccount.bind(null, id)}
    />
  );
}

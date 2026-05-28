import { createClient } from "@/lib/supabase/server";
import { AccountForm } from "../_components/AccountForm";
import { createAccount } from "../actions";

export const metadata = { title: "Шинэ данс — Тумэн Accounting" };

export default async function NewAccountPage() {
  const supabase = await createClient();
  const { data: parents } = await supabase
    .from("accounts")
    .select("id, code, name")
    .is("deleted_at", null)
    .order("code");

  return (
    <AccountForm
      mode="create"
      parentOptions={parents ?? []}
      action={createAccount}
    />
  );
}

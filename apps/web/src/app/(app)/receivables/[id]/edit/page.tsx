import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ReceivableForm } from "../../_components/ReceivableForm";
import { updateReceivable } from "../../actions";

export const metadata = { title: "Авлага засах — Тумэн Accounting" };

type RouteParams = Promise<{ id: string }>;

export default async function EditReceivablePage({
  params,
}: {
  params: RouteParams;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("receivables")
    .select("invoice_no, invoice_date, due_date, amount, vat_amount, description, responsible, status")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  return (
    <ReceivableForm
      mode="edit"
      initialData={data}
      action={updateReceivable.bind(null, id)}
    />
  );
}

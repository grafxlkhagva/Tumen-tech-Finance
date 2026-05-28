import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PartnerForm } from "../../_components/PartnerForm";
import { updatePartner } from "../../actions";

export const metadata = { title: "Харилцагч засах — Тумэн Accounting" };

type RouteParams = Promise<{ id: string }>;

export default async function EditPartnerPage({
  params,
}: {
  params: RouteParams;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("partners")
    .select("id, code, name, register, tin, type, phone, email, address, aliases, is_vat_payer, is_active, notes")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  // aliases is jsonb (string[]) from DB
  const aliases: string[] = Array.isArray(data.aliases)
    ? (data.aliases as string[])
    : [];

  return (
    <PartnerForm
      mode="edit"
      initialData={{ ...data, aliases }}
      action={updatePartner.bind(null, id)}
    />
  );
}

import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { JournalForm } from "../../_components/JournalForm";
import { updateJournal } from "../../actions";

export const metadata = { title: "Журнал засах — Тумэн Accounting" };

type RouteParams = Promise<{ id: string }>;

export default async function EditJournalPage({
  params,
}: {
  params: RouteParams;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [journalResult, linesResult] = await Promise.all([
    supabase
      .from("journals")
      .select("id, date, reference, description, status")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("journal_lines")
      .select("id, line_no, debit, credit, description, account_id, partner_id, account:accounts(code, name), partner:partners(name)")
      .eq("journal_id", id)
      .order("line_no"),
  ]);

  if (!journalResult.data) notFound();
  if (journalResult.data.status !== "draft") {
    redirect(`/journals/${id}?flash=${encodeURIComponent("Зөвхөн ноорог журналыг засна")}&type=error`);
  }

  const initialLines = (linesResult.data ?? []).map((l) => {
    const account = Array.isArray(l.account) ? l.account[0] : l.account;
    const partner = Array.isArray(l.partner) ? l.partner[0] : l.partner;
    return {
      uid: l.id,
      account_id: l.account_id ?? "",
      account_label: account ? `${account.code} ${account.name}` : "",
      partner_id: l.partner_id ?? "",
      partner_label: partner?.name ?? "",
      debit: String(l.debit ?? 0),
      credit: String(l.credit ?? 0),
      description: l.description ?? "",
    };
  });

  return (
    <JournalForm
      action={updateJournal.bind(null, id)}
      defaultDate={journalResult.data.date}
      defaultLines={initialLines}
    />
  );
}

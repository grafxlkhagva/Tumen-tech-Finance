import { JournalForm } from "../_components/JournalForm";
import { createJournal } from "../actions";

export const metadata = { title: "Шинэ гүйлгээ — Тумэн Accounting" };

export default function NewJournalPage() {
  return <JournalForm action={createJournal} />;
}

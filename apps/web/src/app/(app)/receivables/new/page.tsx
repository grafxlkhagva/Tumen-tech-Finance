import { ReceivableForm } from "../_components/ReceivableForm";
import { createReceivable } from "../actions";

export const metadata = { title: "Шинэ авлага — Тумэн Accounting" };

export default function NewReceivablePage() {
  return <ReceivableForm mode="create" action={createReceivable} />;
}

import { createVat } from "../actions";
import { VatForm } from "../_components/VatForm";

export const metadata = { title: "Шинэ НӨАТ — Тумэн Accounting" };

export default function NewVatPage() {
  return <VatForm action={createVat} />;
}

import { PartnerForm } from "../_components/PartnerForm";
import { createPartner } from "../actions";

export const metadata = { title: "Шинэ харилцагч — Тумэн Accounting" };

export default function NewPartnerPage() {
  return <PartnerForm mode="create" action={createPartner} />;
}

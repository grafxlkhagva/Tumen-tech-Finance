import { EmployeeForm } from "../_components/EmployeeForm";
import { upsertEmployee } from "../actions";

export const metadata = { title: "Шинэ ажилтан — Тумэн Accounting" };

export default function NewEmployeePage() {
  return <EmployeeForm mode="create" action={upsertEmployee.bind(null, null)} />;
}

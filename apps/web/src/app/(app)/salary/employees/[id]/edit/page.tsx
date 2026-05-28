import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { EmployeeForm } from "../../_components/EmployeeForm";
import { upsertEmployee } from "../../actions";

export const metadata = { title: "Ажилтан засах — Тумэн Accounting" };

type RouteParams = Promise<{ id: string }>;

export default async function EditEmployeePage({ params }: { params: RouteParams }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select("first_name, last_name, tin, phone, email, title, department, hire_date, base_salary, phone_allowance, bank_name, bank_account, is_active")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  return <EmployeeForm mode="edit" initialData={data} action={upsertEmployee.bind(null, id)} />;
}

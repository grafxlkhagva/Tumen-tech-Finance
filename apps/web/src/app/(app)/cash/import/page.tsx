import { FileUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/supabase/company";
import { ToastFromURL } from "@/components/ui/Toast";
import ImportForm from "./_components/ImportForm";

export const metadata = { title: "Дансны хуулга оруулагч — Тумэн Accounting" };

export default async function CashImportPage() {
  const supabase = await createClient();
  const company = await getCurrentCompany(supabase);

  let banks: { id: string; name: string }[] = [];
  if (company) {
    const { data } = await supabase
      .from("bank_accounts")
      .select("id, name, metadata")
      .eq("company_id", company.companyId)
      .is("deleted_at", null)
      .order("name");
    banks = (data ?? [])
      .filter((b) => (b.metadata as Record<string, unknown> | null)?.import_format)
      .map((b) => ({ id: b.id, name: b.name }));
  }

  return (
    <div className="max-w-4xl">
      <ToastFromURL />
      <div className="flex items-center gap-2 mb-4">
        <FileUp className="w-5 h-5 text-slate-700" />
        <h1 className="text-lg font-semibold text-slate-800">Дансны хуулга оруулагч</h1>
      </div>

      {banks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          Хуулга оруулах боломжтой банк тохируулагдаагүй байна.
        </div>
      ) : (
        <ImportForm banks={banks} />
      )}
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { FormError } from "@/components/ui/FormError";
import { DateInput } from "@/components/ui/DateInput";
import type { ActionResult } from "@/lib/rpc";
import { Save, ArrowLeft } from "lucide-react";
import Link from "next/link";

export type EmployeeData = {
  first_name?: string;
  last_name?: string | null;
  tin?: string | null;
  phone?: string | null;
  email?: string | null;
  title?: string | null;
  department?: string | null;
  hire_date?: string | null;
  base_salary?: number;
  phone_allowance?: number;
  bank_name?: string | null;
  bank_account?: string | null;
  is_active?: boolean;
};

export function EmployeeForm({
  mode,
  initialData,
  action,
}: {
  mode: "create" | "edit";
  initialData?: EmployeeData;
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(action, undefined);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <Link href="/salary/employees" className="text-xs text-slate-500 hover:underline flex items-center gap-1 mb-1">
          <ArrowLeft className="w-3 h-3" /> Ажилтнуудад буцах
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">
          {mode === "create" ? "Шинэ ажилтан" : "Ажилтан засах"}
        </h1>
      </div>

      <form action={formAction} className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <FormError message={state?.error} />

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Нэр <span className="text-red-500">*</span></label>
            <input name="first_name" required defaultValue={initialData?.first_name ?? ""} lang="mn" className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Овог</label>
            <input name="last_name" defaultValue={initialData?.last_name ?? ""} lang="mn" className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Регистр (ТТД)</label>
            <input name="tin" defaultValue={initialData?.tin ?? ""} className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Утас</label>
            <input name="phone" defaultValue={initialData?.phone ?? ""} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">И-мэйл</label>
            <input type="email" name="email" defaultValue={initialData?.email ?? ""} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Албан тушаал</label>
            <input name="title" defaultValue={initialData?.title ?? ""} lang="mn" className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Хэлтэс</label>
            <input name="department" defaultValue={initialData?.department ?? ""} lang="mn" className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Гэрээт цалин</label>
            <input name="base_salary" type="number" step="1" defaultValue={initialData?.base_salary ?? 0} className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono text-right" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Утасны нэмэгдэл</label>
            <input name="phone_allowance" type="number" step="1" defaultValue={initialData?.phone_allowance ?? 0} className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono text-right" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ажилласан өдөр</label>
            <DateInput name="hire_date" defaultValue={initialData?.hire_date ?? ""} className="w-full" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Банкны нэр</label>
            <input name="bank_name" defaultValue={initialData?.bank_name ?? ""} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Дансны дугаар</label>
            <input name="bank_account" defaultValue={initialData?.bank_account ?? ""} className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono" />
          </div>
        </div>

        {mode === "edit" && (
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_active" value="1" defaultChecked={initialData?.is_active !== false} className="rounded border-slate-300" />
            <span>Идэвхтэй</span>
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Link href="/salary/employees" className="px-4 py-2 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50">Цуцлах</Link>
          <button type="submit" disabled={pending} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 disabled:opacity-60">
            <Save className="w-4 h-4" /> {pending ? "Хадгалж байна..." : "Хадгалах"}
          </button>
        </div>
      </form>
    </div>
  );
}

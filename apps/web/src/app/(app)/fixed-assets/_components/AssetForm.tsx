"use client";

import { useActionState } from "react";
import { FormError } from "@/components/ui/FormError";
import { DateInput } from "@/components/ui/DateInput";
import { AccountPicker } from "@/components/ui/AccountPicker";
import { ASSET_STATUS } from "@/lib/i18n/labels";
import type { ActionResult } from "@/lib/rpc";
import { Save, ArrowLeft } from "lucide-react";
import Link from "next/link";

export type AssetInitial = {
  code?: string | null;
  name?: string;
  category?: string | null;
  purchase_date?: string | null;
  purchase_amount?: number;
  useful_life_months?: number;
  salvage_value?: number;
  accumulated_depreciation?: number;
  asset_account_id?: string | null;
  asset_account_label?: string | null;
  depreciation_account_id?: string | null;
  depreciation_account_label?: string | null;
  expense_account_id?: string | null;
  expense_account_label?: string | null;
  location?: string | null;
  responsible_person?: string | null;
  status?: string | null;
  notes?: string | null;
};

export function AssetForm({
  mode,
  initialData,
  action,
}: {
  mode: "create" | "edit";
  initialData?: AssetInitial;
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(action, undefined);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <Link href="/fixed-assets" className="text-xs text-slate-500 hover:underline flex items-center gap-1 mb-1">
          <ArrowLeft className="w-3 h-3" /> Үндсэн хөрөнгөнүүдэд буцах
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">
          {mode === "create" ? "Шинэ үндсэн хөрөнгө" : "Хөрөнгө засах"}
        </h1>
      </div>

      <form action={formAction} className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <FormError message={state?.error} />

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Код</label>
            <input name="code" defaultValue={initialData?.code ?? ""} className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Нэр <span className="text-red-500">*</span></label>
            <input name="name" required defaultValue={initialData?.name ?? ""} lang="mn" className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ангилал</label>
            <input name="category" defaultValue={initialData?.category ?? ""} lang="mn" className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Худалдан авах огноо <span className="text-red-500">*</span></label>
            <DateInput name="purchase_date" required defaultValue={initialData?.purchase_date ?? ""} className="w-full" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Худалдан авах үнэ <span className="text-red-500">*</span></label>
            <input name="purchase_amount" type="number" step="0.01" required defaultValue={initialData?.purchase_amount ?? ""} className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono text-right" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Үлдэгдэл үнэ</label>
            <input name="salvage_value" type="number" step="0.01" defaultValue={initialData?.salvage_value ?? 0} className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono text-right" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Хугацаа (сар) <span className="text-red-500">*</span></label>
            <input name="useful_life_months" type="number" step="1" required defaultValue={initialData?.useful_life_months ?? 60} className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono text-right" />
          </div>
        </div>

        {mode === "edit" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Хуримтлагдсан элэгдэл</label>
            <input name="accumulated_depreciation" type="number" step="0.01" defaultValue={initialData?.accumulated_depreciation ?? 0} className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono text-right" />
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Хөрөнгийн данс <span className="text-red-500">*</span></label>
            <AccountPicker
              name="asset_account_id"
              required filterType="asset"
              defaultId={initialData?.asset_account_id ?? undefined}
              defaultLabel={initialData?.asset_account_label ?? undefined}
              placeholder="15..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Элэгдлийн данс</label>
            <AccountPicker
              name="depreciation_account_id"
              filterType="asset"
              defaultId={initialData?.depreciation_account_id ?? undefined}
              defaultLabel={initialData?.depreciation_account_label ?? undefined}
              placeholder="16..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Зардлын данс</label>
            <AccountPicker
              name="expense_account_id"
              filterType="expense"
              defaultId={initialData?.expense_account_id ?? undefined}
              defaultLabel={initialData?.expense_account_label ?? undefined}
              placeholder="78..."
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Байршил</label>
            <input name="location" defaultValue={initialData?.location ?? ""} lang="mn" className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Хариуцагч</label>
            <input name="responsible_person" defaultValue={initialData?.responsible_person ?? ""} lang="mn" className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
        </div>

        {mode === "edit" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Статус</label>
            <select name="status" defaultValue={initialData?.status ?? "active"} className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white">
              {Object.entries(ASSET_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Тайлбар</label>
          <textarea name="notes" rows={2} defaultValue={initialData?.notes ?? ""} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Link href="/fixed-assets" className="px-4 py-2 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50">Цуцлах</Link>
          <button type="submit" disabled={pending} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 disabled:opacity-60">
            <Save className="w-4 h-4" /> {pending ? "Хадгалж байна..." : "Хадгалах"}
          </button>
        </div>
      </form>
    </div>
  );
}

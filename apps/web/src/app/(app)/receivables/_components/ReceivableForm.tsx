"use client";

import { useActionState, useState } from "react";
import { FormError } from "@/components/ui/FormError";
import { DateInput } from "@/components/ui/DateInput";
import { PartnerPicker } from "@/components/ui/PartnerPicker";
import { AccountPicker } from "@/components/ui/AccountPicker";
import { AR_AP_STATUS } from "@/lib/i18n/labels";
import type { ActionResult } from "@/lib/rpc";
import { Save, ArrowLeft } from "lucide-react";
import Link from "next/link";

export type ReceivableInitial = {
  invoice_no?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  amount?: number | null;
  vat_amount?: number | null;
  description?: string | null;
  responsible?: string | null;
  status?: string | null;
  partner_id?: string | null;
  partner_name?: string | null;
  ar_account_id?: string | null;
  ar_account_label?: string | null;
  income_account_id?: string | null;
  income_account_label?: string | null;
};

export function ReceivableForm({
  mode,
  initialData,
  action,
}: {
  mode: "create" | "edit";
  initialData?: ReceivableInitial;
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    action,
    undefined,
  );
  const [amount, setAmount] = useState(String(initialData?.amount ?? ""));
  const [vatAmount, setVatAmount] = useState(String(initialData?.vat_amount ?? ""));

  const total = (Number(amount) || 0) + (Number(vatAmount) || 0);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <Link href="/receivables" className="text-xs text-slate-500 hover:underline flex items-center gap-1 mb-1">
          <ArrowLeft className="w-3 h-3" /> Авлагуудад буцах
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">
          {mode === "create" ? "Шинэ авлага" : "Авлага засах"}
        </h1>
      </div>

      <form action={formAction} className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <FormError message={state?.error} />

        {mode === "create" && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Харилцагч <span className="text-red-500">*</span></label>
              <PartnerPicker name="partner_id" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Авлагын данс (Dr) <span className="text-red-500">*</span></label>
                <AccountPicker name="ar_account_id" required filterType="asset" placeholder="1210..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Орлогын данс (Cr)</label>
                <AccountPicker name="income_account_id" filterType="income" placeholder="6110..." />
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Нэхэмж №</label>
            <input name="invoice_no" defaultValue={initialData?.invoice_no ?? ""} className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Огноо <span className="text-red-500">*</span></label>
            <DateInput name="invoice_date" required defaultValue={initialData?.invoice_date ?? new Date().toISOString().slice(0, 10)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Хугацаа</label>
            <DateInput name="due_date" defaultValue={initialData?.due_date ?? ""} className="w-full" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Дүн (НӨАТгүй) <span className="text-red-500">*</span></label>
            <input
              name="amount" type="number" step="0.01" required
              value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono text-right"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">НӨАТ</label>
            <input
              name="vat_amount" type="number" step="0.01"
              value={vatAmount} onChange={(e) => setVatAmount(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono text-right"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Нийт</label>
            <input type="text" readOnly value={total.toFixed(2)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm font-mono text-right bg-slate-50" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Тайлбар</label>
            <input name="description" defaultValue={initialData?.description ?? ""} lang="mn" className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Хариуцагч</label>
            <input name="responsible" defaultValue={initialData?.responsible ?? ""} lang="mn" className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
        </div>

        {mode === "edit" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Статус</label>
            <select name="status" defaultValue={initialData?.status ?? "open"} className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white">
              {Object.entries(AR_AP_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Link href="/receivables" className="px-4 py-2 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50">Цуцлах</Link>
          <button type="submit" disabled={pending} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 disabled:opacity-60">
            <Save className="w-4 h-4" /> {pending ? "Хадгалж байна..." : "Хадгалах"}
          </button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import { FormError } from "@/components/ui/FormError";
import { DateInput } from "@/components/ui/DateInput";
import { PartnerPicker } from "@/components/ui/PartnerPicker";
import { VAT_DIRECTION, VAT_TAX_TYPE } from "@/lib/i18n/labels";
import type { ActionResult } from "@/lib/rpc";
import { Save, ArrowLeft } from "lucide-react";
import Link from "next/link";

export function VatForm({
  action,
}: {
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    action,
    undefined,
  );
  const [amount, setAmount] = useState("");
  const [vatAmount, setVatAmount] = useState("");

  const total = (Number(amount) || 0) + (Number(vatAmount) || 0);

  function recalcVatFromAmount(a: string) {
    setAmount(a);
    const n = Number(a) || 0;
    setVatAmount((n * 0.1).toFixed(2));
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <Link href="/vat" className="text-xs text-slate-500 hover:underline flex items-center gap-1 mb-1">
          <ArrowLeft className="w-3 h-3" /> НӨАТ бүртгэлд буцах
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Шинэ НӨАТ бичлэг</h1>
      </div>

      <form action={formAction} className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <FormError message={state?.error} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Чиглэл</label>
            <select name="direction" defaultValue="outbound" className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white">
              {Object.entries(VAT_DIRECTION).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Татварын төрөл</label>
            <select name="tax_type" defaultValue="standard" className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white">
              {Object.entries(VAT_TAX_TYPE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Огноо <span className="text-red-500">*</span></label>
            <DateInput name="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ДДТД (eBarimt)</label>
            <input name="ddtd" placeholder="33 оронтой ДДТД" className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Нэхэмж №</label>
            <input name="invoice_no" className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Харилцагч</label>
          <PartnerPicker name="partner_id" placeholder="Харилцагч сонгох (заавал биш)" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Партнер нэр (raw)</label>
            <input name="partner_name" lang="mn" className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Партнер регистр</label>
            <input name="partner_register" className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Дүн (НӨАТгүй) <span className="text-red-500">*</span></label>
            <input
              name="amount" type="number" step="0.01" required
              value={amount} onChange={(e) => recalcVatFromAmount(e.target.value)}
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
            <input
              type="text" readOnly value={total.toFixed(2)}
              className="w-full px-3 py-2 border border-slate-200 rounded text-sm font-mono text-right bg-slate-50"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Link href="/vat" className="px-4 py-2 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50">
            Цуцлах
          </Link>
          <button type="submit" disabled={pending} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 disabled:opacity-60">
            <Save className="w-4 h-4" /> {pending ? "Хадгалж байна..." : "Хадгалах"}
          </button>
        </div>
      </form>
    </div>
  );
}

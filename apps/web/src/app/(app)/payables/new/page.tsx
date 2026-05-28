"use client";

import { useActionState, useState } from "react";
import { FormError } from "@/components/ui/FormError";
import { DateInput } from "@/components/ui/DateInput";
import { PartnerPicker } from "@/components/ui/PartnerPicker";
import { AccountPicker } from "@/components/ui/AccountPicker";
import { createPayable } from "../actions";
import type { ActionResult } from "@/lib/rpc";
import { Save, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewPayablePage() {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    createPayable,
    undefined,
  );
  const [amount, setAmount] = useState("");
  const [vatAmount, setVatAmount] = useState("");
  const total = (Number(amount) || 0) + (Number(vatAmount) || 0);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <Link href="/payables" className="text-xs text-slate-500 hover:underline flex items-center gap-1 mb-1">
          <ArrowLeft className="w-3 h-3" /> Өглөгүүдэд буцах
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Шинэ өглөг</h1>
      </div>

      <form action={formAction} className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <FormError message={state?.error} />

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Нийлүүлэгч <span className="text-red-500">*</span></label>
          <PartnerPicker name="partner_id" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Өглөгийн данс (Cr) <span className="text-red-500">*</span></label>
            <AccountPicker name="ap_account_id" required filterType="liability" placeholder="3310..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Зардлын данс (Dr)</label>
            <AccountPicker name="expense_account_id" filterType="expense" placeholder="7..." />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Нэхэмж №</label>
            <input name="invoice_no" className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Огноо <span className="text-red-500">*</span></label>
            <DateInput name="invoice_date" required defaultValue={new Date().toISOString().slice(0, 10)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Хугацаа</label>
            <DateInput name="due_date" className="w-full" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Дүн <span className="text-red-500">*</span></label>
            <input name="amount" type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono text-right" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">НӨАТ</label>
            <input name="vat_amount" type="number" step="0.01" value={vatAmount} onChange={(e) => setVatAmount(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono text-right" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Нийт</label>
            <input type="text" readOnly value={total.toFixed(2)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm font-mono text-right bg-slate-50" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Тайлбар</label>
            <input name="description" lang="mn" className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Хариуцагч</label>
            <input name="responsible" lang="mn" className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Link href="/payables" className="px-4 py-2 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50">Цуцлах</Link>
          <button type="submit" disabled={pending} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 disabled:opacity-60">
            <Save className="w-4 h-4" /> {pending ? "Хадгалж байна..." : "Хадгалах"}
          </button>
        </div>
      </form>
    </div>
  );
}

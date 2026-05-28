"use client";

import { useActionState } from "react";
import { LineEditor } from "./LineEditor";
import { FormError } from "@/components/ui/FormError";
import { DateInput } from "@/components/ui/DateInput";
import type { ActionResult } from "@/lib/rpc";
import { Save, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export function JournalForm({
  action,
  defaultDate,
  defaultLines,
}: {
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
  defaultDate?: string;
  defaultLines?: Array<{
    uid: string;
    account_id: string;
    account_label: string;
    partner_id: string;
    partner_label: string;
    debit: string;
    credit: string;
    description: string;
  }>;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    action,
    undefined,
  );

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/journals" className="text-xs text-slate-500 hover:underline flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3 h-3" /> Журналуудад буцах
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900">Шинэ гүйлгээ</h1>
        </div>
      </div>

      <form action={formAction} className="space-y-4">
        <FormError message={state?.error} />

        {/* Header */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Огноо <span className="text-red-500">*</span>
            </label>
            <DateInput
              name="date"
              required
              defaultValue={defaultDate ?? new Date().toISOString().slice(0, 10)}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Дугаар</label>
            <input
              type="text"
              name="number"
              placeholder="Автомат: 202605-NNNN"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Лавлагаа</label>
            <input
              type="text"
              name="reference"
              placeholder="Гадаад дугаар"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Тайлбар</label>
            <input
              type="text"
              name="description"
              placeholder="Гүйлгээний тайлбар"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
        </div>

        {/* Lines */}
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Гүйлгээний мөрүүд</h2>
          <LineEditor initial={defaultLines} />
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Link
            href="/journals"
            className="px-4 py-2 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50"
          >
            Цуцлах
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded text-sm font-medium flex items-center gap-2 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            Ноорогоор хадгалах
          </button>
          <button
            type="submit"
            name="post_now"
            value="1"
            disabled={pending}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 disabled:opacity-60"
          >
            <CheckCircle2 className="w-4 h-4" />
            {pending ? "Хадгалж байна..." : "Хадгалаад баталгаажуулах"}
          </button>
        </div>
      </form>
    </div>
  );
}

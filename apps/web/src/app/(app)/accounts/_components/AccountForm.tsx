"use client";

import { useActionState } from "react";
import { FormError } from "@/components/ui/FormError";
import { ACCOUNT_TYPE } from "@/lib/i18n/labels";
import type { ActionResult } from "@/lib/rpc";
import { Save, ArrowLeft } from "lucide-react";
import Link from "next/link";

type AccountFormData = {
  code: string;
  name: string;
  name_en?: string | null;
  type: string;
  parent_id?: string | null;
  is_postable: boolean;
  is_active: boolean;
  currency: string;
  notes?: string | null;
};

type Account = {
  id: string;
  code: string;
  name: string;
};

export function AccountForm({
  mode,
  initialData,
  parentOptions,
  action,
}: {
  mode: "create" | "edit";
  initialData?: Partial<AccountFormData>;
  parentOptions: Account[];
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    action,
    undefined,
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/accounts" className="text-xs text-slate-500 hover:underline flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3 h-3" /> Бүх дансанд буцах
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900">
            {mode === "create" ? "Шинэ данс нэмэх" : "Данс засах"}
          </h1>
        </div>
      </div>

      <form action={formAction} className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <FormError message={state?.error} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Дансны код <span className="text-red-500">*</span>
            </label>
            <input
              name="code"
              required
              defaultValue={initialData?.code ?? ""}
              autoFocus={mode === "create"}
              placeholder="1100"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Дансны төрөл <span className="text-red-500">*</span>
            </label>
            <select
              name="type"
              required
              defaultValue={initialData?.type ?? "asset"}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 bg-white"
            >
              {Object.entries(ACCOUNT_TYPE).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Дансны нэр <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            required
            defaultValue={initialData?.name ?? ""}
            placeholder="Жишээ нь: Дансны авлага — харилцагч"
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Эцэг данс</label>
          <select
            name="parent_id"
            defaultValue={initialData?.parent_id ?? ""}
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 bg-white"
          >
            <option value="">— Эцэггүй —</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Валют</label>
            <select
              name="currency"
              defaultValue={initialData?.currency ?? "MNT"}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 bg-white"
            >
              <option value="MNT">MNT</option>
              <option value="USD">USD</option>
              <option value="CNY">CNY</option>
              <option value="EUR">EUR</option>
              <option value="RUB">RUB</option>
            </select>
          </div>
          <div className="flex flex-col gap-2 justify-end">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_postable"
                value="1"
                defaultChecked={initialData?.is_postable !== false}
                className="rounded border-slate-300"
              />
              <span>Бичигдэх данс (postable)</span>
            </label>
            {mode === "edit" && (
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="is_active"
                  value="1"
                  defaultChecked={initialData?.is_active !== false}
                  className="rounded border-slate-300"
                />
                <span>Идэвхтэй</span>
              </label>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Тайлбар</label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={initialData?.notes ?? ""}
            placeholder="Нэмэлт тайлбар (заавал биш)"
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Link
            href="/accounts"
            className="px-4 py-2 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50"
          >
            Цуцлах
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {pending ? "Хадгалж байна..." : "Хадгалах"}
          </button>
        </div>
      </form>
    </div>
  );
}

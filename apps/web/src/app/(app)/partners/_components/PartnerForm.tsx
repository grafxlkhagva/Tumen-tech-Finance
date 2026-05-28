"use client";

import { useActionState } from "react";
import { FormError } from "@/components/ui/FormError";
import { PARTNER_TYPE } from "@/lib/i18n/labels";
import type { ActionResult } from "@/lib/rpc";
import { Save, ArrowLeft } from "lucide-react";
import Link from "next/link";

export type PartnerFormData = {
  name: string;
  code?: string | null;
  register?: string | null;
  tin?: string | null;
  type: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  aliases?: string[];
  is_vat_payer?: boolean;
  is_active?: boolean;
  notes?: string | null;
};

export function PartnerForm({
  mode,
  initialData,
  action,
}: {
  mode: "create" | "edit";
  initialData?: Partial<PartnerFormData>;
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    action,
    undefined,
  );

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <Link href="/partners" className="text-xs text-slate-500 hover:underline flex items-center gap-1 mb-1">
          <ArrowLeft className="w-3 h-3" /> Бүх харилцагчид
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">
          {mode === "create" ? "Шинэ харилцагч" : "Харилцагч засах"}
        </h1>
      </div>

      <form action={formAction} className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <FormError message={state?.error} />

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Нэр <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              required
              defaultValue={initialData?.name ?? ""}
              autoFocus={mode === "create"}
              lang="mn"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Дотоод код</label>
            <input
              name="code"
              defaultValue={initialData?.code ?? ""}
              placeholder="(заавал биш)"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Төрөл</label>
            <select
              name="type"
              defaultValue={initialData?.type ?? "customer"}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              {Object.entries(PARTNER_TYPE).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">УБДУС регистр</label>
            <input
              name="register"
              defaultValue={initialData?.register ?? ""}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Татвар (TIN)</label>
            <input
              name="tin"
              defaultValue={initialData?.tin ?? ""}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Утас</label>
            <input
              name="phone"
              defaultValue={initialData?.phone ?? ""}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">И-мэйл</label>
            <input
              type="email"
              name="email"
              defaultValue={initialData?.email ?? ""}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Хаяг</label>
          <input
            name="address"
            defaultValue={initialData?.address ?? ""}
            lang="mn"
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Өөр нэрс (alias)</label>
          <textarea
            name="aliases"
            rows={2}
            defaultValue={Array.isArray(initialData?.aliases) ? initialData.aliases.join("\n") : ""}
            lang="mn"
            placeholder="Нэг мөрөнд нэг alias. Кирилл/Латин хувилбар, өмнөх нэрс гэх мэт."
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
          <p className="text-xs text-slate-500 mt-1">Хайхдаа automatic fuzzy match (Cyrillic/Latin)</p>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_vat_payer"
              value="1"
              defaultChecked={initialData?.is_vat_payer !== false}
              className="rounded border-slate-300"
            />
            <span>НӨАТ төлөгч</span>
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

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Тайлбар</label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={initialData?.notes ?? ""}
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Link
            href="/partners"
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

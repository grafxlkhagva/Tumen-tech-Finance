"use client";

import { useActionState } from "react";
import { changePasswordAction, type PwState } from "./actions";
import { Save } from "lucide-react";

export default function ProfileForm() {
  const [state, action, pending] = useActionState<PwState | undefined, FormData>(
    changePasswordAction,
    undefined,
  );

  return (
    <form action={action} className="space-y-3 max-w-md" autoComplete="off">
      {state?.error && (
        <div className="px-3 py-2 text-sm bg-red-50 border border-red-200 text-red-700 rounded">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="px-3 py-2 text-sm bg-green-50 border border-green-200 text-green-700 rounded">
          {state.success}
        </div>
      )}

      <div>
        <label className="block text-xs text-slate-600 mb-1">Одоогийн нууц үг</label>
        <input
          type="password" name="current_password" required autoComplete="current-password"
          className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
        />
      </div>

      <div>
        <label className="block text-xs text-slate-600 mb-1">Шинэ нууц үг</label>
        <input
          type="password" name="new_password" required minLength={8} autoComplete="new-password"
          placeholder="хамгийн багадаа 8 тэмдэгт"
          className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
        />
      </div>

      <div>
        <label className="block text-xs text-slate-600 mb-1">Шинэ нууц үг (давтах)</label>
        <input
          type="password" name="confirm_password" required minLength={8} autoComplete="new-password"
          className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
        />
      </div>

      <button
        type="submit" disabled={pending}
        className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 disabled:opacity-60"
      >
        <Save className="w-4 h-4" />
        {pending ? "Хадгалж байна..." : "Хадгалах"}
      </button>
    </form>
  );
}

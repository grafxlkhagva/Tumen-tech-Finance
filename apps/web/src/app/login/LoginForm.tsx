"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";
import { LogIn } from "lucide-react";

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState | undefined, FormData>(
    loginAction,
    undefined,
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-9">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-full text-white text-2xl font-bold mb-3">
            T
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Тумэн Accounting</h1>
          <p className="text-sm text-slate-500 mt-1">Системд нэвтрэх</p>
        </div>

        {state?.error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              И-мэйл
            </label>
            <input
              type="email"
              name="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="name@example.com"
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Нууц үг
            </label>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded font-medium text-sm flex items-center justify-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <LogIn className="w-4 h-4" />
            {pending ? "Уншиж байна..." : "Нэвтрэх"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Шинэ хэрэглэгчийн эрх авах бол админд хандана уу
        </p>
      </div>
    </div>
  );
}

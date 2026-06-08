"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";
import { requestPasswordReset, type ResetState } from "../actions";

export default function ForgotForm({
  flash,
  flashType,
}: {
  flash?: string;
  flashType?: string;
}) {
  const [state, formAction, pending] = useActionState<ResetState | undefined, FormData>(
    requestPasswordReset,
    undefined,
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-9">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-full text-white text-2xl font-bold mb-3">
            T
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Нууц үг сэргээх</h1>
          <p className="text-sm text-slate-500 mt-1">
            Бүртгэлтэй и-мэйлээ оруулбал сэргээх холбоос илгээнэ
          </p>
        </div>

        {flash && !state?.error && !state?.success && (
          <div
            className={`mb-4 px-3 py-2 text-sm rounded border ${
              flashType === "error"
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}
          >
            {flash}
          </div>
        )}

        {state?.error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
            {state.error}
          </div>
        )}
        {state?.success && (
          <div className="mb-4 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded">
            {state.success}
          </div>
        )}

        {!state?.success && (
          <form action={formAction} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">И-мэйл</label>
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
            <button
              type="submit"
              disabled={pending}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded font-medium text-sm flex items-center justify-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Mail className="w-4 h-4" />
              {pending ? "Илгээж байна..." : "Сэргээх холбоос илгээх"}
            </button>
          </form>
        )}

        <div className="text-center mt-6">
          <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Нэвтрэх рүү буцах
          </Link>
        </div>
      </div>
    </div>
  );
}

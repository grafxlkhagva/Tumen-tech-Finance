"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, Loader2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Phase = "checking" | "ready" | "invalid";

export default function UpdatePasswordForm() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [phase, setPhase] = useState<Phase>("checking");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // The browser client auto-parses the recovery token from the URL
  // (?code= for PKCE or #hash for implicit) via detectSessionInUrl. We just
  // wait for a session / PASSWORD_RECOVERY event to confirm the link is valid.
  useEffect(() => {
    let settled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !settled) {
        settled = true;
        setPhase("ready");
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !settled) {
        settled = true;
        setPhase("ready");
      } else if (!data.session) {
        // Give detectSessionInUrl a beat to finish, then mark invalid.
        setTimeout(() => {
          if (!settled) setPhase("invalid");
        }, 2500);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") || "");
    const confirm = String(fd.get("confirm") || "");
    if (password.length < 8) {
      setError("Нууц үг доод тал нь 8 тэмдэгт байх ёстой");
      return;
    }
    if (password !== confirm) {
      setError("Нууц үг хоорондоо таарахгүй байна");
      return;
    }
    setPending(true);
    setError(null);
    const { error: upErr } = await supabase.auth.updateUser({ password });
    if (upErr) {
      setPending(false);
      setError(upErr.message);
      return;
    }
    // Sign out the recovery session so the user logs in fresh with the new
    // password — confirms it works end-to-end.
    await supabase.auth.signOut();
    router.push(
      `/login?flash=${encodeURIComponent("Нууц үг амжилттай шинэчлэгдлээ. Шинэ нууц үгээрээ нэвтэрнэ үү.")}&type=success`,
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-9">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-full text-white text-2xl font-bold mb-3">
            T
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Шинэ нууц үг</h1>
          <p className="text-sm text-slate-500 mt-1">Шинэ нууц үгээ оруулна уу</p>
        </div>

        {phase === "checking" && (
          <div className="flex items-center justify-center gap-2 py-8 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Холбоосыг шалгаж байна…
          </div>
        )}

        {phase === "invalid" && (
          <div className="space-y-4">
            <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Сэргээх холбоос хүчингүй эсвэл хугацаа нь дууссан байна.</span>
            </div>
            <Link
              href="/login/forgot"
              className="block text-center w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded font-medium text-sm"
            >
              Шинэ холбоос авах
            </Link>
          </div>
        )}

        {phase === "ready" && (
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Шинэ нууц үг</label>
              <input
                type="password"
                name="password"
                required
                autoFocus
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Нууц үг давтах</label>
              <input
                type="password"
                name="confirm"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm"
              />
            </div>
            <p className="text-xs text-slate-400">Доод тал нь 8 тэмдэгт.</p>
            <button
              type="submit"
              disabled={pending}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded font-medium text-sm flex items-center justify-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {pending ? "Хадгалж байна..." : "Нууц үг шинэчлэх"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

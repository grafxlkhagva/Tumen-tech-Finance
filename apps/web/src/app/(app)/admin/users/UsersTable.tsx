"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, KeyRound, UserPlus, X, Check } from "lucide-react";
import { adminSendReset, adminSetPassword, adminInviteUser } from "./actions";

export type UserRow = {
  id: string;
  email: string;
  role: string;
  isDefault: boolean;
  confirmed: boolean;
  lastSignIn: string | null;
  createdAt: string | null;
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Админ",
  accountant: "Нягтлан",
  viewer: "Үзэгч",
};

export function UsersTable({ rows }: { rows: UserRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [pwModal, setPwModal] = useState<{ id: string; email: string } | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  function notify(s: string) {
    setMsg(s);
    setTimeout(() => setMsg(null), 5000);
  }

  function sendReset(email: string) {
    if (!confirm(`${email} рүү нууц үг сэргээх имэйл илгээх үү?`)) return;
    startTransition(async () => {
      const r = await adminSendReset(email);
      notify(r.error ? `⚠ ${r.error}` : `✓ ${r.success}`);
    });
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-600 min-h-[1rem]">{msg}</div>
        <button
          onClick={() => setShowInvite(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs flex items-center gap-1.5"
        >
          <UserPlus className="w-3.5 h-3.5" /> Хэрэглэгч урих
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-white text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Имэйл</th>
              <th className="px-3 py-2 text-left w-24">Эрх</th>
              <th className="px-3 py-2 text-center w-24">Баталгаажсан</th>
              <th className="px-3 py-2 text-left w-40">Сүүлд нэвтэрсэн</th>
              <th className="px-3 py-2 text-right w-64">Үйлдэл</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400">Хэрэглэгч алга</td></tr>
            ) : (
              rows.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{u.email}</td>
                  <td className="px-3 py-2">
                    <span className="inline-block px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[0.68rem] font-semibold">
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {u.confirmed ? <Check className="w-4 h-4 text-emerald-600 inline" /> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{fmtDateTime(u.lastSignIn)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => sendReset(u.email)}
                        disabled={pending}
                        className="border border-blue-300 text-blue-700 hover:bg-blue-50 px-2 py-1 rounded text-[0.7rem] flex items-center gap-1 disabled:opacity-50"
                        title="Сэргээх имэйл илгээх"
                      >
                        <Mail className="w-3 h-3" /> Имэйл
                      </button>
                      <button
                        onClick={() => setPwModal({ id: u.id, email: u.email })}
                        disabled={pending}
                        className="border border-slate-300 text-slate-700 hover:bg-slate-50 px-2 py-1 rounded text-[0.7rem] flex items-center gap-1 disabled:opacity-50"
                        title="Нууц үг шууд тохируулах"
                      >
                        <KeyRound className="w-3 h-3" /> Нууц үг
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Set-password modal */}
      {pwModal && (
        <SetPasswordModal
          email={pwModal.email}
          onClose={() => setPwModal(null)}
          onSave={(pw) =>
            startTransition(async () => {
              const r = await adminSetPassword(pwModal.id, pw);
              notify(r.error ? `⚠ ${r.error}` : `✓ ${pwModal.email}: ${r.success}`);
              if (!r.error) setPwModal(null);
              router.refresh();
            })
          }
          pending={pending}
        />
      )}

      {/* Invite modal */}
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSave={(email) =>
            startTransition(async () => {
              const r = await adminInviteUser(email);
              notify(r.error ? `⚠ ${r.error}` : `✓ ${r.success}`);
              if (!r.error) setShowInvite(false);
              router.refresh();
            })
          }
          pending={pending}
        />
      )}
    </div>
  );
}

function SetPasswordModal({
  email, onClose, onSave, pending,
}: {
  email: string;
  onClose: () => void;
  onSave: (pw: string) => void;
  pending: boolean;
}) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    if (pw.length < 8) { setErr("Нууц үг доод тал нь 8 тэмдэгт"); return; }
    if (pw !== confirm) { setErr("Нууц үг таарахгүй байна"); return; }
    setErr(null);
    onSave(pw);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800 flex items-center gap-1.5">
            <KeyRound className="w-4 h-4" /> Нууц үг тохируулах
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-slate-500 mb-3">{email}</p>
        {err && <div className="mb-2 px-2 py-1.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded">{err}</div>}
        <input
          type="text"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Шинэ нууц үг (≥8)"
          autoFocus
          className="w-full px-3 py-2 border border-slate-300 rounded text-sm mb-2"
        />
        <input
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Дахин оруулна уу"
          className="w-full px-3 py-2 border border-slate-300 rounded text-sm mb-3"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 border border-slate-300 rounded text-xs">Болих</button>
          <button onClick={submit} disabled={pending} className="px-3 py-1.5 bg-slate-900 text-white rounded text-xs disabled:opacity-60">
            {pending ? "Хадгалж байна…" : "Тохируулах"}
          </button>
        </div>
        <p className="text-[0.65rem] text-slate-400 mt-2">
          Энэ нь түр нууц үг — хэрэглэгчид дамжуулж, нэвтэрсний дараа солихыг сануулна уу.
        </p>
      </div>
    </div>
  );
}

function InviteModal({
  onClose, onSave, pending,
}: {
  onClose: () => void;
  onSave: (email: string) => void;
  pending: boolean;
}) {
  const [email, setEmail] = useState("");
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800 flex items-center gap-1.5">
            <UserPlus className="w-4 h-4" /> Хэрэглэгч урих
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          autoFocus
          className="w-full px-3 py-2 border border-slate-300 rounded text-sm mb-3"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 border border-slate-300 rounded text-xs">Болих</button>
          <button onClick={() => onSave(email)} disabled={pending} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs disabled:opacity-60">
            {pending ? "Илгээж байна…" : "Урилга илгээх"}
          </button>
        </div>
        <p className="text-[0.65rem] text-slate-400 mt-2">
          Урьсны дараа уг хэрэглэгчид компанийн эрхийг (user_companies) тусад нь олгоно уу.
        </p>
      </div>
    </div>
  );
}

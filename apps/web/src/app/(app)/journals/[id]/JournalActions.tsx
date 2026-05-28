"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { postJournalAction, reverseJournalAction, deleteJournalAction } from "../actions";
import type { JournalStatus } from "@/lib/i18n/labels";

/**
 * Status-aware action buttons for journal detail.
 * - draft → Post / Delete
 * - posted → Reverse
 * - reversed → (display only)
 */
export function JournalActions({
  id,
  status,
  reversedByJournalId,
}: {
  id: string;
  status: JournalStatus;
  reversedByJournalId?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmReverse, setConfirmReverse] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handlePost() {
    setError(null);
    startTransition(async () => {
      const result = await postJournalAction(id);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!confirm("Энэ ноорог журналыг устгах уу?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteJournalAction(id);
      if (result.error) {
        setError(result.error);
      } else {
        router.push(`/journals?flash=${encodeURIComponent("Устгагдсан")}&type=success`);
      }
    });
  }

  function handleReverse() {
    if (!reason.trim()) {
      setError("Шалтгаан бичнэ үү");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await reverseJournalAction(id, reason);
      if (result.error) {
        setError(result.error);
      } else {
        setConfirmReverse(false);
        if (result.data) {
          router.push(`/journals/${result.data}?flash=${encodeURIComponent("Буцаалт хийгдсэн")}&type=success`);
        } else {
          router.refresh();
        }
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      {error && (
        <div className="px-2 py-1 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        {status === "draft" && (
          <>
            <button
              type="button"
              onClick={handlePost}
              disabled={pending}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1 disabled:opacity-60"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Баталгаажуулах
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="border border-red-300 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded text-sm flex items-center gap-1 disabled:opacity-60"
            >
              <Trash2 className="w-3.5 h-3.5" /> Устгах
            </button>
          </>
        )}
        {status === "posted" && !reversedByJournalId && !confirmReverse && (
          <button
            type="button"
            onClick={() => setConfirmReverse(true)}
            className="border border-orange-300 text-orange-700 hover:bg-orange-50 px-3 py-1.5 rounded text-sm flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Буцаах
          </button>
        )}
      </div>

      {confirmReverse && (
        <div className="bg-white border border-orange-200 rounded p-3 w-80 space-y-2">
          <div className="text-sm font-medium">Буцаах шалтгаан</div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Жишээ нь: Алдаатай бичигдсэн..."
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setConfirmReverse(false);
                setReason("");
                setError(null);
              }}
              className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700"
            >
              Цуцлах
            </button>
            <button
              type="button"
              onClick={handleReverse}
              disabled={pending || reason.trim().length < 3}
              className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-xs disabled:opacity-60"
            >
              Буцаах
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

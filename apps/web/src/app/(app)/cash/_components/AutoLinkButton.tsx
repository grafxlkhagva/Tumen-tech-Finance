"use client";

import { useTransition, useState } from "react";
import { Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { runAutoLink } from "../actions";

/**
 * Triggers the auto_link_cash_transactions RPC.
 * Shows a brief status indicator on the button.
 */
export function AutoLinkButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function run() {
    setResult(null);
    startTransition(async () => {
      const r = await runAutoLink();
      if (r.error) {
        setResult(`⚠ ${r.error}`);
      } else if (r.data) {
        setResult(`✓ ${r.data.linked_count} линкэгдсэн · ${r.data.partner_matched_count} партнер`);
        router.refresh();
      }
      setTimeout(() => setResult(null), 4000);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded text-sm font-medium flex items-center gap-2 disabled:opacity-60"
      >
        <Zap className="w-4 h-4" />
        {pending ? "Холбож байна..." : "Auto-link"}
      </button>
      {result && <span className="text-[0.7rem] text-slate-600">{result}</span>}
    </div>
  );
}

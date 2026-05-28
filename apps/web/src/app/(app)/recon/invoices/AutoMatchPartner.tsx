"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { autoMatchByPartner } from "../../receivables/actions";

export function AutoMatchPartner({ partnerId }: { partnerId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function run() {
    setResult(null);
    startTransition(async () => {
      const r = await autoMatchByPartner(partnerId);
      if (r.error) setResult(`⚠ ${r.error}`);
      else setResult(`✓ ${r.data?.matched ?? 0} матчлогдсон`);
      router.refresh();
      setTimeout(() => setResult(null), 3000);
    });
  }

  return (
    <div className="inline-flex items-center gap-2">
      {result && <span className="text-[0.65rem] text-slate-600">{result}</span>}
      <button
        onClick={run}
        disabled={pending}
        className="border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium flex items-center gap-1 disabled:opacity-60"
      >
        <Zap className="w-3 h-3" /> Auto-match
      </button>
    </div>
  );
}

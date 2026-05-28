"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBatchJournal } from "../actions";

export function BatchJournalButton({
  year,
  month,
  readyCount,
}: {
  year: number;
  month: number;
  readyCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    if (!confirm(`${year}-${String(month).padStart(2, "0")} сарын ${readyCount} cash txn нэг журналд нэгтгэх үү?`)) return;
    setError(null);
    startTransition(async () => {
      const r = await createBatchJournal(year, month);
      if (r.error) {
        setError(r.error);
        setTimeout(() => setError(null), 5000);
      } else if (r.data?.journal_id) {
        router.push(`/journals/${r.data.journal_id}?flash=${encodeURIComponent("Батч журнал үүссэн")}&type=success`);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={run}
        disabled={pending}
        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs font-medium disabled:opacity-60"
      >
        {pending ? "Үүсгэж байна..." : "Батч үүсгэх"}
      </button>
      {error && <span className="text-[0.65rem] text-red-600">{error}</span>}
    </div>
  );
}

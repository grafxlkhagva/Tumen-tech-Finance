"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Хэвлэх" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 rounded text-sm flex items-center gap-1 print:hidden"
    >
      <Printer className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

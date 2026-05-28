"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

/**
 * Reads `?flash=...&type=success|error` from URL after a Server Action redirect,
 * shows a toast, then clears the query param.
 *
 * Server Actions trigger via:
 *   redirect(`/journals/${id}?flash=${encodeURIComponent("Хадгалагдлаа")}&type=success`);
 */
export function ToastFromURL() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const flash = sp.get("flash");
  const type = (sp.get("type") || "success") as "success" | "error";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (flash) {
      setVisible(true);
      const cleanup = setTimeout(() => setVisible(false), 3500);
      // Clean URL after first read
      const cleanQs = new URLSearchParams(sp.toString());
      cleanQs.delete("flash");
      cleanQs.delete("type");
      router.replace(`${pathname}${cleanQs.toString() ? `?${cleanQs.toString()}` : ""}`, { scroll: false });
      return () => clearTimeout(cleanup);
    }
  }, [flash, type, pathname, router, sp]);

  if (!flash || !visible) return null;

  const colors =
    type === "error"
      ? "bg-red-50 border-red-200 text-red-700"
      : "bg-green-50 border-green-200 text-green-700";
  const Icon = type === "error" ? AlertCircle : CheckCircle2;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm animate-in slide-in-from-top duration-200">
      <div className={`flex items-start gap-2 px-4 py-3 border rounded-lg shadow-lg ${colors}`}>
        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">{flash}</div>
        <button onClick={() => setVisible(false)} className="text-current opacity-60 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

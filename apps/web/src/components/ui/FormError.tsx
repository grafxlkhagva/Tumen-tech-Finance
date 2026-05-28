import { AlertCircle, CheckCircle2 } from "lucide-react";

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex items-start gap-2">
      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

export function FormSuccess({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="px-3 py-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded flex items-start gap-2">
      <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

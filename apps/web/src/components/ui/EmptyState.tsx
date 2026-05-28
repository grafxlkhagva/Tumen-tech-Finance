import type { LucideIcon } from "lucide-react";

/**
 * Shown inside a table/list when no rows match.
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      {Icon && <Icon className="w-10 h-10 text-slate-300 mb-3" />}
      <div className="text-sm font-medium text-slate-600">{title}</div>
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * Status / category pill. Pass color via Tailwind classes.
 *
 *   <Badge color={JOURNAL_STATUS_COLOR.posted}>{JOURNAL_STATUS.posted}</Badge>
 */
export function Badge({
  color = "bg-slate-100 text-slate-700",
  children,
  className = "",
}: {
  color?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[0.65rem] uppercase font-semibold tracking-wide whitespace-nowrap ${color} ${className}`}
    >
      {children}
    </span>
  );
}

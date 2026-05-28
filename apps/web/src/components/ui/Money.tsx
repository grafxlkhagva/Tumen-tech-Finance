import { fmtMoney, fmtMoneyOrDash } from "@/lib/format";

/**
 * Display money value. Right-aligned, monospace.
 *  - dash: show "—" when value is 0/null
 *  - currency: prepend "₮"
 */
export function Money({
  value,
  dash = false,
  currency = false,
  className = "",
}: {
  value: number | string | null | undefined;
  dash?: boolean;
  currency?: boolean;
  className?: string;
}) {
  const formatted = dash ? fmtMoneyOrDash(value) : fmtMoney(value);
  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {currency && formatted !== "—" && "₮"}
      {formatted}
    </span>
  );
}

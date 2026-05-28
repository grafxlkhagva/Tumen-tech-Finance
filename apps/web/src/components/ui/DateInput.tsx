/**
 * Native <input type="date"> with consistent Mongolian styling.
 * Free OS picker on mobile, no extra JS.
 */
export function DateInput({
  name,
  defaultValue,
  required,
  className = "",
  ...rest
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "name" | "defaultValue">) {
  return (
    <input
      type="date"
      name={name}
      defaultValue={defaultValue}
      required={required}
      className={`px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent ${className}`}
      {...rest}
    />
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { ACCOUNT_TYPE, ACCOUNT_TYPE_COLOR, type AccountType } from "@/lib/i18n/labels";

export type AccountOption = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
};

/**
 * Account search combobox. Filters by code or name with debounce.
 * Submits selected account id via a hidden <input name={name} />.
 *
 *   <AccountPicker name="account_id" placeholder="Дебит данс..." />
 *
 * Fetches from /api/accounts (Phase 0.8).
 */
export function AccountPicker({
  name,
  defaultId,
  defaultLabel,
  placeholder = "Данс сонгох...",
  required = false,
  filterType,
  postableOnly = true,
  className = "",
  onChange,
}: {
  name: string;
  defaultId?: string;
  defaultLabel?: string;
  placeholder?: string;
  required?: boolean;
  filterType?: AccountType;
  postableOnly?: boolean;
  className?: string;
  onChange?: (option: AccountOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AccountOption | null>(
    defaultId && defaultLabel ? { id: defaultId, code: "", name: defaultLabel, type: "asset" } : null,
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (filterType) params.set("type", filterType);
      if (postableOnly) params.set("postable", "1");
      setLoading(true);
      fetch(`/api/accounts?${params}`)
        .then((r) => r.json())
        .then((j) => setOptions(j.accounts ?? []))
        .finally(() => setLoading(false));
    }, 150);
    return () => clearTimeout(t);
  }, [query, open, filterType, postableOnly]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function select(opt: AccountOption) {
    setSelected(opt);
    setQuery("");
    setOpen(false);
    onChange?.(opt);
  }

  function clear() {
    setSelected(null);
    setQuery("");
    onChange?.(null);
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input type="hidden" name={name} value={selected?.id ?? ""} required={required} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-3 py-2 border border-slate-300 rounded text-sm bg-white flex items-center justify-between hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500"
      >
        {selected ? (
          <span className="flex items-center gap-2 truncate">
            <span className="font-mono text-xs text-slate-600">{selected.code}</span>
            <span className="truncate">{selected.name}</span>
          </span>
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
        <span className="flex items-center gap-1 flex-shrink-0">
          {selected && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              className="p-0.5 hover:bg-slate-100 rounded"
            >
              <X className="w-3 h-3 text-slate-400" />
            </span>
          )}
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-72 overflow-hidden flex flex-col">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Код эсвэл нэрээр хайх..."
            className="w-full px-3 py-2 border-b border-slate-200 text-sm focus:outline-none"
          />
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="px-3 py-2 text-xs text-slate-400">Уншиж байна...</div>
            )}
            {!loading && options.length === 0 && (
              <div className="px-3 py-4 text-xs text-slate-400 text-center">Данс олдсонгүй</div>
            )}
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => select(opt)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 border-b border-slate-50 last:border-0"
              >
                <span className="font-mono text-xs text-slate-600 w-12">{opt.code}</span>
                <span className="flex-1 truncate">{opt.name}</span>
                <span
                  className={`inline-block px-1.5 py-0.5 rounded text-[0.6rem] font-semibold ${ACCOUNT_TYPE_COLOR[opt.type]}`}
                >
                  {ACCOUNT_TYPE[opt.type]}
                </span>
                {selected?.id === opt.id && <Check className="w-4 h-4 text-green-600" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

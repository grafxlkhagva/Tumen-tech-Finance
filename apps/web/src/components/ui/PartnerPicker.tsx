"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X, Users } from "lucide-react";

export type PartnerOption = {
  id: string;
  name: string;
  register: string | null;
  type: string;
  similarity?: number;
};

/**
 * Partner search combobox with Cyrillic-aware fuzzy matching.
 * Uses /api/partners/suggest which calls Postgres `find_partner_by_name`.
 *
 *   <PartnerPicker name="partner_id" placeholder="Харилцагч..." />
 */
export function PartnerPicker({
  name,
  defaultId,
  defaultLabel,
  placeholder = "Харилцагч сонгох...",
  required = false,
  className = "",
  onChange,
}: {
  name: string;
  defaultId?: string;
  defaultLabel?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  onChange?: (option: PartnerOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<PartnerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PartnerOption | null>(
    defaultId && defaultLabel ? { id: defaultId, name: defaultLabel, register: null, type: "customer" } : null,
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      setLoading(true);
      fetch(`/api/partners/suggest?${params}`)
        .then((r) => r.json())
        .then((j) => setOptions(j.partners ?? []))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function select(opt: PartnerOption) {
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
            <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">{selected.name}</span>
            {selected.register && (
              <span className="text-xs text-slate-500 font-mono flex-shrink-0">[{selected.register}]</span>
            )}
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
            placeholder="Нэр / регистрээр хайх..."
            lang="mn"
            className="w-full px-3 py-2 border-b border-slate-200 text-sm focus:outline-none"
          />
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="px-3 py-2 text-xs text-slate-400">Уншиж байна...</div>
            )}
            {!loading && options.length === 0 && (
              <div className="px-3 py-4 text-xs text-slate-400 text-center">
                {query ? "Харилцагч олдсонгүй" : "Хайх үг бичнэ үү"}
              </div>
            )}
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => select(opt)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 border-b border-slate-50 last:border-0"
              >
                <span className="flex-1 truncate">{opt.name}</span>
                {opt.register && (
                  <span className="text-xs text-slate-500 font-mono flex-shrink-0">{opt.register}</span>
                )}
                {selected?.id === opt.id && <Check className="w-4 h-4 text-green-600" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

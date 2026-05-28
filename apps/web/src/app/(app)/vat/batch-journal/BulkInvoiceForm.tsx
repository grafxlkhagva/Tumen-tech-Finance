"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AccountPicker } from "@/components/ui/AccountPicker";
import { PartnerPicker } from "@/components/ui/PartnerPicker";
import { Badge } from "@/components/ui/Badge";
import { fmtDate, fmtMoney } from "@/lib/format";
import { bulkMakeInvoices } from "../actions";

type VatRow = {
  id: string;
  date: string;
  ddtd: string | null;
  invoice_no: string | null;
  partner_name: string | null;
  partner_id: string | null;
  amount: number;
  vat_amount: number;
  total_amount: number;
};

type Group = {
  partner_id: string | null;
  partner_name: string;
  rows: VatRow[] | null;
  totalAmount: number;
  totalVat: number;
};

export function BulkInvoiceForm({ groups }: { groups: Group[] }) {
  const router = useRouter();
  const [arAccount, setArAccount] = useState<string>("");
  const [incomeAccount, setIncomeAccount] = useState<string>("");
  const [vatAccount, setVatAccount] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  const [selected, setSelected] = useState<Map<string, Set<string>>>(new Map());

  function toggleAll(groupKey: string, rowIds: string[]) {
    setSelected((s) => {
      const next = new Map(s);
      const cur = next.get(groupKey) ?? new Set();
      if (cur.size === rowIds.length) {
        next.delete(groupKey);
      } else {
        next.set(groupKey, new Set(rowIds));
      }
      return next;
    });
  }
  function toggleRow(groupKey: string, id: string) {
    setSelected((s) => {
      const next = new Map(s);
      const cur = new Set(next.get(groupKey) ?? []);
      if (cur.has(id)) cur.delete(id);
      else cur.add(id);
      next.set(groupKey, cur);
      return next;
    });
  }

  async function runGroup(g: Group, groupKey: string) {
    const ids = Array.from(selected.get(groupKey) ?? []);
    if (!ids.length) return;
    if (!g.partner_id) {
      setResult("⚠ Партнергүй бүлэгт нэхэмжлэл үүсгэх боломжгүй — Тулгаагүй хуудаснаас тулга");
      return;
    }
    if (!arAccount || !incomeAccount || !vatAccount) {
      setResult("⚠ Авлага, Орлого, НӨАТ дансыг сонгоно уу");
      return;
    }
    setResult(null);
    startTransition(async () => {
      const r = await bulkMakeInvoices(ids, g.partner_id!, arAccount, incomeAccount, vatAccount);
      if (r.error) {
        setResult(`⚠ ${r.error}`);
      } else {
        setResult(r.success ?? "Бэлэн");
        if (r.data && r.data.failed > 0) {
          setResult(`${r.success} · Алдаа: ${r.data.errors.join("; ")}`);
        }
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Тогтоох дансууд</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Авлагын данс (Dr)</label>
            <AccountPicker name="ar" filterType="asset" onChange={(o) => setArAccount(o?.id ?? "")} placeholder="1210..." />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Орлогын данс (Cr)</label>
            <AccountPicker name="income" filterType="income" onChange={(o) => setIncomeAccount(o?.id ?? "")} placeholder="6110..." />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">НӨАТ-ын данс (Cr)</label>
            <AccountPicker name="vat" filterType="liability" onChange={(o) => setVatAccount(o?.id ?? "")} placeholder="2143..." />
          </div>
        </div>
        {result && (
          <div className={`text-xs px-3 py-2 rounded ${result.startsWith("⚠") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
            {result}
          </div>
        )}
      </div>

      {groups.map((g) => {
        const key = `g_${g.partner_id ?? g.partner_name}`;
        const rows = g.rows ?? [];
        const allSelected = (selected.get(key)?.size ?? 0) === rows.length && rows.length > 0;
        const someSelected = (selected.get(key)?.size ?? 0) > 0;

        return (
          <div key={key} className="bg-white border border-slate-200 rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => toggleAll(key, rows.map((r) => r.id))}
                  className="rounded"
                />
                <div>
                  <div className="text-sm font-medium">{g.partner_name}</div>
                  <div className="text-xs text-slate-500">
                    {rows.length} бичлэг · Үнэ <span className="font-mono">{fmtMoney(g.totalAmount)}</span> · НӨАТ <span className="font-mono">{fmtMoney(g.totalVat)}</span>
                  </div>
                </div>
              </div>
              {g.partner_id ? (
                <button
                  onClick={() => runGroup(g, key)}
                  disabled={pending || !someSelected}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
                >
                  {pending ? "..." : `Үүсгэх (${selected.get(key)?.size ?? 0})`}
                </button>
              ) : (
                <Badge color="bg-yellow-100 text-yellow-800">Партнер тулгах</Badge>
              )}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 w-8"></th>
                  <th className="px-3 py-2 text-left">Огноо</th>
                  <th className="px-3 py-2 text-left">ДДТД</th>
                  <th className="px-3 py-2 text-right">Үнэ</th>
                  <th className="px-3 py-2 text-right">НӨАТ</th>
                  <th className="px-3 py-2 text-right">Нийт</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={selected.get(key)?.has(r.id) ?? false}
                        onChange={() => toggleRow(key, r.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-xs">{fmtDate(r.date)}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{r.ddtd || r.invoice_no || "—"}</td>
                    <td className="px-3 py-1.5 font-mono text-right text-xs">{fmtMoney(r.amount)}</td>
                    <td className="px-3 py-1.5 font-mono text-right text-xs text-slate-500">{fmtMoney(r.vat_amount)}</td>
                    <td className="px-3 py-1.5 font-mono text-right text-xs font-semibold">{fmtMoney(r.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {groups.length === 0 && (
        <div className="bg-white border border-slate-200 rounded p-8 text-center text-sm text-slate-500">
          Бэлэн НӨАТ бичлэг алга
        </div>
      )}
    </div>
  );
}

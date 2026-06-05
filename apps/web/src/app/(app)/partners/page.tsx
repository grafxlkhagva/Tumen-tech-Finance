import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/supabase/company";
import Link from "next/link";
import { Users, Plus, Search, X } from "lucide-react";
import { ToastFromURL } from "@/components/ui/Toast";
import { PartnersTable, type PartnerRow } from "./PartnersTable";

export const metadata = { title: "Харилцагчийн бүртгэл — Тумэн Accounting" };

type SearchParams = Promise<{ type?: string; q?: string }>;

export default async function PartnersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const selType = sp.type === "customer" || sp.type === "supplier" ? sp.type : "";
  const q = (sp.q ?? "").trim().slice(0, 100);

  const supabase = await createClient();
  const company = await getCurrentCompany(supabase);

  if (!company) {
    return (
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-2xl font-semibold flex items-center gap-2 mb-4">
          <Users className="w-6 h-6" /> Харилцагчийн бүртгэл
        </h1>
        <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-900">
          Байгууллага сонгогдоогүй байна.
        </div>
      </div>
    );
  }

  let pq = supabase
    .from("partners")
    .select("id, code, name, register, type, phone")
    .eq("company_id", company.companyId)
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("name")
    .limit(500);

  if (selType === "customer") pq = pq.or("type.eq.customer,type.eq.both");
  else if (selType === "supplier") pq = pq.or("type.eq.supplier,type.eq.both");
  if (q) pq = pq.or(`name.ilike.%${q}%,code.ilike.%${q}%,register.ilike.%${q}%`);

  const [partnersRes, cashRes] = await Promise.all([
    pq,
    supabase.rpc("fn_partner_cash_totals", { p_company_id: company.companyId }),
  ]);

  const partnersData = partnersRes.data ?? [];
  const cashMap = new Map<string, { income: number; expense: number }>();
  for (const r of (cashRes.data ?? []) as Array<{ partner_id: string; income: number; expense: number }>) {
    cashMap.set(r.partner_id, { income: Number(r.income) || 0, expense: Number(r.expense) || 0 });
  }

  const rows: PartnerRow[] = partnersData.map((p) => {
    const c = cashMap.get(p.id);
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      register: p.register,
      phone: p.phone,
      type: p.type,
      income: c?.income ?? 0,
      expense: c?.expense ?? 0,
    };
  });

  const tabHref = (type: string) => {
    const u = new URLSearchParams();
    if (type) u.set("type", type);
    if (q) u.set("q", q);
    const s = u.toString();
    return `/partners${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-3 max-w-[1500px] mx-auto">
      <ToastFromURL />

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <Users className="w-6 h-6" /> Харилцагчийн бүртгэл
        </h1>
        <Link
          href="/partners/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Харилцагч нэмэх
        </Link>
      </div>

      {/* Filter: type tabs + search */}
      <div className="bg-white border border-slate-200 rounded p-2 flex flex-wrap items-center gap-2 print:hidden">
        <div className="inline-flex rounded border border-slate-300 overflow-hidden text-xs">
          <Link href={tabHref("")} className={`px-3 py-1 border-r border-slate-200 ${!selType ? "bg-slate-700 text-white" : "text-slate-700 hover:bg-slate-50"}`}>
            Бүгд <span className={`ml-1 px-1.5 py-0.5 rounded text-[0.65rem] ${!selType ? "bg-white/25" : "bg-slate-100"}`}>{rows.length}</span>
          </Link>
          <Link href={tabHref("customer")} className={`px-3 py-1 border-r border-slate-200 ${selType === "customer" ? "bg-emerald-600 text-white" : "text-emerald-700 hover:bg-emerald-50"}`}>
            Авлагатай
          </Link>
          <Link href={tabHref("supplier")} className={`px-3 py-1 ${selType === "supplier" ? "bg-amber-500 text-white" : "text-amber-700 hover:bg-amber-50"}`}>
            Өглөгтэй
          </Link>
        </div>

        <form method="GET" className="flex items-center gap-1">
          {selType && <input type="hidden" name="type" value={selType} />}
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Нэр / код / регистр хайх…"
              maxLength={100}
              autoComplete="off"
              className="pl-6 pr-2 py-1 border border-slate-300 rounded text-xs w-[260px]"
            />
          </div>
          <button type="submit" className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs">
            <Search className="w-3 h-3" />
          </button>
          {q && (
            <Link href={tabHref(selType)} className="px-1.5 py-1 border border-red-300 text-red-700 rounded text-xs hover:bg-red-50">
              <X className="w-3 h-3" />
            </Link>
          )}
        </form>
      </div>

      <PartnersTable rows={rows} />
    </div>
  );
}

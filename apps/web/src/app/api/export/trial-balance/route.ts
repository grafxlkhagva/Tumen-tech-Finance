import { createClient } from "@/lib/supabase/server";
import { buildXlsxResponse } from "@/lib/xlsx-helpers";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_trial_balance")
    .select("code, name, type, debit_balance, credit_balance")
    .order("code");

  const rows: (string | number | null)[][] = [
    ["Код", "Дансны нэр", "Төрөл", "Дебит", "Кредит"],
    ...(data ?? []).map((r) => [
      r.code ?? "", r.name ?? "", r.type ?? "",
      Number(r.debit_balance ?? 0), Number(r.credit_balance ?? 0),
    ]),
  ];

  const totalDr = (data ?? []).reduce((s, r) => s + Number(r.debit_balance ?? 0), 0);
  const totalCr = (data ?? []).reduce((s, r) => s + Number(r.credit_balance ?? 0), 0);
  rows.push([], ["", "НИЙТ", "", totalDr, totalCr]);

  return buildXlsxResponse(`trial-balance-${new Date().toISOString().slice(0, 10)}.xlsx`, [
    { name: "Шалгах баланс", data: rows },
  ]);
}

import { createClient } from "@/lib/supabase/server";
import { buildXlsxResponse } from "@/lib/xlsx-helpers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  const supabase = await createClient();

  let q = supabase
    .from("cash_transactions")
    .select("txn_date, direction, amount, description, partner_name, category, bank:bank_accounts(name), contra_account:accounts!cash_transactions_contra_account_id_fkey(code, name)")
    .is("deleted_at", null)
    .order("txn_date", { ascending: false });

  if (month) {
    const [y, m] = month.split("-").map(Number);
    if (y && m) {
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      q = q.gte("txn_date", start).lt("txn_date", end);
    }
  }

  const { data } = await q.limit(20000);

  const rows: (string | number | null)[][] = [
    ["Огноо", "Чиглэл", "Дүн", "Тайлбар", "Партнер", "Категори", "Банк", "Контр данс"],
    ...(data ?? []).map((r) => {
      const bank = Array.isArray(r.bank) ? r.bank[0] : r.bank;
      const ca = Array.isArray(r.contra_account) ? r.contra_account[0] : r.contra_account;
      return [
        r.txn_date ?? "",
        r.direction === "income" ? "Орлого" : "Зарлага",
        Number(r.amount ?? 0),
        r.description ?? "",
        r.partner_name ?? "",
        r.category ?? "",
        bank?.name ?? "",
        ca ? `${ca.code} ${ca.name}` : "",
      ];
    }),
  ];

  return buildXlsxResponse(`cash-${new Date().toISOString().slice(0, 10)}.xlsx`, [
    { name: "Банкны хуулга", data: rows },
  ]);
}

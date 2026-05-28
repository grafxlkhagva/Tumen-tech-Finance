import { createClient } from "@/lib/supabase/server";
import { buildXlsxResponse } from "@/lib/xlsx-helpers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const supabase = await createClient();

  let q = supabase
    .from("journals")
    .select("number, date, reference, description, status, source, total_debit, total_credit")
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .limit(10000);
  if (status) q = q.eq("status", status as "draft" | "posted" | "reversed");

  const { data } = await q;

  const rows: (string | number | null)[][] = [
    ["Дугаар", "Огноо", "Лавлагаа", "Тайлбар", "Статус", "Эх сурвалж", "Дебит", "Кредит"],
    ...(data ?? []).map((j) => [
      j.number ?? "", j.date ?? "", j.reference ?? "", j.description ?? "",
      j.status ?? "", j.source ?? "",
      Number(j.total_debit ?? 0), Number(j.total_credit ?? 0),
    ]),
  ];

  return buildXlsxResponse(`journals-${new Date().toISOString().slice(0, 10)}.xlsx`, [
    { name: "Журналууд", data: rows },
  ]);
}

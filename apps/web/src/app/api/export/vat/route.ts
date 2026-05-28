import { createClient } from "@/lib/supabase/server";
import { buildXlsxResponse } from "@/lib/xlsx-helpers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const direction = url.searchParams.get("direction");
  const month = url.searchParams.get("month");
  const supabase = await createClient();

  let q = supabase
    .from("vat_records")
    .select("date, direction, tax_type, ddtd, invoice_no, partner_name, partner_register, amount, vat_amount, total_amount, paid_amount, status, source")
    .is("deleted_at", null)
    .order("date", { ascending: false });

  if (direction && ["inbound", "outbound"].includes(direction)) {
    q = q.eq("direction", direction as "inbound" | "outbound");
  }
  if (month) {
    const [y, m] = month.split("-").map(Number);
    if (y && m) {
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      q = q.gte("date", start).lt("date", end);
    }
  }

  const { data } = await q.limit(20000);

  const rows: (string | number | null)[][] = [
    ["Огноо", "Чиглэл", "Татварын төрөл", "ДДТД", "Нэхэмж №", "Партнер", "Регистр", "Дүн", "НӨАТ", "Нийт", "Төлсөн", "Статус", "Эх сурвалж"],
    ...(data ?? []).map((v) => [
      v.date ?? "", v.direction ?? "", v.tax_type ?? "",
      v.ddtd ?? "", v.invoice_no ?? "",
      v.partner_name ?? "", v.partner_register ?? "",
      Number(v.amount ?? 0), Number(v.vat_amount ?? 0), Number(v.total_amount ?? 0),
      Number(v.paid_amount ?? 0), v.status ?? "", v.source ?? "",
    ]),
  ];

  return buildXlsxResponse(`vat-${new Date().toISOString().slice(0, 10)}.xlsx`, [
    { name: "НӨАТ", data: rows },
  ]);
}

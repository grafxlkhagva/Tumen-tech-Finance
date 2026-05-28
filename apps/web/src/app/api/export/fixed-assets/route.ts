import { createClient } from "@/lib/supabase/server";
import { buildXlsxResponse } from "@/lib/xlsx-helpers";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_fixed_asset_register")
    .select("*")
    .order("code");

  const rows: (string | number | null)[][] = [
    ["Код", "Нэр", "Ангилал", "Огноо", "Анхны үнэ", "Ашиглалт (сар)", "Үлдэгдэл үнэ", "Хуримтлагдсан элэгдэл", "Цэвэр үлдэгдэл", "Сарын элэгдэл", "Статус"],
    ...(data ?? []).map((a) => [
      a.code ?? "", a.name ?? "", a.category ?? "", a.purchase_date ?? "",
      Number(a.purchase_amount ?? 0), Number(a.useful_life_months ?? 0),
      Number(a.salvage_value ?? 0), Number(a.accumulated_depreciation ?? 0),
      Number(a.net_book_value ?? 0), Number(a.monthly_depreciation ?? 0),
      a.status ?? "",
    ]),
  ];

  return buildXlsxResponse(`fixed-assets-${new Date().toISOString().slice(0, 10)}.xlsx`, [
    { name: "Үндсэн хөрөнгө", data: rows },
  ]);
}

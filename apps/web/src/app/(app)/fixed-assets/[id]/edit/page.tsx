import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { AssetForm } from "../../_components/AssetForm";
import { upsertAsset } from "../../actions";

export const metadata = { title: "Хөрөнгө засах — Тумэн Accounting" };

type RouteParams = Promise<{ id: string }>;

export default async function EditAssetPage({ params }: { params: RouteParams }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("fixed_assets")
    .select("*, asset_account:accounts!fixed_assets_asset_account_id_fkey(code, name), depreciation_account:accounts!fixed_assets_depreciation_account_id_fkey(code, name), expense_account:accounts!fixed_assets_expense_account_id_fkey(code, name)")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const aacc = Array.isArray(data.asset_account) ? data.asset_account[0] : data.asset_account;
  const dacc = Array.isArray(data.depreciation_account) ? data.depreciation_account[0] : data.depreciation_account;
  const eacc = Array.isArray(data.expense_account) ? data.expense_account[0] : data.expense_account;

  return (
    <AssetForm
      mode="edit"
      initialData={{
        ...data,
        asset_account_label: aacc ? `${aacc.code} ${aacc.name}` : null,
        depreciation_account_label: dacc ? `${dacc.code} ${dacc.name}` : null,
        expense_account_label: eacc ? `${eacc.code} ${eacc.name}` : null,
      }}
      action={upsertAsset.bind(null, id)}
    />
  );
}

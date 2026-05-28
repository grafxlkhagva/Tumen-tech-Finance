import { AssetForm } from "../_components/AssetForm";
import { upsertAsset } from "../actions";

export const metadata = { title: "Шинэ үндсэн хөрөнгө — Тумэн Accounting" };

export default function NewAssetPage() {
  return <AssetForm mode="create" action={upsertAsset.bind(null, null)} />;
}

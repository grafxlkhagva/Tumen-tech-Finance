import ForgotForm from "./ForgotForm";

export const metadata = { title: "Нууц үг сэргээх — Тумэн Accounting" };

type SearchParams = Promise<{ flash?: string; type?: string }>;

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { flash, type } = await searchParams;
  return <ForgotForm flash={flash} flashType={type} />;
}

import LoginForm from "./LoginForm";

export const metadata = {
  title: "Нэвтрэх — Тумэн Accounting",
};

type SearchParams = Promise<{ next?: string; flash?: string; type?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { next, flash, type } = await searchParams;
  return <LoginForm next={next || "/"} flash={flash} flashType={type} />;
}

import LoginForm from "./LoginForm";

export const metadata = {
  title: "Нэвтрэх — Тумэн Accounting",
};

type SearchParams = Promise<{ next?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { next } = await searchParams;
  return <LoginForm next={next || "/"} />;
}

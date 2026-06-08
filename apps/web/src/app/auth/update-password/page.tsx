import UpdatePasswordForm from "./UpdatePasswordForm";

export const metadata = { title: "Шинэ нууц үг — Тумэн Accounting" };

// No server-side session guard here: the recovery token may arrive in the URL
// hash, which never reaches the server. The client component detects it.
export default function UpdatePasswordPage() {
  return <UpdatePasswordForm />;
}

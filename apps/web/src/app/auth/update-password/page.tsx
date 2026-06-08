import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import UpdatePasswordForm from "./UpdatePasswordForm";

export const metadata = { title: "Шинэ нууц үг — Тумэн Accounting" };

export default async function UpdatePasswordPage() {
  // The /auth/callback route must have set a (recovery) session before we get
  // here. If there's no session the link was invalid/expired — bounce to the
  // forgot page so the user can request a fresh link.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login/forgot?flash=${encodeURIComponent("Холбоос хүчингүй эсвэл хугацаа дууссан. Дахин оролдоно уу.")}&type=error`);
  }

  return <UpdatePasswordForm />;
}

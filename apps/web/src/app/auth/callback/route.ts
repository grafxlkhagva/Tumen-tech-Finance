import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Auth callback — exchanges the `code` from a Supabase email link (password
 * recovery, magic link, email confirmation) for a session cookie, then
 * forwards to `next`. Used by the forgot-password flow:
 *   email link → /auth/callback?code=…&next=/auth/update-password
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") || "/";
  // Only allow internal redirects.
  const next = nextParam.startsWith("/") ? nextParam : "/";

  if (!code) {
    return NextResponse.redirect(
      new URL(`/login?flash=${encodeURIComponent("Холбоос хүчингүй байна.")}&type=error`, url.origin),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/login?flash=${encodeURIComponent("Сэргээх холбоосын хугацаа дууссан эсвэл хүчингүй байна.")}&type=error`,
        url.origin,
      ),
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}

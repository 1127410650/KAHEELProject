// Server-only public self-sign-up for the PUBLIC MARKETPLACE only.
//
// Scope is deliberately narrow:
//  - it creates a plain marketplace user (individual): no workspace, no role,
//    no permission, no membership. Internal system accounts (accountant /
//    supervisor / employee) still come from an invitation or an administrator.
//  - the browser supplies the email; it is normalised and rate limited.
//  - the response never reveals whether an email already exists.
import { passwordPolicyError } from "@/lib/password-policy";
import { normalizeMobile } from "@/lib/register.server";

export interface PublicSignupInput {
  full_name: string;
  email: string;
  phone?: string;
  password: string;
}

export type PublicSignupResult =
  | { ok: true }
  | { ok: false; error: "RATE_LIMITED" | "INVALID" | "WEAK_PASSWORD" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export async function publicSignupImpl(
  input: PublicSignupInput,
  clientKey: string,
): Promise<PublicSignupResult> {
  const fullName = (input.full_name ?? "").trim();
  const email = (input.email ?? "").trim().toLowerCase();
  const password = input.password ?? "";

  if (fullName.length < 3 || fullName.length > 120) return { ok: false, error: "INVALID" };
  if (!EMAIL_RE.test(email) || email.length > 200) return { ok: false, error: "INVALID" };
  if (passwordPolicyError(password)) return { ok: false, error: "WEAK_PASSWORD" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: ipOk } = await supabaseAdmin.rpc("rate_limit_hit", {
    _bucket: "public_signup_ip",
    _key: clientKey,
    _limit: 5,
    _window: "01:00:00",
  });
  if (ipOk === false) return { ok: false, error: "RATE_LIMITED" };

  const { data: emailOk } = await supabaseAdmin.rpc("rate_limit_hit", {
    _bucket: "public_signup_email",
    _key: email,
    _limit: 3,
    _window: "01:00:00",
  });
  if (emailOk === false) return { ok: false, error: "RATE_LIMITED" };

  const created = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone: normalizeMobile(input.phone ?? ""),
    },
  });

  if (created.error || !created.data.user) {
    const weak = /password/i.test(created.error?.message ?? "");
    // Any other failure (most often "already registered") returns the same
    // success-shaped answer, so the endpoint cannot be used to probe emails.
    return weak ? { ok: false, error: "WEAK_PASSWORD" } : { ok: true };
  }

  await supabaseAdmin
    .from("profiles")
    .update({
      full_name: fullName,
      phone: normalizeMobile(input.phone ?? "") || null,
    })
    .eq("user_id", created.data.user.id);

  return { ok: true };
}

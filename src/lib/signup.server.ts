// Server-only public self-sign-up for the PUBLIC MARKETPLACE only.
//
// Scope is deliberately narrow:
//  - it creates a plain marketplace user (individual): no workspace, no role,
//    no permission, no membership. Internal system accounts (accountant /
//    supervisor / employee) still come from an invitation or an administrator.
//  - the phone is the required public identifier; a private deterministic Auth
//    email keeps password authentication working until the user verifies a real
//    email from account completion.
//  - the response never reveals whether a phone or email already exists.
import { createHash } from "crypto";

import { passwordPolicyError } from "@/lib/password-policy";
import { normalizeMobile } from "@/lib/register.server";

export interface PublicSignupInput {
  full_name: string;
  email?: string;
  phone: string;
  password: string;
}

export type PublicSignupResult =
  | { ok: true }
  | { ok: false; error: "RATE_LIMITED" | "INVALID" | "WEAK_PASSWORD" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const PHONE_RE = /^\+[1-9][0-9]{7,14}$/;

interface ServiceRpcClient {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ error: { message?: string } | null }>;
}

export async function publicSignupImpl(
  input: PublicSignupInput,
  clientKey: string,
): Promise<PublicSignupResult> {
  const fullName = (input.full_name ?? "").trim();
  const contactEmail = (input.email ?? "").trim().toLowerCase();
  const phone = normalizeMobile(input.phone ?? "");
  const password = input.password ?? "";

  if (fullName.length < 2 || fullName.length > 80) return { ok: false, error: "INVALID" };
  if (!PHONE_RE.test(phone)) return { ok: false, error: "INVALID" };
  if (contactEmail && (!EMAIL_RE.test(contactEmail) || contactEmail.length > 200)) {
    return { ok: false, error: "INVALID" };
  }
  if (passwordPolicyError(password)) return { ok: false, error: "WEAK_PASSWORD" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: ipOk } = await supabaseAdmin.rpc("rate_limit_hit", {
    _bucket: "public_signup_ip",
    _key: clientKey,
    _limit: 5,
    _window: "01:00:00",
  });
  if (ipOk === false) return { ok: false, error: "RATE_LIMITED" };

  const { data: phoneOk } = await supabaseAdmin.rpc("rate_limit_hit", {
    _bucket: "public_signup_phone",
    _key: phone,
    _limit: 3,
    _window: "01:00:00",
  });
  if (phoneOk === false) return { ok: false, error: "RATE_LIMITED" };

  if (contactEmail) {
    const { data: emailOk } = await supabaseAdmin.rpc("rate_limit_hit", {
      _bucket: "public_signup_email",
      _key: contactEmail,
      _limit: 3,
      _window: "01:00:00",
    });
    if (emailOk === false) return { ok: false, error: "RATE_LIMITED" };
  }

  const alias = createHash("sha256").update(phone).digest("hex").slice(0, 32);
  const authEmail = `phone-${alias}@accounts.kahli.invalid`;

  const created = await supabaseAdmin.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone,
      contact_email: contactEmail || null,
      signup_identifier: "phone",
    },
  });

  if (created.error || !created.data.user) {
    const weak = /password/i.test(created.error?.message ?? "");
    // Any other failure (most often an existing phone alias) returns the same
    // success-shaped answer, so this endpoint cannot probe registered accounts.
    return weak ? { ok: false, error: "WEAK_PASSWORD" } : { ok: true };
  }

  const rpc = supabaseAdmin as unknown as ServiceRpcClient;
  await rpc.rpc("profile_seed_public_signup", {
    _user_id: created.data.user.id,
    _name: fullName,
    _email: contactEmail,
    _phone: phone,
  });

  return { ok: true };
}

// Server-only account creation. INVITE ONLY: there is no public sign-up in Tahqaq.
// The email always comes from the invitation row, never from the browser.
import { createHash } from "crypto";

import { passwordPolicyError } from "@/lib/password-policy";

/** Syria-mode normalisation: keep digits and store local mobile numbers as +9639XXXXXXXX. */
export function normalizeMobile(raw: string): string {
  const cleaned = (raw ?? "").replace(/[^\d+]/g, "").replace(/^00/, "+");
  const digits = cleaned.replace(/^\+/, "");
  if (!digits) return "";
  if (digits.startsWith("963")) return `+${digits}`;
  if (digits.startsWith("0")) return `+963${digits.slice(1)}`;
  if (digits.startsWith("9") && digits.length === 9) return `+963${digits}`;
  return `+${digits}`;
}

export interface RegisterInput {
  full_name: string;
  phone: string;
  national_id?: string;
  password: string;
  origin: string;
  /** Mandatory: account creation is only possible through a live invitation. */
  invite_token: string;
}

export type RegisterResult =
  | { ok: true; needsConfirmation: boolean }
  | {
      ok: false;
      error: "RATE_LIMITED" | "INVALID" | "WEAK_PASSWORD" | "INVITE_REQUIRED" | "INVITE_INVALID";
    };

export async function registerAccountImpl(
  input: RegisterInput,
  clientKey: string,
): Promise<RegisterResult> {
  const token = (input.invite_token ?? "").trim();
  if (!/^[a-f0-9]{16,128}$/i.test(token)) return { ok: false, error: "INVITE_REQUIRED" };

  const fullName = (input.full_name ?? "").trim();
  const password = input.password ?? "";
  if (fullName.length < 3) return { ok: false, error: "INVALID" };
  if (passwordPolicyError(password)) return { ok: false, error: "WEAK_PASSWORD" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Rate limit before touching the invitation table.
  const { data: ipOk } = await supabaseAdmin.rpc("rate_limit_hit", {
    _bucket: "signup_ip",
    _key: clientKey,
    _limit: 5,
    _window: "01:00:00",
  });
  if (ipOk === false) return { ok: false, error: "RATE_LIMITED" };

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data: invite } = await supabaseAdmin
    .from("tenant_invitations")
    .select("id, email, status, expires_at, tenant_id")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (
    !invite ||
    invite.status !== "pending" ||
    !invite.expires_at ||
    Date.parse(invite.expires_at) <= Date.now()
  ) {
    return { ok: false, error: "INVITE_INVALID" };
  }

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("status, deleted_at")
    .eq("id", invite.tenant_id)
    .maybeSingle();
  if (!tenant || tenant.status !== "active" || tenant.deleted_at) {
    return { ok: false, error: "INVITE_INVALID" };
  }

  // The email is the invitation's email. A browser cannot substitute another one.
  const email = invite.email.trim().toLowerCase();
  const { data: emailOk } = await supabaseAdmin.rpc("rate_limit_hit", {
    _bucket: "signup_email",
    _key: email,
    _limit: 3,
    _window: "01:00:00",
  });
  if (emailOk === false) return { ok: false, error: "RATE_LIMITED" };

  // Account creation goes through the Auth Admin API on the server, so public
  // sign-up stays disabled in Auth entirely. The invitation was emailed to this
  // address, which is what confirms ownership.
  const created = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone: normalizeMobile(input.phone ?? ""),
      national_id: (input.national_id ?? "").trim() || null,
    },
  });

  // Never disclose whether the email already exists.
  if (created.error || !created.data.user) {
    const weak = /password/i.test(created.error?.message ?? "");
    return weak ? { ok: false, error: "WEAK_PASSWORD" } : { ok: true, needsConfirmation: false };
  }

  // Keep the phone/national id on the profile row created by the signup trigger.
  // No workspace is created here: membership comes from invitation_accept only.
  await supabaseAdmin
    .from("profiles")
    .update({
      full_name: fullName,
      phone: normalizeMobile(input.phone ?? "") || null,
      national_id: (input.national_id ?? "").trim() || null,
    })
    .eq("user_id", created.data.user.id);

  return { ok: true, needsConfirmation: false };
}

/**
 * Server-only phone sign-in with a one-time code (Syria-first flow).
 *
 * Delivery providers are pluggable and DISABLED until their secrets exist:
 *  - WhatsApp Cloud API → WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID
 *  - SMS (Twilio or a local gateway) → TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM
 *
 * When no provider is configured, `requestOtpImpl` reports
 * `PROVIDER_UNCONFIGURED` and NO code is created — the flow is visibly off
 * instead of pretending to work.
 *
 * Security: codes are stored only as a salted SHA-256 hash, expire in minutes,
 * allow a limited number of attempts, and every send is rate limited per phone
 * and per client key through `rate_limit_hit`.
 */
import { createHash, randomInt, timingSafeEqual } from "crypto";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { resolveMarketIso2ByPhone } from "@/lib/market-scope.server";

/** Code lifetime and attempt budget. */
export const OTP_TTL_MINUTES = 5;
export const OTP_MAX_ATTEMPTS = 5;

export type OtpChannel = "whatsapp" | "sms";

export interface ProviderStatus {
  whatsapp: boolean;
  sms: boolean;
}

export function providerStatusImpl(): ProviderStatus {
  return {
    whatsapp: !!(process.env["WHATSAPP_TOKEN"] && process.env["WHATSAPP_PHONE_NUMBER_ID"]),
    sms: !!(
      process.env["TWILIO_ACCOUNT_SID"] &&
      process.env["TWILIO_AUTH_TOKEN"] &&
      process.env["TWILIO_FROM"]
    ),
  };
}

function hashCode(phone: string, code: string): string {
  const pepper = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "kaheel";
  return createHash("sha256").update(`${phone}:${code}:${pepper}`).digest("hex");
}

function equalHash(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function sendWhatsApp(phone: string, code: string): Promise<boolean> {
  const token = process.env["WHATSAPP_TOKEN"];
  const from = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  const template = process.env["WHATSAPP_OTP_TEMPLATE"] ?? "";
  if (!token || !from) return false;
  const body = template
    ? {
        messaging_product: "whatsapp",
        to: phone.replace("+", ""),
        type: "template",
        template: {
          name: template,
          language: { code: "ar" },
          components: [{ type: "body", parameters: [{ type: "text", text: code }] }],
        },
      }
    : {
        messaging_product: "whatsapp",
        to: phone.replace("+", ""),
        type: "text",
        text: { body: `كَحيل — رمز الدخول: ${code}` },
      };
  const response = await fetch(`https://graph.facebook.com/v20.0/${from}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.ok;
}

async function sendSms(phone: string, code: string): Promise<boolean> {
  const sid = process.env["TWILIO_ACCOUNT_SID"];
  const token = process.env["TWILIO_AUTH_TOKEN"];
  const from = process.env["TWILIO_FROM"];
  if (!sid || !token || !from) return false;
  const params = new URLSearchParams({ To: phone, From: from, Body: `Kaheel code: ${code}` });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  return response.ok;
}

export type RequestOtpResult =
  | { ok: true; channel: OtpChannel; expires_in_minutes: number }
  | { ok: false; error: "INVALID_PHONE" | "RATE_LIMITED" | "PROVIDER_UNCONFIGURED" | "SEND_FAILED" };

export async function requestOtpImpl(
  phone: string,
  preferred: OtpChannel,
  clientKey: string,
): Promise<RequestOtpResult> {
  if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) return { ok: false, error: "INVALID_PHONE" };

  const status = providerStatusImpl();
  const channel: OtpChannel | null = status[preferred]
    ? preferred
    : status.whatsapp
      ? "whatsapp"
      : status.sms
        ? "sms"
        : null;
  if (!channel) return { ok: false, error: "PROVIDER_UNCONFIGURED" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: phoneOk } = await supabaseAdmin.rpc("rate_limit_hit", {
    _bucket: "otp_phone",
    _key: phone,
    _limit: 5,
    _window: "01:00:00",
  });
  if (phoneOk === false) return { ok: false, error: "RATE_LIMITED" };
  const { data: ipOk } = await supabaseAdmin.rpc("rate_limit_hit", {
    _bucket: "otp_ip",
    _key: clientKey,
    _limit: 15,
    _window: "01:00:00",
  });
  if (ipOk === false) return { ok: false, error: "RATE_LIMITED" };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const sent = channel === "whatsapp" ? await sendWhatsApp(phone, code) : await sendSms(phone, code);
  if (!sent) return { ok: false, error: "SEND_FAILED" };

  // Older live codes for this phone become unusable as soon as a new one is sent.
  await supabaseAdmin
    .from("mkt_login_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("phone", phone)
    .is("consumed_at", null);

  await supabaseAdmin.from("mkt_login_otps").insert({
    phone,
    channel,
    code_hash: hashCode(phone, code),
    expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString(),
    max_attempts: OTP_MAX_ATTEMPTS,
    delivered: true,
    provider: channel === "whatsapp" ? "whatsapp_cloud_api" : "sms_gateway",
    request_key: clientKey.slice(0, 120),
  });

  return { ok: true, channel, expires_in_minutes: OTP_TTL_MINUTES };
}

export type VerifyOtpResult =
  | { ok: true; access_token: string; refresh_token: string; created: boolean }
  | { ok: false; error: "INVALID_CODE" | "EXPIRED" | "TOO_MANY_ATTEMPTS" | "SIGN_IN_FAILED" };

function publishableClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(
          typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
        );
        if (init?.headers)
          new Headers(init.headers).forEach((value, name) => headers.set(name, value));
        if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/** Stable private Auth alias for a phone-only account; never shown to anyone. */
function phoneAlias(phone: string): string {
  return `p${phone.replace(/\D/g, "")}@phone.kaheel.local`;
}

export async function verifyOtpImpl(
  phone: string,
  code: string,
  fullName: string,
): Promise<VerifyOtpResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const digits = (code ?? "").replace(/\D/g, "");
  if (digits.length !== 6) return { ok: false, error: "INVALID_CODE" };

  const { data: row } = await supabaseAdmin
    .from("mkt_login_otps")
    .select("id, code_hash, expires_at, attempts, max_attempts, consumed_at")
    .eq("phone", phone)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return { ok: false, error: "EXPIRED" };
  if (Date.parse(row.expires_at) <= Date.now()) return { ok: false, error: "EXPIRED" };
  if (row.attempts >= row.max_attempts) return { ok: false, error: "TOO_MANY_ATTEMPTS" };

  if (!equalHash(row.code_hash, hashCode(phone, digits))) {
    await supabaseAdmin
      .from("mkt_login_otps")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    return { ok: false, error: row.attempts + 1 >= row.max_attempts ? "TOO_MANY_ATTEMPTS" : "INVALID_CODE" };
  }

  await supabaseAdmin
    .from("mkt_login_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);

  // Resolve (or create) the account that owns this phone.
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("user_id, is_active")
    .eq("phone", phone)
    .limit(1)
    .maybeSingle();

  let userId = profile?.user_id ?? null;
  let created = false;
  if (profile && profile.is_active === false) return { ok: false, error: "SIGN_IN_FAILED" };

  if (!userId) {
    const signUp = await supabaseAdmin.auth.admin.createUser({
      email: phoneAlias(phone),
      email_confirm: true,
      password: crypto.randomUUID(),
      user_metadata: {
        full_name: (fullName ?? "").trim() || phone,
        phone,
        market_country_iso2: await resolveMarketIso2ByPhone(phone),
      },
    });
    if (signUp.error || !signUp.data.user) return { ok: false, error: "SIGN_IN_FAILED" };
    userId = signUp.data.user.id;
    created = true;
    await supabaseAdmin.from("profiles").update({ phone }).eq("user_id", userId);
  }

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = authUser.user?.email;
  if (!email) return { ok: false, error: "SIGN_IN_FAILED" };

  // The proof of identity was the code. Rotate to a fresh single-use password
  // and immediately exchange it for the official Supabase session.
  const oneTime = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const updated = await supabaseAdmin.auth.admin.updateUserById(userId, { password: oneTime });
  if (updated.error) return { ok: false, error: "SIGN_IN_FAILED" };

  const auth = publishableClient();
  const { data: session, error } = await auth.auth.signInWithPassword({
    email,
    password: oneTime,
  });
  if (error || !session.session) return { ok: false, error: "SIGN_IN_FAILED" };

  return {
    ok: true,
    access_token: session.session.access_token,
    refresh_token: session.session.refresh_token,
    created,
  };
}

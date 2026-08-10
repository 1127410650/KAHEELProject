/**
 * Server-only phone sign-in with a one-time code.
 *
 * التوجيه كله في محوّل المزوّدين (`otp-providers.server.ts`): هذا الملف لا يعرف
 * أي مزوّد ولا أي مفتاح دولة. الأرقام السورية تُخدم بـ SMS محلي، وغير السورية
 * بواتساب أو بالبريد، والقنوات تُفعّل من لوحة الإدارة.
 *
 * Security: الكود يُخزّن كبصمة SHA-256 مملّحة، ينتهي خلال ٥ دقائق، ٣ محاولات
 * إدخال كحد أقصى، منع إعادة إرسال قبل ٦٠ ثانية، وحدود لكل رقم ولكل IP
 * (ساعة ويوم) عبر `rate_limit_hit` — كل رسالة تكلّف مالًا.
 */
import { createHash, randomInt, timingSafeEqual } from "crypto";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { resolveMarketIso2ByPhone } from "@/lib/market-scope.server";
import { sendEmailOtpImpl } from "@/lib/otp-email.server";
import {
  channelsFor,
  hashPhone,
  loadChannelConfig,
  providerConfigured,
  routeFor,
  sendOtp,
  type OtpChannel,
} from "@/lib/otp-providers.server";

/** Code lifetime, attempt budget and resend cooldown. */
export const OTP_TTL_MINUTES = 5;
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_RESEND_SECONDS = 60;

export type { OtpChannel };

export interface ProviderStatus {
  /** القنوات القابلة للإرسال فعلًا (قناة مفعّلة + مفاتيح مزوّد موجودة). */
  sms: boolean;
  whatsapp: boolean;
  email: boolean;
  providers: { channel: string; provider: string; enabled: boolean; configured: boolean }[];
}

export async function providerStatusImpl(): Promise<ProviderStatus> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const config = await loadChannelConfig(supabaseAdmin);
  const live = (channel: OtpChannel) =>
    config.some((row) => row.channel === channel && row.is_enabled && providerConfigured(row.provider));
  return {
    sms: live("sms"),
    whatsapp: live("whatsapp"),
    email: live("email"),
    providers: config.map((row) => ({
      channel: row.channel,
      provider: row.provider,
      enabled: row.is_enabled,
      configured: providerConfigured(row.provider),
    })),
  };
}

/** القنوات المتاحة لرقم معيّن (لعرضها في الواجهة). */
export async function channelsForPhoneImpl(phone: string): Promise<OtpChannel[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return channelsFor(phone, await loadChannelConfig(supabaseAdmin));
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

export type RequestOtpResult =
  | {
      ok: true;
      channel: OtpChannel;
      expires_in_minutes: number;
      resend_after_seconds: number;
      /** البريد المقنّع حين يكون التسليم عبر البريد. */
      target_masked?: string;
    }
  | {
      ok: false;
      error:
        | "INVALID_PHONE"
        | "RATE_LIMITED"
        | "COOLDOWN"
        | "PROVIDER_UNCONFIGURED"
        | "SEND_FAILED"
        | "EMAIL_SEND_FAILED";
      retry_after_seconds?: number;
    };

export async function requestOtpImpl(
  phone: string,
  preferred: OtpChannel | null,
  clientKey: string,
  email?: string | null,
): Promise<RequestOtpResult> {
  if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) return { ok: false, error: "INVALID_PHONE" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const countryIso2 = await resolveMarketIso2ByPhone(phone);
  const trimmedEmail = (email ?? "").trim();

  // البريد قناة أساسية حين لا توجد أي قناة جوال قابلة للإرسال فعلًا:
  // لا نحاول قناة معطّلة لتفشل، بل نرسل مباشرة إلى البريد.
  const config = await loadChannelConfig(supabaseAdmin);
  const phoneChannelsLive = routeFor(phone, config).length > 0;
  if (!phoneChannelsLive && trimmedEmail) {
    const sent = await sendEmailOtpImpl({
      email: trimmedEmail,
      phone,
      fullName: "",
      countryIso2,
      clientKey,
    });
    if (sent.ok)
      return {
        ok: true,
        channel: "email",
        expires_in_minutes: OTP_TTL_MINUTES,
        resend_after_seconds: OTP_RESEND_SECONDS,
        target_masked: sent.masked,
      };
    return {
      ok: false,
      error:
        sent.error === "COOLDOWN"
          ? "COOLDOWN"
          : sent.error === "RATE_LIMITED"
            ? "RATE_LIMITED"
            : "EMAIL_SEND_FAILED",
      retry_after_seconds: sent.retry_after_seconds,
    };
  }

  // منع إعادة الإرسال قبل ٦٠ ثانية: أحدث سطر لهذا الرقم يحدد الانتظار.
  const { data: recent } = await supabaseAdmin
    .from("mkt_otp_sends")
    .select("created_at")
    .eq("phone_hash", hashPhone(phone))
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent) {
    const elapsed = (Date.now() - Date.parse(recent.created_at)) / 1000;
    if (elapsed < OTP_RESEND_SECONDS)
      return {
        ok: false,
        error: "COOLDOWN",
        retry_after_seconds: Math.ceil(OTP_RESEND_SECONDS - elapsed),
      };
  }

  // حدود صارمة: لكل رقم ولكل عميل، بالساعة وباليوم.
  const limits: { bucket: string; key: string; limit: number; window: string }[] = [
    { bucket: "otp_phone_hour", key: phone, limit: 3, window: "01:00:00" },
    { bucket: "otp_phone_day", key: phone, limit: 8, window: "24:00:00" },
    { bucket: "otp_ip_hour", key: clientKey, limit: 10, window: "01:00:00" },
    { bucket: "otp_ip_day", key: clientKey, limit: 30, window: "24:00:00" },
  ];
  for (const rule of limits) {
    const { data: allowed } = await supabaseAdmin.rpc("rate_limit_hit", {
      _bucket: rule.bucket,
      _key: rule.key,
      _limit: rule.limit,
      _window: rule.window,
    });
    if (allowed === false) return { ok: false, error: "RATE_LIMITED" };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const outcome = await sendOtp(supabaseAdmin, {
    phone,
    code,
    countryIso2,
    idempotencyKey: `${hashPhone(phone).slice(0, 24)}:${Date.now()}`,
    preferred,
  });

  if (!outcome.ok) {
    // فشل الجوال (قناة معطّلة أو مزوّد أخفق) → البريد تلقائيًا بلا إعادة محاولة.
    if (trimmedEmail) {
      const sent = await sendEmailOtpImpl({
        email: trimmedEmail,
        phone,
        fullName: "",
        countryIso2,
        clientKey,
        attempt: 2,
      });
      if (sent.ok)
        return {
          ok: true,
          channel: "email",
          expires_in_minutes: OTP_TTL_MINUTES,
          resend_after_seconds: OTP_RESEND_SECONDS,
          target_masked: sent.masked,
        };
    }
    return {
      ok: false,
      error: outcome.status === "unconfigured" ? "PROVIDER_UNCONFIGURED" : "SEND_FAILED",
    };
  }

  // Older live codes for this phone become unusable as soon as a new one is sent.
  await supabaseAdmin
    .from("mkt_login_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("phone", phone)
    .is("consumed_at", null);

  await supabaseAdmin.from("mkt_login_otps").insert({
    phone,
    channel: outcome.channel,
    code_hash: hashCode(phone, code),
    expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString(),
    max_attempts: OTP_MAX_ATTEMPTS,
    delivered: true,
    provider: outcome.provider,
    request_key: clientKey.slice(0, 120),
  });

  return {
    ok: true,
    channel: outcome.channel,
    expires_in_minutes: OTP_TTL_MINUTES,
    resend_after_seconds: OTP_RESEND_SECONDS,
  };
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

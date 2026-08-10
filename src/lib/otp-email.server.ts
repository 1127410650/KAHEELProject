/**
 * قناة البريد الإلكتروني لكود الدخول — قناة مضمونة بلا مزوّد خارجي.
 *
 * لماذا مسار خادمي وليس `supabase.auth.signInWithOtp` من المتصفح؟
 * التسجيل الذاتي معطّل على مستوى Supabase Auth (`signup_disabled`)، فطلب
 * المتصفح بـ `shouldCreateUser: true` يفشل 422 لكل بريد جديد. هنا نضمن وجود
 * الحساب أولًا بمفتاح الخدمة (يتجاوز تعطيل التسجيل)، ثم نطلب من Supabase
 * إرسال رمز البريد المدمج لحساب موجود — بلا مفاتيح ولا مزوّد إضافي.
 *
 * كل محاولة إرسال تُسجّل في `mkt_otp_sends` (القناة، النجاح/الفشل، السبب).
 */
import { createHash } from "crypto";

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

export const OTP_EMAIL_RESEND_SECONDS = 60;

export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.trim().toLowerCase().split("@");
  const head = user.slice(0, Math.min(4, Math.max(1, user.length - 1)));
  return `${head}***@${domain}`;
}

/** بصمة البريد — نفس أسلوب بصمة الهاتف، لا نخزّن البريد في سجل الإرسال. */
export function hashEmail(email: string): string {
  const pepper = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "kaheel";
  return createHash("sha256").update(`${email.trim().toLowerCase()}:${pepper}`).digest("hex");
}

export type EmailOtpFailure =
  | "INVALID_EMAIL"
  | "COOLDOWN"
  | "RATE_LIMITED"
  | "EMAIL_SEND_FAILED";

export interface EmailOtpArgs {
  email: string;
  phone: string | null;
  fullName: string;
  countryIso2: string | null;
  clientKey: string;
  /** رقم المحاولة في السجل (٢ حين يكون البريد احتياطيًا بعد فشل الجوال). */
  attempt?: number;
}

export type EmailOtpResult =
  | { ok: true; masked: string }
  | { ok: false; error: EmailOtpFailure; retry_after_seconds?: number };

async function logSend(
  admin: AdminClient,
  args: EmailOtpArgs,
  status: "sent" | "failed",
  detail: { errorCode?: string; errorDetail?: string } = {},
): Promise<void> {
  await admin.from("mkt_otp_sends").insert({
    phone_masked: maskEmail(args.email),
    phone_hash: hashEmail(args.email),
    country_iso2: args.countryIso2,
    dial_code: null,
    channel: "email",
    provider: "supabase_email",
    status,
    error_code: detail.errorCode ?? null,
    error_detail: detail.errorDetail ?? null,
    attempt: args.attempt ?? 1,
    cost_amount: 0,
    currency_code: "USD",
    idempotency_key: `email:${hashEmail(args.email).slice(0, 24)}:${Date.now()}`,
  });
}

/** يضمن وجود حساب بهذا البريد رغم تعطيل التسجيل الذاتي في Supabase Auth. */
async function ensureUser(admin: AdminClient, args: EmailOtpArgs): Promise<void> {
  const created = await admin.auth.admin.createUser({
    email: args.email.trim().toLowerCase(),
    email_confirm: true,
    password: crypto.randomUUID(),
    user_metadata: {
      full_name: args.fullName.trim() || args.email.trim(),
      ...(args.phone ? { phone: args.phone, phone_e164: args.phone } : {}),
      ...(args.countryIso2 ? { market_country_iso2: args.countryIso2 } : {}),
    },
  });
  // بريد موجود مسبقًا = الحالة الطبيعية لتسجيل دخول متكرر، لا خطأ.
  if (created.error && !/already|exists|registered/i.test(created.error.message)) {
    throw new Error(created.error.message);
  }
}

/**
 * يطلب من Supabase إرسال رمز البريد المدمج لحساب موجود (`create_user:false`).
 * يعود بالبريد المقنّع لعرضه للمستخدم: «أرسلنا الرمز إلى a-ww***@hotmail.com».
 */
export async function sendEmailOtpImpl(args: EmailOtpArgs): Promise<EmailOtpResult> {
  const email = args.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: "INVALID_EMAIL" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // منع إعادة الإرسال قبل ٦٠ ثانية لنفس البريد.
  const { data: recent } = await supabaseAdmin
    .from("mkt_otp_sends")
    .select("created_at")
    .eq("phone_hash", hashEmail(email))
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent) {
    const elapsed = (Date.now() - Date.parse(recent.created_at)) / 1000;
    if (elapsed < OTP_EMAIL_RESEND_SECONDS)
      return {
        ok: false,
        error: "COOLDOWN",
        retry_after_seconds: Math.ceil(OTP_EMAIL_RESEND_SECONDS - elapsed),
      };
  }

  const limits = [
    { bucket: "otp_email_hour", key: email, limit: 5, window: "01:00:00" },
    { bucket: "otp_email_day", key: email, limit: 12, window: "24:00:00" },
    { bucket: "otp_ip_hour", key: args.clientKey, limit: 10, window: "01:00:00" },
    { bucket: "otp_ip_day", key: args.clientKey, limit: 30, window: "24:00:00" },
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

  const payload = { ...args, email };
  try {
    await ensureUser(supabaseAdmin, payload);
  } catch (error) {
    await logSend(supabaseAdmin, payload, "failed", {
      errorCode: "ENSURE_USER",
      errorDetail: error instanceof Error ? error.message.slice(0, 400) : "unknown",
    });
    return { ok: false, error: "EMAIL_SEND_FAILED" };
  }

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    await logSend(supabaseAdmin, payload, "failed", { errorCode: "NO_CONFIG" });
    return { ok: false, error: "EMAIL_SEND_FAILED" };
  }

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/otp`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ email, create_user: false }),
    });
    if (!response.ok) {
      const text = await response.text();
      await logSend(supabaseAdmin, payload, "failed", {
        errorCode: `HTTP_${response.status}`,
        errorDetail: text.slice(0, 400),
      });
      return { ok: false, error: "EMAIL_SEND_FAILED" };
    }
  } catch (error) {
    await logSend(supabaseAdmin, payload, "failed", {
      errorCode: "NETWORK",
      errorDetail: error instanceof Error ? error.message.slice(0, 400) : "unknown",
    });
    return { ok: false, error: "EMAIL_SEND_FAILED" };
  }

  await logSend(supabaseAdmin, payload, "sent");
  return { ok: true, masked: maskEmail(email) };
}

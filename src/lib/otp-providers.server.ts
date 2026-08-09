/**
 * محوّل مزوّدي إرسال كود الدخول (provider adapter).
 *
 * القاعدة المعمارية: منطق التسجيل لا يعرف أي مزوّد. يسأل هذا الملف
 * «إلى أي قناة يذهب هذا الرقم؟» ويستقبل نتيجة موحّدة. تبديل المزوّد أو إضافة
 * غيره = صف في `mkt_otp_channels` + دالة إرسال هنا، بلا لمس تسجيل الدخول.
 *
 * حقيقة موثّقة تحكم التوجيه: واتساب (Meta Cloud API) لا يخدم سوريا —
 * مستخدمو واتساب في سوريا غير مؤهلين لرسائل المنصة. لذلك الأرقام +963
 * تذهب إلى SMS محلي (LinkSyria) حصرًا، ولا تُجرَّب واتساب لها أبدًا.
 */
import { createHash } from "crypto";

import type { OtpChannel } from "@/lib/otp-channels";

export type { OtpChannel };

export interface ChannelConfig {
  id: string;
  channel: OtpChannel;
  provider: string;
  label_ar: string;
  label_en: string;
  dial_codes: string[];
  is_fallback: boolean;
  is_enabled: boolean;
  priority: number;
  cost_per_message: number;
  currency_code: string;
}

export interface SendOutcome {
  ok: boolean;
  channel: OtpChannel;
  provider: string;
  status: "sent" | "failed" | "unconfigured";
  messageId?: string | null;
  errorCode?: string;
  errorDetail?: string;
}

/** واتساب ممنوع لهذه المفاتيح (غير مدعوم من المنصة). */
const WHATSAPP_BLOCKED_DIALS = ["963"];

/** هل مفاتيح المزوّد موجودة في الأسرار؟ */
export function providerConfigured(provider: string): boolean {
  switch (provider) {
    case "linksyria":
      return !!process.env["LINKSYRIA_API_KEY"];
    case "twilio":
      return !!(
        process.env["TWILIO_ACCOUNT_SID"] &&
        process.env["TWILIO_AUTH_TOKEN"] &&
        process.env["TWILIO_FROM"]
      );
    case "whatsapp_cloud":
      return !!(process.env["WHATSAPP_TOKEN"] && process.env["WHATSAPP_PHONE_NUMBER_ID"]);
    case "supabase_email":
      return true;
    default:
      return false;
  }
}

export function dialOf(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  // أطول تطابق أولًا: مفاتيح من ٤ إلى رقم واحد.
  return digits.slice(0, 3);
}

export function maskPhone(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  return `+${digits.slice(0, 5)}****${digits.slice(-2)}`;
}

export function hashPhone(phoneE164: string): string {
  const pepper = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "kaheel";
  return createHash("sha256").update(`${phoneE164}:${pepper}`).digest("hex");
}

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

export async function loadChannelConfig(admin: AdminClient): Promise<ChannelConfig[]> {
  const { data } = await admin
    .from("mkt_otp_channels")
    .select(
      "id, channel, provider, label_ar, label_en, dial_codes, is_fallback, is_enabled, priority, cost_per_message, currency_code",
    )
    .order("priority");
  return (data ?? []).map((row) => ({
    ...row,
    channel: row.channel as OtpChannel,
    dial_codes: row.dial_codes ?? [],
    cost_per_message: Number(row.cost_per_message ?? 0),
  }));
}

/**
 * ترتيب المرشحين لرقم معيّن: المزوّدون المخصّصون لمفتاح الدولة أولًا، ثم
 * الاحتياطيون. تُستبعد القنوات المعطّلة والمزوّدون بلا مفاتيح، ويُستبعد واتساب
 * للمفاتيح غير المدعومة.
 */
export function routeFor(phoneE164: string, config: ChannelConfig[]): ChannelConfig[] {
  const dial = dialOf(phoneE164);
  const usable = config.filter(
    (row) =>
      row.is_enabled &&
      providerConfigured(row.provider) &&
      !(row.channel === "whatsapp" && WHATSAPP_BLOCKED_DIALS.includes(dial)),
  );
  const exact = usable.filter((row) => row.dial_codes.includes(dial));
  const fallback = usable.filter((row) => row.is_fallback && !row.dial_codes.includes(dial));
  // القنوات المخصّصة للمفتاح حصرية: إن وُجدت، لا نتسرّب لقناة عامة.
  const chosen = exact.length > 0 ? exact : fallback;
  return chosen
    .filter((row) => row.channel !== "email") // البريد يُدار في مسار Supabase Email، لا هنا.
    .sort((a, b) => a.priority - b.priority);
}

/** قنوات الرقم كما تُعرض للمستخدم (تشمل البريد كخيار مضمون خارج سوريا). */
export function channelsFor(phoneE164: string, config: ChannelConfig[]): OtpChannel[] {
  const dial = dialOf(phoneE164);
  const enabled = config.filter((row) => row.is_enabled);
  const exact = enabled.filter((row) => row.dial_codes.includes(dial));
  const list = exact.length > 0 ? exact : enabled.filter((row) => row.is_fallback);
  return [
    ...new Set(
      list
        .filter((row) => !(row.channel === "whatsapp" && WHATSAPP_BLOCKED_DIALS.includes(dial)))
        .map((row) => row.channel),
    ),
  ];
}

async function sendViaLinkSyria(phone: string, code: string, idempotencyKey: string): Promise<SendOutcome> {
  const apiKey = process.env["LINKSYRIA_API_KEY"];
  const base = process.env["LINKSYRIA_BASE_URL"] ?? "https://api.linksyria.online";
  const sender = process.env["LINKSYRIA_SENDER_ID"] ?? "KAHEEL";
  const template = process.env["LINKSYRIA_OTP_TEMPLATE"] ?? "";
  const base_out: SendOutcome = { ok: false, channel: "sms", provider: "linksyria", status: "failed" };
  if (!apiKey) return { ...base_out, status: "unconfigured", errorCode: "NO_API_KEY" };

  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/v1/sms/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // منع الرسائل المكرّرة إن أعادت الشبكة المحاولة.
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        to: phone,
        sender,
        template_id: template || undefined,
        variables: { code },
        text: `كَحيل: رمز الدخول ${code} — صالح ${5} دقائق.`,
      }),
    });
    const text = await response.text();
    if (!response.ok) {
      return { ...base_out, errorCode: `HTTP_${response.status}`, errorDetail: text.slice(0, 400) };
    }
    let messageId: string | null = null;
    try {
      messageId = (JSON.parse(text) as { id?: string; message_id?: string }).id ?? null;
    } catch {
      messageId = null;
    }
    return { ok: true, channel: "sms", provider: "linksyria", status: "sent", messageId };
  } catch (error) {
    return {
      ...base_out,
      errorCode: "NETWORK",
      errorDetail: error instanceof Error ? error.message.slice(0, 400) : "unknown",
    };
  }
}

async function sendViaTwilio(phone: string, code: string): Promise<SendOutcome> {
  const sid = process.env["TWILIO_ACCOUNT_SID"];
  const token = process.env["TWILIO_AUTH_TOKEN"];
  const from = process.env["TWILIO_FROM"];
  const out: SendOutcome = { ok: false, channel: "sms", provider: "twilio", status: "failed" };
  if (!sid || !token || !from) return { ...out, status: "unconfigured", errorCode: "NO_KEYS" };
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: phone, From: from, Body: `Kaheel code: ${code}` }).toString(),
    });
    const text = await response.text();
    if (!response.ok) return { ...out, errorCode: `HTTP_${response.status}`, errorDetail: text.slice(0, 400) };
    return { ok: true, channel: "sms", provider: "twilio", status: "sent" };
  } catch (error) {
    return { ...out, errorCode: "NETWORK", errorDetail: error instanceof Error ? error.message : "unknown" };
  }
}

async function sendViaWhatsApp(phone: string, code: string): Promise<SendOutcome> {
  const token = process.env["WHATSAPP_TOKEN"];
  const from = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  const template = process.env["WHATSAPP_OTP_TEMPLATE"] ?? "";
  const out: SendOutcome = { ok: false, channel: "whatsapp", provider: "whatsapp_cloud", status: "failed" };
  if (!token || !from) return { ...out, status: "unconfigured", errorCode: "NO_KEYS" };
  const payload = template
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
  try {
    const response = await fetch(`https://graph.facebook.com/v20.0/${from}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    if (!response.ok) return { ...out, errorCode: `HTTP_${response.status}`, errorDetail: text.slice(0, 400) };
    let messageId: string | null = null;
    try {
      messageId =
        (JSON.parse(text) as { messages?: { id?: string }[] }).messages?.[0]?.id ?? null;
    } catch {
      messageId = null;
    }
    return { ok: true, channel: "whatsapp", provider: "whatsapp_cloud", status: "sent", messageId };
  } catch (error) {
    return { ...out, errorCode: "NETWORK", errorDetail: error instanceof Error ? error.message : "unknown" };
  }
}

async function dispatch(
  row: ChannelConfig,
  phone: string,
  code: string,
  idempotencyKey: string,
): Promise<SendOutcome> {
  switch (row.provider) {
    case "linksyria":
      return sendViaLinkSyria(phone, code, idempotencyKey);
    case "twilio":
      return sendViaTwilio(phone, code);
    case "whatsapp_cloud":
      return sendViaWhatsApp(phone, code);
    default:
      return {
        ok: false,
        channel: row.channel,
        provider: row.provider,
        status: "unconfigured",
        errorCode: "UNKNOWN_PROVIDER",
      };
  }
}

export interface SendOtpArgs {
  phone: string;
  code: string;
  countryIso2: string | null;
  idempotencyKey: string;
  preferred?: OtpChannel | null;
}

/**
 * واجهة موحّدة: تختار القناة والمزوّد حسب مفتاح الدولة، تجرّب المرشحين
 * بالترتيب، وتسجّل كل محاولة في `mkt_otp_sends` (لمن ومتى والحالة والتكلفة).
 */
export async function sendOtp(admin: AdminClient, args: SendOtpArgs): Promise<SendOutcome> {
  const config = await loadChannelConfig(admin);
  let candidates = routeFor(args.phone, config);
  if (args.preferred) {
    const wanted = candidates.filter((row) => row.channel === args.preferred);
    candidates = [...wanted, ...candidates.filter((row) => row.channel !== args.preferred)];
  }
  if (candidates.length === 0) {
    return {
      ok: false,
      channel: "sms",
      provider: "none",
      status: "unconfigured",
      errorCode: "NO_CHANNEL",
    };
  }

  const masked = maskPhone(args.phone);
  const phoneHash = hashPhone(args.phone);
  const dial = dialOf(args.phone);
  let last: SendOutcome | null = null;

  for (const [index, row] of candidates.entries()) {
    const key = `${args.idempotencyKey}:${row.provider}`;
    const outcome = await dispatch(row, args.phone, args.code, key);
    last = outcome;
    await admin.from("mkt_otp_sends").insert({
      phone_masked: masked,
      phone_hash: phoneHash,
      country_iso2: args.countryIso2,
      dial_code: dial,
      channel: outcome.channel,
      provider: outcome.provider,
      status: outcome.status,
      provider_message_id: outcome.messageId ?? null,
      error_code: outcome.errorCode ?? null,
      error_detail: outcome.errorDetail ?? null,
      attempt: index + 1,
      cost_amount: outcome.ok ? row.cost_per_message : 0,
      currency_code: row.currency_code,
      idempotency_key: key,
    });
    if (outcome.ok) return outcome;
  }

  return last!;
}

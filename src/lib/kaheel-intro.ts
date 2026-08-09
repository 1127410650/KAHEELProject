/**
 * Platform introduction kit.
 *
 * Any outreach to a directory entity must carry TWO things: the platform
 * address and the introduction PDF. They are appended by `outreachMessage`
 * itself — not by the caller — so no screen can ship a message without them.
 */
import { SITE_ORIGIN, canonicalUrl } from "@/lib/share-links";

/** Storage path inside the approved `mkt-media` bucket. */
export const INTRO_PDF_STORAGE_PATH = "public/kaheel-intro.pdf";

/** Stable public address of the introduction PDF (no key, no expiry). */
export const INTRO_PDF_URL = canonicalUrl("/api/public/kaheel-intro.pdf");

export const PLATFORM_URL = SITE_ORIGIN;

/** The mandatory tail of every outreach message. */
export function outreachSignature(): string {
  return [
    `رابط المنصة: ${PLATFORM_URL}`,
    `ملف التعريف بالمنصة (PDF): ${INTRO_PDF_URL}`,
  ].join("\n");
}

/**
 * A respectful introduction + invitation to activate a free page.
 *
 * It deliberately never claims a booking, an appointment or a prior
 * arrangement with the entity.
 */
export function outreachMessage(options: { name?: string | null; city?: string | null }): string {
  const name = (options.name ?? "").trim();
  const city = (options.city ?? "").trim();
  const greeting = name ? `السلام عليكم، ${name}` : "السلام عليكم";
  const place = city ? ` في ${city}` : "";

  return [
    greeting,
    "",
    `معكم فريق منصة «كَحيل» — منصة عامة تجمع الجهات والمتاجر ومزوّدي الخدمات، ويصل إليها الزوّار للتعرّف عليهم والتواصل معهم مباشرة.`,
    `وجدنا جهتكم${place} مدرجة في دليل كَحيل، ونودّ تعريفكم بالمنصة ودعوتكم لتفعيل صفحتكم عليها مجانًا:`,
    "• صفحة تعريفية بجهتكم (النشاط، العنوان، أوقات العمل، وسائل التواصل).",
    "• استقبال طلبات العملاء وطلبات عروض الأسعار.",
    "• إمكانية توصيل الطلبات عبر كابتن كَحيل.",
    "• إعلانات مدفوعة اختيارية لمن يرغب بانتشار أوسع.",
    "",
    "تفعيل الصفحة الأساسية مجاني بالكامل، ولا يوجد أي التزام. أرفقنا لكم ملفًا تعريفيًا موجزًا:",
    outreachSignature(),
    "",
    "وإن لم يكن الأمر مناسبًا، نعتذر عن الإزعاج ولن نكرّر التواصل. شكرًا لوقتكم.",
  ].join("\n");
}

/** WhatsApp deep link carrying the ready message, for one entity at a time. */
export function outreachWhatsappHref(
  phoneOrLink: string | null,
  message: string,
): string | null {
  const text = encodeURIComponent(message);
  if (!phoneOrLink) return null;
  if (/^https?:\/\//.test(phoneOrLink)) {
    const url = new URL(phoneOrLink);
    url.searchParams.set("text", message);
    return url.toString();
  }
  const digits = phoneOrLink.replace(/[^\d]/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}?text=${text}` : null;
}

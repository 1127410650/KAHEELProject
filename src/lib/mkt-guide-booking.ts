/**
 * Booking intents + entity invitation text for the Syria directory.
 *
 * Two boundaries matter here:
 * 1) «كَحيل مواعيد» is a separate platform with its own database. Nothing in
 *    this file writes to it. A click only records an *intent* row inside this
 *    project (`mkt_guide_booking_intents`).
 * 2) Nothing is ever sent automatically. The WhatsApp deep link is returned to
 *    the caller and only opens because a human pressed the button.
 */
import { supabase } from "@/integrations/supabase/client";
import { canonicalUrl } from "@/lib/share-links";
import { PLATFORM_URL } from "@/lib/kaheel-intro";
import type { GuidePlace } from "@/lib/mkt-guide-places";

export const SIGNUP_URL = canonicalUrl("/auth");

/** Fallback text; the admin-editable version lives in platform settings. */
export const DEFAULT_INVITE_TEMPLATE = [
  "مرحبًا {name} 👋",
  "منصة كَحيل — سوق سوريا الإلكتروني — عارضة صفحتكم مجانًا ضمن دليل سوريا.",
  "سجّلوا حسابكم لتديروا صفحتكم، وتستقبلوا طلبات الحجز والتواصل مباشرة، وتضيفوا صوركم وعروضكم.",
  "التسجيل مجاني: {signup_url}",
].join("\n");

/** The admin-editable invitation template, with a safe fallback. */
export async function inviteTemplate(): Promise<string> {
  const { data } = await supabase
    .from("mkt_platform_settings")
    .select("value")
    .eq("key", "guide_invite_message")
    .maybeSingle();
  const value = (data?.value ?? null) as { template?: string } | null;
  const template = (value?.template ?? "").trim();
  return template || DEFAULT_INVITE_TEMPLATE;
}

/** Fill the invitation placeholders for one entity. */
export function renderInvite(
  template: string,
  place: { name_ar: string; city?: string | null },
): string {
  return template
    .replaceAll("{name}", place.name_ar)
    .replaceAll("{city}", place.city ?? "")
    .replaceAll("{signup_url}", SIGNUP_URL)
    .replaceAll("{platform_url}", PLATFORM_URL);
}

/** The pre-filled booking request the visitor sends to the entity. */
export function bookingMessage(place: { name_ar: string }): string {
  return `مرحبًا، أريد حجز موعد لدى ${place.name_ar} — وصلتكم عبر منصة كَحيل`;
}

/** WhatsApp deep link for a number or an existing wa.me link. */
export function whatsappWithText(phoneOrLink: string | null, message: string): string | null {
  if (!phoneOrLink) return null;
  if (/^https?:\/\//.test(phoneOrLink)) {
    const url = new URL(phoneOrLink);
    url.searchParams.set("text", message);
    return url.toString();
  }
  const digits = phoneOrLink.replace(/[^\d]/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
}

/** True once an owner claim for this entity has been approved by the admins. */
export async function isClaimed(placeId: string): Promise<boolean> {
  const { data } = await supabase
    .from("mkt_guide_place_claims")
    .select("id")
    .eq("place_id", placeId)
    .eq("status", "approved")
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/** Record one booking intent. Anonymous visitors are recorded without an id. */
export async function recordBookingIntent(input: {
  place: GuidePlace;
  channel: "whatsapp" | "internal";
  ownerClaimed: boolean;
  requestedAt?: string | null;
  note?: string | null;
}): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  await supabase.from("mkt_guide_booking_intents").insert({
    place_id: input.place.id,
    place_slug: input.place.slug,
    place_name: input.place.name_ar,
    requester_id: session.session?.user.id ?? null,
    channel: input.channel,
    owner_claimed: input.ownerClaimed,
    requested_at: input.requestedAt ?? null,
    note: input.note ?? null,
  });
}

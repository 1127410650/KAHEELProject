import { Link } from "@tanstack/react-router";
import { ExternalLink, Globe, MapPin, MessageCircle, Phone, ShieldCheck, Info, Clock, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  directionsHref,
  isOpenStreetMap,
  isVerified,
  sourceHref,
  sourceLabel,

  websiteHref,
  whatsappHref,
  type GuidePlace,
} from "@/lib/mkt-guide-places";
import { outreachMessage, outreachWhatsappHref } from "@/lib/kaheel-intro";
import { inviteTemplate, renderInvite, whatsappWithText } from "@/lib/mkt-guide-booking";
import {
  isWithinCooldown,
  lastOutreach,
  recordOutreach,
  type OutreachRecord,
} from "@/lib/mkt-guide-outreach";



/** No source imagery is rendered anywhere — rights are unverified by design. */
export function GuidePlaceBadges({ place }: { place: GuidePlace }) {
  if (isOpenStreetMap(place)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/45 bg-gold-soft px-2.5 py-1 text-[10px] font-black text-gold-foreground">
        <Info className="size-3.5" aria-hidden />
        معلومات أولية — ساعدنا في التحقق
      </span>
    );
  }
  if (isVerified(place)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success-soft px-2.5 py-1 text-[10px] font-black text-success-strong">
        <ShieldCheck className="size-3.5" aria-hidden />
        موثّق
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-black text-muted-foreground">
      <Info className="size-3.5" aria-hidden />
      بانتظار التحقق
    </span>
  );
}

export function GuidePlaceActions({ place }: { place: GuidePlace }) {
  const directions = directionsHref(place);
  const site = websiteHref(place);
  const phone = (place.phone ?? "").replace(/[^\d+]/g, "");

  /**
   * The invitation text is built here, so the WhatsApp button and the share
   * button can never open a message without the platform link and the intro
   * PDF link — both are appended by `outreachMessage` itself.
   */
  const message = outreachMessage({ name: place.name_ar, city: place.city });
  const rawWhatsapp = place.whatsapp_link || place.whatsapp || null;
  const whatsapp = outreachWhatsappHref(rawWhatsapp, message) ?? whatsappHref(place);

  const [previous, setPrevious] = useState<OutreachRecord | null>(null);
  useEffect(() => {
    let alive = true;
    void lastOutreach(place.slug).then((row) => {
      if (alive) setPrevious(row);
    });
    return () => {
      alive = false;
    };
  }, [place.slug]);

  const contacted = isWithinCooldown(previous);

  const log = (channel: "whatsapp" | "share") => {
    void recordOutreach({ placeId: place.id, placeSlug: place.slug, channel }).then(() =>
      setPrevious({ channel, created_at: new Date().toISOString() }),
    );
  };

  /**
   * «مشاركة الدعوة» opens WhatsApp with the admin-editable invitation text for
   * this one entity. Nothing is sent automatically — the deep link only opens
   * because a human pressed the button. Without a number it falls back to the
   * share sheet / clipboard.
   */
  const share = async () => {
    const invite = renderInvite(await inviteTemplate(), place);
    const link = whatsappWithText(rawWhatsapp || place.phone, invite);
    if (link) {
      window.open(link, "_blank", "noopener,noreferrer");
      log("share");
      return;
    }
    const nav =
      typeof navigator === "undefined"
        ? null
        : (navigator as Navigator & { share?: (data: { title?: string; text?: string }) => Promise<void> });
    if (!nav) return;
    try {
      if (typeof nav.share === "function") {
        await nav.share({ title: "منصة كَحيل", text: invite });
      } else {
        await nav.clipboard.writeText(invite);
        toast.success("تم نسخ نص الدعوة مع رابط التسجيل");
      }
      log("share");
    } catch {
      /* the visitor dismissed the share sheet — nothing to record */
    }
  };


  const base =
    "k-press inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-primary/25 bg-card px-3 py-2 text-[11px] font-black hover:border-primary/50 hover:bg-primary/6 hover:text-primary";

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        {directions ? (
          <a className={base} href={directions} target="_blank" rel="noreferrer noopener">
            <MapPin className="size-3.5" aria-hidden />
            الاتجاهات
          </a>
        ) : null}
        {site ? (
          <a className={base} href={site} target="_blank" rel="noreferrer noopener">
            <Globe className="size-3.5" aria-hidden />
            الموقع الإلكتروني
          </a>
        ) : null}
        {whatsapp ? (
          <a
            className={base}
            href={whatsapp}
            target="_blank"
            rel="noreferrer noopener"
            onClick={() => log("whatsapp")}
          >
            <MessageCircle className="size-3.5" aria-hidden />
            واتساب
          </a>
        ) : null}
        {phone.length >= 6 ? (
          <a className={base} href={`tel:${phone}`}>
            <Phone className="size-3.5" aria-hidden />
            اتصال
          </a>
        ) : null}
        <button type="button" className={base} onClick={() => void share()}>
          <Share2 className="size-3.5" aria-hidden />
          مشاركة الدعوة
        </button>
      </div>
      {contacted ? (
        <p className="text-[10px] font-bold text-gold-dark">
          تم التواصل مع هذه الجهة سابقًا — يُفضّل عدم تكرار المراسلة.
        </p>
      ) : null}
    </div>
  );
}


export function GuidePlaceCard({ place }: { place: GuidePlace }) {
  const location = [place.district, place.city, place.governorate].filter(Boolean).join(" · ");
  const source = sourceLabel(place);
  const distance = formatDistance(place.distanceM, "ar");
  const href = sourceHref(place);



  return (
    <article className="k-surface k-lift flex h-full flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/guides/syria/$slug"
            params={{ slug: place.slug }}
            className="line-clamp-2 text-sm font-black text-foreground hover:text-market-navy sm:text-base"
          >
            {place.name_ar}
          </Link>
          {place.subcategory || place.category ? (
            <p className="mt-1 text-[11px] font-bold text-market-navy-soft">
              {place.subcategory || place.category}
            </p>
          ) : null}
        </div>
        <GuidePlaceBadges place={place} />
      </div>

      {location || distance ? (
        <p className="flex items-start gap-1.5 text-[11px] leading-6 text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="line-clamp-2">{place.address || location}</span>
          {distance ? (
            <span className="num ms-auto shrink-0 self-start rounded-full bg-primary/10 px-1.5 font-bold text-primary">
              {distance}
            </span>
          ) : null}
        </p>
      ) : null}


      {place.opening_hours ? (
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
          <Clock className="size-3.5" aria-hidden />
          {place.opening_hours}
        </p>
      ) : null}

      <div className="mt-auto space-y-2.5">
        <GuidePlaceActions place={place} />
        <Link
          to="/guides/syria/$slug"
          params={{ slug: place.slug }}
          className="inline-flex items-center gap-1.5 text-[11px] font-black text-market-navy"
        >
          التفاصيل
          <ExternalLink className="size-3.5" aria-hidden />
        </Link>
        {source ? (
          <p className="border-t border-border/60 pt-2 text-[10px] font-normal leading-4 text-muted-foreground/80">
            المصدر:{" "}
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener nofollow"
                className="underline decoration-dotted underline-offset-2 hover:text-market-navy"
              >
                {source}
              </a>
            ) : (
              source
            )}
          </p>
        ) : null}

      </div>

    </article>
  );
}

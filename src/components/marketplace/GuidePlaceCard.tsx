import { Link } from "@tanstack/react-router";
import { ExternalLink, Globe, MapPin, MessageCircle, Phone, ShieldCheck, Info, Clock } from "lucide-react";

import {
  directionsHref,
  isOpenStreetMap,
  isVerified,
  websiteHref,
  whatsappHref,
  type GuidePlace,
} from "@/lib/mkt-guide-places";

/** No source imagery is rendered anywhere — rights are unverified by design. */
export function GuidePlaceBadges({ place }: { place: GuidePlace }) {
  if (isOpenStreetMap(place)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-800">
        <Info className="size-3.5" aria-hidden />
        معلومات أولية — ساعدنا في التحقق
      </span>
    );
  }
  if (isVerified(place)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800">
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
  const whatsapp = whatsappHref(place);
  const phone = (place.phone ?? "").replace(/[^\d+]/g, "");

  const base =
    "inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-[11px] font-black transition hover:border-market-navy/40 hover:text-market-navy";

  return (
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
        <a className={base} href={whatsapp} target="_blank" rel="noreferrer noopener">
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
    </div>
  );
}

export function GuidePlaceCard({ place }: { place: GuidePlace }) {
  const location = [place.district, place.city, place.governorate].filter(Boolean).join(" · ");
  const source = sourceLabel(place);


  return (
    <article className="flex h-full flex-col gap-3 rounded-3xl border border-border/80 bg-card p-4 shadow-[0_1px_0_rgba(16,0,43,0.04)] transition hover:border-market-navy/30 hover:shadow-lg sm:p-5">
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

      {location ? (
        <p className="flex items-start gap-1.5 text-[11px] leading-6 text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="line-clamp-2">{place.address || location}</span>
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
      </div>
    </article>
  );
}

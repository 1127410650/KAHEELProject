/**
 * بطاقات المزاج: مداخل سريعة بحسب غرض الرحلة (شاليه، فيلا، إقامة عمل…).
 * كل بطاقة تنقل إلى البحث بنوع العقار المناسب — عرض فقط، بلا صور خارجية.
 */

import { Link } from "@tanstack/react-router";
import { Briefcase, Home, Mountain, Waves } from "lucide-react";

import type { AqarTrack } from "@/lib/mkt-aqar";

const MOODS: { key: string; label: string; hint: string; icon: typeof Waves }[] = [
  { key: "chalet", label: "استراحة", hint: "شاليه ومسبح", icon: Waves },
  { key: "villa", label: "عزوة العائلة", hint: "فلل واسعة", icon: Home },
  { key: "apartment", label: "إقامة عمل", hint: "شقق مفروشة", icon: Briefcase },
  { key: "farm", label: "هدوء الريف", hint: "مزارع وبيوت", icon: Mountain },
];


export function AqarMoodCards({ track }: { track: AqarTrack }) {
  return (
    <section className="k-section k-gutter">
      <h2 className="k-section-title">على مزاجك</h2>
      <ul className="grid grid-cols-2 gap-[var(--sp-3)]">

        {MOODS.map(({ key, label, hint, icon: Icon }) => (
          <li key={key}>
            <Link
              to="/aqar/browse"
              search={{ track, type: key }}
              className="k-lift k-card-premium flex items-center gap-[var(--sp-3)]"
              style={{ minHeight: 72 }}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10">
                <Icon className="size-5 text-primary" aria-hidden />
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-[15px] font-bold leading-[1.3] text-foreground">
                  {label}
                </strong>
                <span className="mt-[var(--sp-1)] block truncate text-[14px] font-medium leading-[1.6] text-muted-foreground">
                  {hint}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

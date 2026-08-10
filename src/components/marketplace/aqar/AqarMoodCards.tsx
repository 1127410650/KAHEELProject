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
    <section className="mt-7 px-4">
      <h2 className="mb-3 text-section font-extrabold text-foreground">على مزاجك</h2>
      <ul className="grid grid-cols-2 gap-3">

        {MOODS.map(({ key, label, hint, icon: Icon }) => (
          <li key={key}>
            <Link
              to="/aqar/browse"
              search={{ track, type: key }}
              className="k-lift flex items-center gap-2 rounded-2xl border border-border bg-card p-3"
              style={{ minHeight: 72 }}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10">
                <Icon className="size-5 text-primary" aria-hidden />
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-title font-bold text-foreground">
                  {label}
                </strong>
                <span className="block truncate text-nav text-muted-foreground">{hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

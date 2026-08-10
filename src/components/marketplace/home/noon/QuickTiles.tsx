/**
 * ثلاث بلاطات ملوّنة في صف واحد: دليل سوريا · دليل الطالب · مواعيد.
 *
 * الألوان هنا تجميلية فقط ومأخوذة من رموز الهوية (البنفسجي والذهبي) عبر طبقات
 * شفافة فوق سطح أبيض، فلا لون مكتوب مباشرة ولا كتلة ملوّنة ثقيلة.
 */
import { BookOpenCheck, CalendarClock, Compass } from "lucide-react";

import { useI18n } from "@/i18n";

const TILES = [
  {
    key: "guide",
    href: "/guides/syria",
    icon: Compass,
    ar: "دليل سوريا",
    en: "Syria guide",
    tint: "bg-primary/10 text-primary ring-primary/20",
  },
  {
    key: "student",
    href: "/guides/students",
    icon: BookOpenCheck,
    ar: "دليل الطالب",
    en: "Student guide",
    tint: "bg-gold/15 text-gold-foreground ring-gold/30",
  },
  {
    key: "bookings",
    href: "/services",
    icon: CalendarClock,
    ar: "مواعيد",
    en: "Bookings",
    tint: "bg-secondary text-foreground ring-border",
  },
] as const;

export function QuickTiles() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  return (
    <section aria-label={ar ? "أقسام سريعة" : "Quick sections"} className="grid grid-cols-3 gap-2">
      {TILES.map(({ key, href, icon: Icon, ar: labelAr, en, tint }) => (
        <a
          key={key}
          href={href}
          className={`flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl px-1.5 py-2 text-center ring-1 outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary/45 ${tint}`}
        >
          <Icon className="size-6 shrink-0" aria-hidden />
          <span className="w-full truncate text-[11px] font-black leading-tight sm:text-xs">
            {ar ? labelAr : en}
          </span>
        </a>
      ))}
    </section>
  );
}

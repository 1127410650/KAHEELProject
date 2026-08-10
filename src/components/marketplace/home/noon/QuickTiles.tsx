/**
 * ثلاث بلاطات ملوّنة: دليل سوريا · دليل الطالب · مواعيد.
 *
 * الشبكة ستة أعمدة، وكل بلاطة تأخذ حجمها من فتحتها في وضع التحرير (صغير = ثلث
 * الصف، عادي = نصفه، كبير = صف كامل) مع `grid-flow-dense` فلا تنشأ فجوات ولا
 * يتغيّر ارتفاع الصف عند التبديل. الوجهة أيضًا من الفتحة، ومصدرها قائمة مسارات
 * مسجّلة في القاعدة — لا رابط حر. الألوان تجميلية من رموز الهوية.
 */
import { BookOpenCheck, CalendarClock, Compass } from "lucide-react";

import { useI18n } from "@/i18n";
import { TILE_SPAN } from "@/lib/mkt-design-library";
import { slotLink, slotTileSize, useMediaSlots } from "@/lib/mkt-media-slots";

const TILES = [
  {
    slot: "home.tile.guide.bg",
    key: "guide",
    href: "/guides/syria",
    icon: Compass,
    ar: "دليل سوريا",
    en: "Syria guide",
    tint: "bg-primary/12 text-primary ring-primary/25",
  },
  {
    slot: "home.tile.student.bg",
    key: "student",
    href: "/guides/students",
    icon: BookOpenCheck,
    ar: "دليل الطالب",
    en: "Student guide",
    tint: "bg-gold/20 text-gold-foreground ring-gold/40",
  },
  {
    slot: "home.tile.bookings.bg",
    key: "bookings",
    href: "/services",
    icon: CalendarClock,
    ar: "مواعيد",
    en: "Bookings",
    tint: "bg-primary text-primary-foreground ring-primary/40",
  },
] as const;

export function QuickTiles() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const slots = useMediaSlots();

  return (
    <section
      aria-label={ar ? "أقسام سريعة" : "Quick sections"}
      className="grid grid-flow-row-dense grid-cols-6 gap-2"
    >
      {TILES.map(({ key, slot, href, icon: Icon, ar: labelAr, en, tint }) => (
        <a
          key={key}
          data-kslot={slot}
          href={slotLink(slots.data, slot, href)}
          className={`${TILE_SPAN[slotTileSize(slots.data, slot)]} flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-[var(--sp-2)] rounded-[var(--r-card)] px-[var(--sp-2)] py-2 text-center ring-1 outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary/45 ${tint}`}
        >
          <Icon className="size-6 shrink-0" aria-hidden />
          <span className="w-full truncate text-desc font-black leading-tight sm:text-desc">
            {ar ? labelAr : en}
          </span>
        </a>
      ))}
    </section>
  );
}

/**
 * التصنيفات الرئيسية بنمط «نون»: بلاطات مربعة بحواف دائرية والاسم تحتها،
 * أربعة في الصف على الجوال. الأبعاد محجوزة (نسبة 1:1) فلا هزّة تخطيط.
 */
import {
  Briefcase,
  Building2,
  Car,
  GraduationCap,
  Laptop,
  MoreHorizontal,
  PartyPopper,
  Shirt,
  ShoppingBasket,
  Sofa,
  Utensils,
  Wrench,
} from "lucide-react";

import { useI18n } from "@/i18n";

const CATEGORIES = [
  { key: "realestate", href: "/search?category=real-estate", icon: Building2, ar: "عقارات", en: "Real estate" },
  { key: "restaurants", href: "/search?category=restaurants", icon: Utensils, ar: "مطاعم", en: "Restaurants" },
  { key: "cars", href: "/search?category=cars", icon: Car, ar: "سيارات", en: "Cars" },
  { key: "supplies", href: "/search?domain=product", icon: ShoppingBasket, ar: "مستلزمات", en: "Essentials" },
  { key: "services", href: "/search?category=services", icon: Wrench, ar: "خدمات", en: "Services" },
  { key: "devices", href: "/search?category=devices", icon: Laptop, ar: "أجهزة", en: "Devices" },
  { key: "furniture", href: "/search?category=furniture", icon: Sofa, ar: "أثاث", en: "Furniture" },
  { key: "fashion", href: "/search?category=fashion", icon: Shirt, ar: "أزياء", en: "Fashion" },
  { key: "jobs", href: "/search?category=jobs", icon: Briefcase, ar: "وظائف", en: "Jobs" },
  { key: "schools", href: "/search?category=schools-universities", icon: GraduationCap, ar: "تعليم", en: "Education" },
  { key: "events", href: "/search?category=events", icon: PartyPopper, ar: "مناسبات", en: "Events" },
  { key: "more", href: "/more", icon: MoreHorizontal, ar: "المزيد", en: "More" },
] as const;

export function CategoryTileGrid() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  return (
    <section aria-labelledby="home-categories-title">
      <h2 id="home-categories-title" className="text-[15px] font-black tracking-tight sm:text-lg">
        {ar ? "التصنيفات الرئيسية" : "Main categories"}
      </h2>
      <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
        {CATEGORIES.map(({ key, href, icon: Icon, ar: labelAr, en }) => (
          <a
            key={key}
            href={href}
            className="group flex min-w-0 flex-col items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
          >
            <span className="grid aspect-square w-full place-items-center rounded-2xl border border-border bg-accent text-primary shadow-sm transition group-hover:-translate-y-0.5">
              <Icon className="size-6 sm:size-7" aria-hidden />
            </span>
            <span className="w-full truncate text-center text-[10.5px] font-bold text-foreground sm:text-xs">
              {ar ? labelAr : en}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

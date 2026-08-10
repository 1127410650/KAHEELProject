/**
 * التصنيفات الرئيسية بنمط «نون»: بلاطات مربعة بحواف دائرية والاسم تحتها،
 * أربعة في الصف على الجوال. الأبعاد محجوزة (نسبة 1:1) فلا هزّة تخطيط.
 *
 * المصدر: الأقسام الرئيسية الفعلية في `mkt_categories` (is_primary) — فإضافة
 * قسم رئيسي جديد من /admin/categories تُظهره هنا فورًا بلا تعديل كود. تُعرض
 * القائمة الثابتة الاحتياطية فقط قبل وصول البيانات أو إذا لم يوجد أي رئيسي.
 */
import { Link } from "@tanstack/react-router";
import {
  Briefcase,
  Building2,
  Car,
  GraduationCap,
  Laptop,
  LayoutGrid,
  MoreHorizontal,
  PartyPopper,
  Shirt,
  ShoppingBasket,
  Sofa,
  Utensils,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { useI18n } from "@/i18n";
import { categoryName, primaryCategories, useCategoryTree } from "@/lib/mkt-category-tree";

const ICONS: Record<string, LucideIcon> = {
  "building-2": Building2,
  utensils: Utensils,
  car: Car,
  "shopping-basket": ShoppingBasket,
  wrench: Wrench,
  laptop: Laptop,
  sofa: Sofa,
  shirt: Shirt,
  briefcase: Briefcase,
  "graduation-cap": GraduationCap,
  "party-popper": PartyPopper,
  "layout-grid": LayoutGrid,
};

const FALLBACK = [
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
] as const;

/* مقياس مضغوط مطابق لبطاقة «البحث في السوق»: مربع 56px والاسم تحته ⇒ ارتفاع
   الصف ≈84px، وصفّان لثماني بلاطات ≈ 180px بلا هزّة تخطيط (الأبعاد ثابتة). */
const tileClass =
  "k-tile grid size-[56px] place-items-center rounded-[var(--r-card)] shadow-[0_1px_2px_rgb(23_20_35/0.05)] transition group-hover:-translate-y-0.5";
const linkClass =
  "group flex h-[84px] min-w-0 flex-col items-center justify-start gap-1 outline-none focus-visible:ring-2 focus-visible:ring-primary/45";
const labelClass = "w-full truncate text-center text-desc font-bold leading-tight text-foreground";

export function CategoryTileGrid() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const tree = useCategoryTree();
  const rows = primaryCategories(tree.data ?? []);

  return (
    <section aria-labelledby="home-categories-title">
      <h2 id="home-categories-title" className="text-body font-black sm:text-lg">
        {ar ? "التصنيفات الرئيسية" : "Main categories"}
      </h2>
      {/* سبع بلاطات + «المزيد» = صفّان على الجوال، والباقي في /more. */}
      <div className="mt-2 grid grid-cols-4 place-items-center gap-2 sm:grid-cols-6 lg:grid-cols-8">
        {rows.length > 0
          ? rows.slice(0, 7).map((row) => {
              const Icon = ICONS[row.icon ?? ""] ?? LayoutGrid;
              return (
                <Link key={row.id} to="/c/$slug" params={{ slug: row.slug }} className={linkClass}>
                  <span className={tileClass}>
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <span className={labelClass}>{categoryName(row, locale)}</span>
                </Link>
              );
            })
          : FALLBACK.slice(0, 7).map(({ key, href, icon: Icon, ar: labelAr, en }) => (
              <a key={key} href={href} className={linkClass}>
                <span className={tileClass}>
                  <Icon className="size-6" aria-hidden />
                </span>
                <span className={labelClass}>{ar ? labelAr : en}</span>
              </a>
            ))}
        <a href="/more" className={linkClass}>
          <span className={tileClass}>
            <MoreHorizontal className="size-6" aria-hidden />
          </span>
          <span className={labelClass}>{ar ? "المزيد" : "More"}</span>
        </a>
      </div>
    </section>
  );
}

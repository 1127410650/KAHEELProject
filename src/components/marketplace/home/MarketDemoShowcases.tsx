import { Link } from "@tanstack/react-router";
import {
  BadgePercent,
  Coffee,
  Dumbbell,
  Gamepad2,
  Gem,
  Heart,
  PawPrint,
  ShoppingBag,
  Sparkles,
  Star,
  UtensilsCrossed,
} from "lucide-react";

interface DemoStore {
  id: string;
  name: string;
  type: string;
  gradient: string;
  icon: typeof ShoppingBag;
  stats: string;
  products: string[];
  accent: string;
}

const DEMOS: DemoStore[] = [
  {
    id: "women",
    name: "لمسة أنوثة",
    type: "متجر نسائي تجريبي",
    gradient: "from-fuchsia-950 via-rose-900 to-pink-500",
    icon: Heart,
    stats: "4.9 ★ · 128 منتجًا",
    products: ["عباية فاخرة", "عطر وردي", "حقيبة أنيقة"],
    accent: "تشكيلة الموسم",
  },
  {
    id: "games",
    name: "نقطة اللاعب",
    type: "متجر ألعاب تجريبي",
    gradient: "from-violet-950 via-indigo-800 to-cyan-500",
    icon: Gamepad2,
    stats: "4.8 ★ · 86 منتجًا",
    products: ["جهاز ألعاب", "يد تحكم", "كرسي احترافي"],
    accent: "عروض اللاعبين",
  },
  {
    id: "restaurant",
    name: "مذاق اليوم",
    type: "مطعم تجريبي",
    gradient: "from-red-950 via-orange-800 to-amber-400",
    icon: UtensilsCrossed,
    stats: "4.7 ★ · 42 صنفًا",
    products: ["برجر خاص", "بيتزا عائلية", "مشروبات"],
    accent: "وجبة اليوم",
  },
  {
    id: "clubs",
    name: "نادي القمة",
    type: "نادي رياضي تجريبي",
    gradient: "from-zinc-950 via-emerald-900 to-lime-500",
    icon: Dumbbell,
    stats: "4.9 ★ · 12 برنامجًا",
    products: ["اشتراك شهري", "تدريب شخصي", "برنامج لياقة"],
    accent: "ابدأ الآن",
  },
  {
    id: "jewelry",
    name: "دار الجوهرة",
    type: "مجوهرات تجريبية",
    gradient: "from-slate-950 via-amber-900 to-yellow-400",
    icon: Gem,
    stats: "5.0 ★ · 64 قطعة",
    products: ["خاتم فاخر", "سوار ذهبي", "هدية مميزة"],
    accent: "مجموعة فاخرة",
  },
  {
    id: "cafe",
    name: "مزاج القهوة",
    type: "مقهى تجريبي",
    gradient: "from-stone-950 via-amber-950 to-orange-600",
    icon: Coffee,
    stats: "4.8 ★ · 28 صنفًا",
    products: ["قهوة مختصة", "حلى اليوم", "مشروب بارد"],
    accent: "اختيار الباريستا",
  },
  {
    id: "pets",
    name: "رفيقك",
    type: "حيوانات أليفة تجريبي",
    gradient: "from-cyan-950 via-sky-800 to-teal-500",
    icon: PawPrint,
    stats: "4.7 ★ · 73 منتجًا",
    products: ["غذاء قطط", "ألعاب", "عناية"],
    accent: "الأكثر طلبًا",
  },
  {
    id: "gifts",
    name: "لحظة هدية",
    type: "ورد وهدايا تجريبي",
    gradient: "from-purple-950 via-fuchsia-800 to-rose-400",
    icon: Sparkles,
    stats: "4.9 ★ · 51 منتجًا",
    products: ["بوكيه ورد", "صندوق هدية", "تغليف خاص"],
    accent: "هدية جاهزة",
  },
];

export function MarketDemoShowcases() {
  return (
    <section className="mx-auto w-full max-w-[1240px] px-3 pt-4 sm:px-4 sm:pt-6 lg:px-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary sm:text-xs">
            <Star className="size-3.5" aria-hidden />
            نماذج جاهزة للعرض
          </span>
          <h2 className="mt-1 text-sm font-black text-foreground sm:text-lg">جرّب متاجر تجريبية</h2>
          <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
            بيانات تجريبية توضح شكل المتجر والمنتجات والعروض قبل إنشاء متجرك الحقيقي.
          </p>
        </div>
        <Link
          to="/business/new"
          search={{ next: "/more" }}
          className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-border bg-card px-3 text-[10px] font-bold text-foreground shadow-sm hover:bg-muted sm:text-xs"
        >
          جرّب التصميم
          <Sparkles className="size-3.5" aria-hidden />
        </Link>
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-4">
        {DEMOS.map((demo) => {
          const Icon = demo.icon;
          return (
            <article
              key={demo.id}
              className={`relative min-h-64 w-[84%] min-w-[84%] snap-start overflow-hidden rounded-3xl bg-gradient-to-br ${demo.gradient} p-4 text-white shadow-raised sm:w-[48%] sm:min-w-[48%] lg:w-auto lg:min-w-0`}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_42%)]" aria-hidden />
              <div className="relative flex h-full min-h-56 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-12 place-items-center rounded-2xl border border-white/20 bg-white/15 backdrop-blur">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/15 px-2.5 py-1 text-[9px] font-bold backdrop-blur">
                    <BadgePercent className="size-3" aria-hidden />
                    تجريبي
                  </span>
                </div>

                <div className="mt-5">
                  <p className="text-[10px] font-semibold text-white/65">{demo.type}</p>
                  <h3 className="mt-1 text-lg font-black">{demo.name}</h3>
                  <p className="mt-1 text-[10px] text-white/70">{demo.stats}</p>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-1.5">
                  {demo.products.map((product) => (
                    <div key={product} className="rounded-xl border border-white/15 bg-white/10 p-2 backdrop-blur-sm">
                      <ShoppingBag className="size-3.5 text-white/80" aria-hidden />
                      <p className="mt-4 line-clamp-2 text-[9px] font-bold leading-4">{product}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                  <span className="text-[10px] font-bold text-white/85">{demo.accent}</span>
                  <Link
                    to="/business/new"
                    search={{ next: "/more" }}
                    className="inline-flex min-h-8 items-center rounded-full bg-white px-3 text-[10px] font-black text-slate-950"
                  >
                    استخدم هذا القالب
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

import {
  BadgePercent,
  CalendarDays,
  Dumbbell,
  Flame,
  Gamepad2,
  Heart,
  ShoppingBag,
  Sparkles,
  Star,
  UtensilsCrossed,
} from "lucide-react";

import type { StoreTemplate } from "@/components/marketplace/StoreTemplatePicker";

const productsByTemplate: Record<string, string[]> = {
  women: ["عبايات مختارة", "عطور فاخرة", "عناية يومية"],
  men: ["ساعات كلاسيكية", "عطور رجالية", "أزياء رسمية"],
  kids: ["ملابس أطفال", "ألعاب تعليمية", "هدايا مواليد"],
  games: ["أجهزة ألعاب", "بطاقات رقمية", "إكسسوارات احترافية"],
  clubs: ["اشتراك شهري", "تدريب شخصي", "معدات رياضية"],
  restaurant: ["وجبات مميزة", "حلويات", "عروض عائلية"],
  cars: ["سيارات مختارة", "قطع غيار", "خدمات صيانة"],
  "real-estate": ["عقارات مميزة", "مشاريع جديدة", "فرص استثمار"],
  electronics: ["هواتف", "حواسيب", "ملحقات"],
  furniture: ["غرف معيشة", "مكاتب", "ديكور"],
  contracting: ["تنفيذ مشاريع", "معدات", "مواد بناء"],
  agriculture: ["منتجات زراعية", "أعلاف", "معدات"],
  handmade: ["هدايا مخصصة", "منتجات فنية", "تغليف"],
  factory: ["خطوط إنتاج", "توريد", "منتجات بالجملة"],
  wholesale: ["باقات جملة", "موزعون", "أسعار كمية"],
  general: ["منتجات جديدة", "أفضل العروض", "الأكثر طلبًا"],
};

export function StoreTemplateShowcase({ template }: { template: StoreTemplate }) {
  if (template.id === "restaurant") return <RestaurantShowcase template={template} />;
  if (template.id === "games") return <GamesShowcase template={template} />;
  if (template.id === "clubs") return <FitnessShowcase template={template} />;
  if (template.id === "women") return <FashionShowcase template={template} feminine />;
  if (template.id === "men") return <FashionShowcase template={template} />;
  return <GeneralShowcase template={template} />;
}

function Shell({ template, children }: { template: StoreTemplate; children: React.ReactNode }) {
  return (
    <section className={`mb-5 overflow-hidden rounded-[var(--r-card)] bg-gradient-to-br ${template.gradient} p-3 text-white shadow-raised sm:p-5`}>
      <div className="rounded-[var(--r-card)] border border-white/15 bg-black/10 p-3 backdrop-blur-sm sm:p-4">
        {children}
      </div>
    </section>
  );
}

function Header({ template, action = "تسوق الآن" }: { template: StoreTemplate; action?: string }) {
  const Icon = template.icon;
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-11 place-items-center rounded-[var(--r-card)] border border-white/20 bg-white/15">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-desc font-semibold text-white/60">معاينة واجهة المتجر</p>
        <h2 className="text-section truncate font-black">{template.title}</h2>
      </div>
      <span className="rounded-full bg-white px-3 py-[var(--sp-2)] text-desc font-black text-slate-900 sm:text-desc">{action}</span>
    </div>
  );
}

function ProductCards({ template, icon }: { template: StoreTemplate; icon?: React.ReactNode }) {
  const items = productsByTemplate[template.id] ?? productsByTemplate["general"] ?? [];
  return (
    <div className="mt-4 grid grid-cols-3 gap-2">
      {items.map((item, index) => (
        <div key={item} className="rounded-xl border border-white/15 bg-white/10 p-[var(--sp-3)] backdrop-blur-sm">
          <div className="flex items-center justify-between gap-1">
            <span className="grid size-7 place-items-center rounded-lg bg-white/15">
              {icon ?? <ShoppingBag className="size-3.5" aria-hidden />}
            </span>
            {index === 0 ? <BadgePercent className="size-3.5 text-white/80" aria-hidden /> : null}
          </div>
          <p className="mt-5 line-clamp-2 text-desc font-bold leading-4 sm:text-desc">{item}</p>
          <p className="mt-1 text-desc text-white/60 sm:text-desc">منتج تجريبي</p>
        </div>
      ))}
    </div>
  );
}

function FashionShowcase({ template, feminine = false }: { template: StoreTemplate; feminine?: boolean }) {
  return (
    <Shell template={template}>
      <Header template={template} action={feminine ? "اكتشفي الجديد" : "اكتشف الجديد"} />
      <div className="mt-4 rounded-[var(--r-card)] border border-white/15 bg-white/10 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/15">
            {feminine ? <Heart className="size-6" aria-hidden /> : <Sparkles className="size-6" aria-hidden />}
          </span>
          <div>
            <p className="text-sm font-black">تشكيلة الموسم الجديدة</p>
            <p className="mt-1 text-desc leading-5 text-white/70">واجهة عصرية تركز على الصور، العروض، والتشكيلات المختارة.</p>
          </div>
        </div>
      </div>
      <ProductCards template={template} icon={feminine ? <Heart className="size-3.5" /> : <Star className="size-3.5" />} />
    </Shell>
  );
}

function GamesShowcase({ template }: { template: StoreTemplate }) {
  return (
    <Shell template={template}>
      <Header template={template} action="ابدأ اللعب" />
      <div className="mt-4 grid grid-cols-[1.3fr_0.7fr] gap-2">
        <div className="rounded-[var(--r-card)] border border-cyan-300/30 bg-black/25 p-4 shadow-[0_0_24px_rgba(34,211,238,0.18)]">
          <Gamepad2 className="size-7 text-cyan-200" aria-hidden />
          <p className="mt-5 text-sm font-black">منطقة اللاعبين</p>
          <p className="mt-1 text-desc text-cyan-50/70">أجهزة، ألعاب، بطاقات وعروض حصرية.</p>
        </div>
        <div className="rounded-[var(--r-card)] border border-fuchsia-300/30 bg-fuchsia-500/10 p-3">
          <Flame className="size-5 text-fuchsia-200" aria-hidden />
          <p className="mt-6 text-desc font-black">الأكثر رواجًا</p>
        </div>
      </div>
      <ProductCards template={template} icon={<Gamepad2 className="size-3.5" />} />
    </Shell>
  );
}

function FitnessShowcase({ template }: { template: StoreTemplate }) {
  return (
    <Shell template={template}>
      <Header template={template} action="احجز تجربة" />
      <div className="mt-4 flex items-center gap-3 rounded-[var(--r-card)] border border-lime-300/20 bg-black/20 p-4">
        <span className="grid size-12 place-items-center rounded-[var(--r-card)] bg-lime-300 text-slate-950">
          <Dumbbell className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">برنامجك يبدأ هنا</p>
          <p className="mt-1 text-desc text-white/70">اشتراكات، مدربون، حصص ومتابعة رياضية.</p>
        </div>
        <CalendarDays className="size-5 text-lime-200" aria-hidden />
      </div>
      <ProductCards template={template} icon={<Dumbbell className="size-3.5" />} />
    </Shell>
  );
}

function RestaurantShowcase({ template }: { template: StoreTemplate }) {
  return (
    <Shell template={template}>
      <Header template={template} action="اطلب الآن" />
      <div className="mt-4 rounded-[var(--r-card)] border border-amber-200/20 bg-black/15 p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-amber-300 text-orange-950">
            <UtensilsCrossed className="size-6" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-black">قائمة اليوم</p>
            <p className="mt-1 text-desc text-white/70">أطباق مميزة، عروض عائلية وتجربة طلب واضحة.</p>
          </div>
        </div>
      </div>
      <ProductCards template={template} icon={<UtensilsCrossed className="size-3.5" />} />
    </Shell>
  );
}

function GeneralShowcase({ template }: { template: StoreTemplate }) {
  return (
    <Shell template={template}>
      <Header template={template} />
      <div className="mt-4 rounded-[var(--r-card)] border border-white/15 bg-white/10 p-4">
        <p className="text-sm font-black">واجهة مصممة لنشاطك</p>
        <p className="mt-1 text-desc leading-5 text-white/70">تعرض أهم المنتجات والخدمات والتصنيفات بطريقة واضحة ومتجاوبة.</p>
      </div>
      <ProductCards template={template} />
    </Shell>
  );
}

import {
  Baby,
  Building2,
  CarFront,
  ChevronLeft,
  CircuitBoard,
  Dumbbell,
  Factory,
  Gamepad2,
  Hammer,
  Heart,
  Home,
  PackageOpen,
  Palette,
  Shirt,
  Sparkles,
  Store,
  UtensilsCrossed,
  Watch,
  Wheat,
  type LucideIcon,
} from "lucide-react";

export type StoreTemplateId =
  | "general"
  | "women"
  | "men"
  | "kids"
  | "games"
  | "clubs"
  | "restaurant"
  | "cars"
  | "real-estate"
  | "electronics"
  | "furniture"
  | "contracting"
  | "agriculture"
  | "handmade"
  | "factory"
  | "wholesale";

export interface StoreTemplate {
  id: StoreTemplateId;
  title: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  gradient: string;
  features: string[];
}

export const STORE_TEMPLATES: StoreTemplate[] = [
  {
    id: "women",
    title: "متجر نسائي",
    description: "أزياء، عطور، عناية، حقائب وإكسسوارات بتجربة أنيقة.",
    icon: Heart,
    badge: "ستايل أنيق",
    gradient: "from-fuchsia-950 via-rose-900 to-pink-500",
    features: ["أزياء", "عطور", "عناية"],
  },
  {
    id: "men",
    title: "متجر رجالي",
    description: "ملابس، ساعات، عطور وأسلوب رجالي عصري.",
    icon: Watch,
    badge: "هوية فاخرة",
    gradient: "from-slate-950 via-blue-950 to-sky-700",
    features: ["ملابس", "ساعات", "عطور"],
  },
  {
    id: "kids",
    title: "أطفال ومواليد",
    description: "ملابس أطفال، مستلزمات مواليد، ألعاب وهدايا.",
    icon: Baby,
    gradient: "from-cyan-800 via-sky-500 to-yellow-300",
    features: ["مواليد", "أطفال", "هدايا"],
  },
  {
    id: "games",
    title: "ألعاب وترفيه",
    description: "ألعاب إلكترونية، أجهزة، بطاقات، وهوايات متنوعة.",
    icon: Gamepad2,
    badge: "ألوان حيوية",
    gradient: "from-violet-950 via-indigo-800 to-cyan-500",
    features: ["ألعاب", "أجهزة", "بطاقات"],
  },
  {
    id: "clubs",
    title: "نوادٍ ولياقة",
    description: "اشتراكات، تمارين، معدات رياضية وبرامج تدريب.",
    icon: Dumbbell,
    gradient: "from-zinc-950 via-emerald-900 to-lime-500",
    features: ["اشتراكات", "تدريب", "معدات"],
  },
  {
    id: "restaurant",
    title: "مطاعم وأغذية",
    description: "قوائم طعام، طلبات، عروض يومية ومنتجات غذائية.",
    icon: UtensilsCrossed,
    badge: "قائمة شهية",
    gradient: "from-red-950 via-orange-800 to-amber-400",
    features: ["قوائم", "طلبات", "عروض"],
  },
  {
    id: "general",
    title: "متجر عام",
    description: "منتجات وخدمات متنوعة في واجهة واحدة مرنة.",
    icon: Store,
    badge: "الأكثر مرونة",
    gradient: "from-slate-950 via-slate-800 to-slate-600",
    features: ["منتجات", "عروض", "تصنيفات"],
  },
  {
    id: "cars",
    title: "سيارات ومركبات",
    description: "معرض سيارات، قطع غيار، خدمات وصيانة.",
    icon: CarFront,
    gradient: "from-zinc-950 via-red-950 to-red-700",
    features: ["مركبات", "تمويل", "قطع غيار"],
  },
  {
    id: "real-estate",
    title: "عقارات",
    description: "بيع وإيجار ومشاريع ووسطاء ضمن متجر واحد.",
    icon: Building2,
    gradient: "from-emerald-950 via-teal-900 to-cyan-700",
    features: ["بيع", "إيجار", "مشاريع"],
  },
  {
    id: "electronics",
    title: "إلكترونيات",
    description: "أجهزة، إكسسوارات، صيانة وضمانات.",
    icon: CircuitBoard,
    gradient: "from-indigo-950 via-violet-900 to-fuchsia-700",
    features: ["أجهزة", "ماركات", "ضمان"],
  },
  {
    id: "furniture",
    title: "أثاث وديكور",
    description: "أثاث منزلي ومكتبي وتصميم داخلي.",
    icon: Home,
    gradient: "from-amber-950 via-orange-900 to-yellow-600",
    features: ["أثاث", "ديكور", "تفصيل"],
  },
  {
    id: "contracting",
    title: "مقاولات ومعدات",
    description: "خدمات تنفيذ، معدات، مواد بناء وموردون.",
    icon: Hammer,
    gradient: "from-stone-950 via-amber-950 to-orange-700",
    features: ["خدمات", "معدات", "مشاريع"],
  },
  {
    id: "agriculture",
    title: "زراعة ومواشي",
    description: "منتجات زراعية، أعلاف، مواشي ومعدات.",
    icon: Wheat,
    gradient: "from-lime-950 via-green-900 to-emerald-600",
    features: ["محاصيل", "مواشي", "معدات"],
  },
  {
    id: "handmade",
    title: "حرف وهدايا",
    description: "منتجات فنية، هدايا وأعمال مخصصة.",
    icon: Palette,
    gradient: "from-purple-950 via-indigo-900 to-sky-600",
    features: ["تصاميم", "طلبات خاصة", "هدايا"],
  },
  {
    id: "factory",
    title: "مصنع ومنتجات",
    description: "كتالوجات جملة، قدرات إنتاج وطلبات توريد.",
    icon: Factory,
    gradient: "from-slate-950 via-blue-950 to-cyan-700",
    features: ["كتالوج", "توريد", "إنتاج"],
  },
  {
    id: "wholesale",
    title: "جملة وتوزيع",
    description: "باقات وأسعار كمية وشبكة موزعين.",
    icon: PackageOpen,
    gradient: "from-cyan-950 via-sky-900 to-blue-600",
    features: ["كميات", "موزعون", "أسعار جملة"],
  },
];

export function StoreTemplatePicker({ onSelect }: { onSelect: (template: StoreTemplate) => void }) {
  return (
    <section className="space-y-5">
      <div className="relative overflow-hidden rounded-[var(--r-card)] border border-border bg-gradient-to-br from-market-navy via-market-navy-dark to-primary p-5 text-market-navy-foreground shadow-raised sm:p-8">
        <div className="absolute -end-12 -top-12 size-44 rounded-full bg-market-silver/10 blur-2xl" aria-hidden />
        <div className="absolute -bottom-16 -start-10 size-48 rounded-full bg-primary-foreground/10 blur-3xl" aria-hidden />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-market-silver/30 bg-market-navy-soft/50 px-3 py-1 text-desc font-semibold text-market-silver">
            <Sparkles className="size-3.5" aria-hidden />
            قوالب مختلفة لكل نشاط
          </span>
          <h1 className="text-page mt-4 font-black leading-tight sm:text-4xl">اختر شكل متجرك</h1>
          <p className="mt-2 max-w-xl text-sm leading-7 text-market-silver-muted sm:text-base">
            كل قالب له ألوان وهوية وتجربة مناسبة لنوع المتجر، ويمكن تغييره لاحقًا دون التأثير على المنتجات.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-[var(--sp-3)] sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
        {STORE_TEMPLATES.map((template) => {
          const Icon = template.icon;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template)}
              className="group relative min-h-48 overflow-hidden rounded-[var(--r-card)] border border-border bg-card text-start shadow-panel transition duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-52"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${template.gradient}`} aria-hidden />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_38%)]" aria-hidden />
              <div className="relative flex h-full min-h-48 flex-col p-3.5 text-white sm:min-h-52 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="grid size-10 place-items-center rounded-xl border border-white/20 bg-white/15 backdrop-blur sm:size-12 sm:rounded-[var(--r-card)]">
                    <Icon className="size-5 sm:size-6" aria-hidden />
                  </span>
                  {template.badge ? (
                    <span className="rounded-full border border-white/20 bg-black/20 px-2 py-1 text-desc font-bold backdrop-blur sm:text-desc">
                      {template.badge}
                    </span>
                  ) : null}
                </div>
                <div className="mt-auto pt-5">
                  <h2 className="text-section font-black">{template.title}</h2>
                  <p className="mt-1 line-clamp-2 text-desc leading-4 text-white/75 sm:text-desc sm:leading-5">{template.description}</p>
                  <div className="mt-[var(--sp-3)] flex flex-wrap gap-1">
                    {template.features.slice(0, 3).map((feature) => (
                      <span key={feature} className="rounded-full border border-white/15 bg-white/10 px-[var(--sp-2)] py-0.5 text-desc font-medium sm:px-2 sm:py-1 sm:text-desc">
                        {feature}
                      </span>
                    ))}
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-desc font-bold text-white transition group-hover:gap-2 sm:text-desc">
                    اختيار القالب
                    <ChevronLeft className="size-3.5 sm:size-4" aria-hidden />
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function SelectedStoreTemplate({ template, onChange }: { template: StoreTemplate; onChange: () => void }) {
  const Icon = template.icon;
  return (
    <div className={`mb-5 overflow-hidden rounded-[var(--r-card)] bg-gradient-to-br ${template.gradient} p-4 text-white shadow-panel`}>
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/20 bg-white/15">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-desc font-semibold text-white/60">قالب المتجر المختار</p>
          <h2 className="text-section truncate font-black">{template.title}</h2>
        </div>
        <button type="button" onClick={onChange} className="shrink-0 rounded-full border border-white/20 bg-black/15 px-3 py-[var(--sp-2)] text-desc font-bold hover:bg-black/25">
          تغيير
        </button>
      </div>
    </div>
  );
}

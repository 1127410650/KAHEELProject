import {
  Building2,
  CarFront,
  ChevronLeft,
  CircuitBoard,
  Factory,
  Hammer,
  Home,
  PackageOpen,
  Palette,
  Shirt,
  ShoppingBag,
  Sparkles,
  Store,
  UtensilsCrossed,
  Wheat,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type StoreTemplateId =
  | "general"
  | "cars"
  | "real-estate"
  | "electronics"
  | "fashion"
  | "furniture"
  | "contracting"
  | "agriculture"
  | "restaurant"
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
    id: "general",
    title: "متجر عام",
    description: "منتجات وخدمات متنوعة في واجهة واحدة مرنة.",
    icon: Store,
    badge: "الأكثر مرونة",
    gradient: "from-slate-950 via-slate-800 to-slate-700",
    features: ["منتجات", "عروض", "تصنيفات"],
  },
  {
    id: "cars",
    title: "سيارات ومركبات",
    description: "معرض سيارات، قطع غيار، خدمات وصيانة.",
    icon: CarFront,
    badge: "قالب مميز",
    gradient: "from-zinc-950 via-red-950 to-red-800",
    features: ["مركبات", "تمويل", "قطع غيار"],
  },
  {
    id: "real-estate",
    title: "عقارات",
    description: "بيع وإيجار ومشاريع ووسطاء ضمن متجر واحد.",
    icon: Building2,
    gradient: "from-emerald-950 via-teal-900 to-cyan-800",
    features: ["بيع", "إيجار", "مشاريع"],
  },
  {
    id: "electronics",
    title: "إلكترونيات",
    description: "أجهزة، إكسسوارات، صيانة وضمانات.",
    icon: CircuitBoard,
    gradient: "from-indigo-950 via-violet-900 to-fuchsia-800",
    features: ["أجهزة", "ماركات", "ضمان"],
  },
  {
    id: "fashion",
    title: "أزياء وموضة",
    description: "ملابس، أحذية، عطور وإكسسوارات.",
    icon: Shirt,
    gradient: "from-rose-950 via-pink-900 to-fuchsia-700",
    features: ["مقاسات", "ألوان", "تشكيلات"],
  },
  {
    id: "furniture",
    title: "أثاث وديكور",
    description: "أثاث منزلي ومكتبي وتصميم داخلي.",
    icon: Home,
    gradient: "from-amber-950 via-orange-900 to-yellow-700",
    features: ["أثاث", "ديكور", "تفصيل"],
  },
  {
    id: "contracting",
    title: "مقاولات ومعدات",
    description: "خدمات تنفيذ، معدات، مواد بناء وموردون.",
    icon: Hammer,
    gradient: "from-stone-950 via-amber-950 to-orange-800",
    features: ["خدمات", "معدات", "مشاريع"],
  },
  {
    id: "agriculture",
    title: "زراعة ومواشي",
    description: "منتجات زراعية، أعلاف، مواشي ومعدات.",
    icon: Wheat,
    gradient: "from-lime-950 via-green-900 to-emerald-700",
    features: ["محاصيل", "مواشي", "معدات"],
  },
  {
    id: "restaurant",
    title: "مطاعم وأغذية",
    description: "قوائم طعام، منتجات غذائية وعروض يومية.",
    icon: UtensilsCrossed,
    gradient: "from-red-950 via-orange-900 to-amber-700",
    features: ["قوائم", "طلبات", "عروض"],
  },
  {
    id: "handmade",
    title: "حرف يدوية",
    description: "منتجات فنية، هدايا وأعمال مخصصة.",
    icon: Palette,
    gradient: "from-purple-950 via-indigo-900 to-sky-700",
    features: ["تصاميم", "طلبات خاصة", "هدايا"],
  },
  {
    id: "factory",
    title: "مصنع ومنتجات",
    description: "كتالوجات جملة، قدرات إنتاج وطلبات توريد.",
    icon: Factory,
    gradient: "from-slate-950 via-blue-950 to-cyan-800",
    features: ["كتالوج", "توريد", "جملة"],
  },
  {
    id: "wholesale",
    title: "جملة وتوزيع",
    description: "باقات وأسعار كمية وشبكة موزعين.",
    icon: PackageOpen,
    gradient: "from-cyan-950 via-sky-900 to-blue-700",
    features: ["كميات", "موزعون", "أسعار جملة"],
  },
];

export function StoreTemplatePicker({
  onSelect,
}: {
  onSelect: (template: StoreTemplate) => void;
}) {
  return (
    <section className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-market-navy via-market-navy-dark to-primary p-5 text-market-navy-foreground shadow-raised sm:p-8">
        <div className="absolute -end-12 -top-12 size-44 rounded-full bg-market-silver/10 blur-2xl" aria-hidden />
        <div className="absolute -bottom-16 -start-10 size-48 rounded-full bg-primary-foreground/10 blur-3xl" aria-hidden />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-market-silver/30 bg-market-navy-soft/50 px-3 py-1 text-[11px] font-semibold text-market-silver">
            <Sparkles className="size-3.5" aria-hidden />
            قوالب جاهزة حسب النشاط
          </span>
          <h1 className="mt-4 text-2xl font-black leading-tight sm:text-4xl">اختر شكل متجرك</h1>
          <p className="mt-2 max-w-xl text-sm leading-7 text-market-silver-muted sm:text-base">
            اختر القالب الأقرب لنشاطك، وسنجهز لك تجربة متجر مناسبة للتصنيفات والمنتجات والخدمات التي تقدمها.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STORE_TEMPLATES.map((template) => {
          const Icon = template.icon;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template)}
              className="group relative min-h-52 overflow-hidden rounded-2xl border border-border bg-card text-start shadow-panel transition duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${template.gradient}`} aria-hidden />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_35%)]" aria-hidden />
              <div className="relative flex h-full min-h-52 flex-col p-4 text-white">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-12 place-items-center rounded-2xl border border-white/20 bg-white/15 backdrop-blur">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  {template.badge ? (
                    <span className="rounded-full border border-white/20 bg-black/20 px-2.5 py-1 text-[10px] font-bold backdrop-blur">
                      {template.badge}
                    </span>
                  ) : null}
                </div>

                <div className="mt-auto pt-7">
                  <h2 className="text-lg font-black">{template.title}</h2>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/75">{template.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {template.features.map((feature) => (
                      <span key={feature} className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-medium">
                        {feature}
                      </span>
                    ))}
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-white transition group-hover:gap-2">
                    اختيار القالب
                    <ChevronLeft className="size-4" aria-hidden />
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

export function SelectedStoreTemplate({
  template,
  onChange,
}: {
  template: StoreTemplate;
  onChange: () => void;
}) {
  const Icon = template.icon;
  return (
    <div className={`mb-5 overflow-hidden rounded-2xl bg-gradient-to-br ${template.gradient} p-4 text-white shadow-panel`}>
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/20 bg-white/15">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-white/60">قالب المتجر المختار</p>
          <h2 className="truncate text-base font-black">{template.title}</h2>
        </div>
        <button type="button" onClick={onChange} className="shrink-0 rounded-full border border-white/20 bg-black/15 px-3 py-1.5 text-[11px] font-bold hover:bg-black/25">
          تغيير
        </button>
      </div>
    </div>
  );
}

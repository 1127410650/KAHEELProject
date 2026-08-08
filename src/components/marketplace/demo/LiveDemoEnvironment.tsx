import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarCheck2,
  Check,
  ChevronLeft,
  CircleDot,
  Clock3,
  ExternalLink,
  Fuel,
  HeartPulse,
  Link2,
  PackageCheck,
  Play,
  RefreshCw,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { useI18n } from "@/i18n";
import {
  LIVE_DEMO_INTEGRATIONS,
  LIVE_DEMO_ROLES,
  type LiveDemoRoleId,
  type LiveDemoTone,
} from "@/lib/live-demo";

const ROLE_ICONS: Record<LiveDemoRoleId, LucideIcon> = {
  customer: UserRound,
  store: Store,
  clinic: HeartPulse,
  barber: Scissors,
  station: Fuel,
  carrier: Truck,
  platform: ShieldCheck,
};

const TONES: Record<
  LiveDemoTone,
  { rail: string; hero: string; soft: string; text: string; ring: string }
> = {
  blue: {
    rail: "bg-blue-600 text-white shadow-blue-900/20",
    hero: "from-[#071d46] via-[#0b5cc5] to-[#39a4ff]",
    soft: "bg-blue-50 text-blue-700",
    text: "text-blue-700",
    ring: "ring-blue-200",
  },
  amber: {
    rail: "bg-amber-500 text-white shadow-amber-900/20",
    hero: "from-[#3d2005] via-[#b65a0a] to-[#f2b52f]",
    soft: "bg-amber-50 text-amber-800",
    text: "text-amber-700",
    ring: "ring-amber-200",
  },
  emerald: {
    rail: "bg-emerald-600 text-white shadow-emerald-900/20",
    hero: "from-[#052c27] via-[#087f67] to-[#31bca0]",
    soft: "bg-emerald-50 text-emerald-800",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
  },
  rose: {
    rail: "bg-rose-600 text-white shadow-rose-900/20",
    hero: "from-[#3b1020] via-[#a8214d] to-[#ef6d8d]",
    soft: "bg-rose-50 text-rose-800",
    text: "text-rose-700",
    ring: "ring-rose-200",
  },
  violet: {
    rail: "bg-violet-600 text-white shadow-violet-900/20",
    hero: "from-[#1c1241] via-[#5c32aa] to-[#9a72ea]",
    soft: "bg-violet-50 text-violet-800",
    text: "text-violet-700",
    ring: "ring-violet-200",
  },
  cyan: {
    rail: "bg-cyan-600 text-white shadow-cyan-900/20",
    hero: "from-[#062936] via-[#087a96] to-[#2fb8d1]",
    soft: "bg-cyan-50 text-cyan-800",
    text: "text-cyan-700",
    ring: "ring-cyan-200",
  },
  slate: {
    rail: "bg-slate-800 text-white shadow-slate-950/20",
    hero: "from-[#071121] via-[#182c4d] to-[#385478]",
    soft: "bg-slate-100 text-slate-800",
    text: "text-slate-700",
    ring: "ring-slate-200",
  },
};

const ROLE_DOMAINS: Record<LiveDemoRoleId, { ar: string; en: string }> = {
  customer: { ar: "السوق والحجوزات", en: "Market and bookings" },
  store: { ar: "التجارة والطلبات", en: "Commerce and orders" },
  clinic: { ar: "الصحة والمواعيد", en: "Health and bookings" },
  barber: { ar: "العناية والطابور", en: "Care and queue" },
  station: { ar: "المركبات والتشغيل", en: "Vehicles and operations" },
  carrier: { ar: "الشحن والشراكات", en: "Shipping and partnerships" },
  platform: { ar: "الرقابة والتكامل", en: "Oversight and integration" },
};

function text(locale: "ar" | "en", ar: string, en: string) {
  return locale === "ar" ? ar : en;
}

export function LiveDemoEnvironment() {
  const { locale } = useI18n();
  const [activeId, setActiveId] = useState<LiveDemoRoleId>("customer");
  const [completed, setCompleted] = useState<Set<LiveDemoRoleId>>(() => new Set());
  const active = useMemo(
    () => LIVE_DEMO_ROLES.find((role) => role.id === activeId) ?? LIVE_DEMO_ROLES[0]!,
    [activeId],
  );
  const Icon = ROLE_ICONS[active.id];
  const tone = TONES[active.tone];
  const actionCompleted = completed.has(active.id);

  const completeAction = () => {
    setCompleted((current) => new Set([...current, active.id]));
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef3f9_0%,#f8fafc_20rem,#f3f6fa_100%)] pb-8 text-slate-950">
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-[11px] font-black leading-5 text-amber-950 sm:text-xs">
        <span className="me-1.5 inline-block size-2 rounded-full bg-amber-500 motion-safe:animate-pulse" />
        {text(
          locale,
          "بيئة تجريبية حيّة على گحيل — البيانات للعرض، ولا تُنفَّذ منها دفعات أو طلبات حقيقية",
          "Live Gohail demo — display data only; no real payments or orders are created",
        )}
      </div>

      <main className="mx-auto w-full max-w-[1240px] space-y-5 px-4 py-4 sm:px-5 sm:py-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[30px] bg-[#071d46] px-5 py-7 text-white shadow-[0_22px_54px_rgb(7_29_70/0.23)] sm:px-8 sm:py-9 lg:px-10">
          <div className="absolute -end-16 -top-24 size-72 rounded-full bg-[#1685ff]/30 blur-3xl" />
          <div className="absolute -bottom-24 start-[25%] size-64 rounded-full bg-cyan-300/15 blur-3xl" />
          <div className="relative grid items-center gap-7 lg:grid-cols-[1fr_0.78fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black text-cyan-100 backdrop-blur sm:text-xs">
                <Sparkles className="size-3.5" aria-hidden />
                {text(locale, "عرض كامل قبل الإطلاق النهائي", "Full preview before final launch")}
              </div>
              <h1 className="mt-4 max-w-3xl text-3xl font-black leading-[1.2] tracking-tight sm:text-4xl lg:text-5xl">
                {text(locale, "جرّب منظومة گحيل كاملة", "Explore the complete Gohail ecosystem")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70 sm:text-base sm:leading-8">
                {text(
                  locale,
                  "تنقّل بين أنواع الحسابات وشاهد كيف تتصل الإعلانات والمتاجر والخدمات والحجوزات وشركات الشحن والتكاملات الخارجية ضمن حساب واحد معزول.",
                  "Switch between account types and see how listings, stores, services, bookings, carriers, and external integrations connect through one isolated account model.",
                )}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <a
                  href="#demo-workspace"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-xs font-black text-[#071d46] shadow-lg transition hover:-translate-y-0.5"
                >
                  <Play className="size-4 fill-current" aria-hidden />
                  {text(locale, "ابدأ التجربة", "Start the demo")}
                </a>
                <Link
                  to="/demo-stores/$worldId"
                  params={{ worldId: "restaurants" }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 text-xs font-black text-white backdrop-blur transition hover:bg-white/15"
                >
                  <ShoppingBag className="size-4" aria-hidden />
                  {text(locale, "شاهد نماذج المتاجر", "View store examples")}
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
              {[
                ["7", text(locale, "أنواع حسابات", "Account types")],
                ["12", text(locale, "رحلة تشغيل", "Workflows")],
                ["21", text(locale, "فئة مقدم", "Provider classes")],
                ["0", text(locale, "عمليات مالية", "Real payments")],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/12 bg-white/[0.08] p-4 text-center backdrop-blur"
                >
                  <strong className="num block text-2xl font-black text-white sm:text-3xl">
                    {value}
                  </strong>
                  <span className="mt-1 block text-[10px] font-bold text-white/58 sm:text-xs">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="demo-workspace" aria-labelledby="demo-roles-title" className="scroll-mt-24">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black text-[#0b5cc5] sm:text-xs">
                {text(locale, "تبديل الهوية التجريبية", "Demo identity switcher")}
              </p>
              <h2 id="demo-roles-title" className="mt-1 text-xl font-black sm:text-2xl">
                {text(locale, "اختر الحساب الذي تريد تجربته", "Choose an account to explore")}
              </h2>
            </div>
            <span className="hidden rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-slate-500 shadow-sm ring-1 ring-slate-200 sm:inline-flex">
              {completed.size}/{LIVE_DEMO_ROLES.length}{" "}
              {text(locale, "إجراءات جُرّبت", "actions tried")}
            </span>
          </div>

          <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0 lg:grid-cols-7">
            {LIVE_DEMO_ROLES.map((role) => {
              const RoleIcon = ROLE_ICONS[role.id];
              const selected = role.id === active.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setActiveId(role.id)}
                  aria-pressed={selected}
                  className={
                    selected
                      ? `min-h-[112px] min-w-[132px] snap-start rounded-2xl p-3 text-start shadow-lg transition ${TONES[role.tone].rail}`
                      : "min-h-[112px] min-w-[132px] snap-start rounded-2xl bg-white p-3 text-start text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
                  }
                >
                  <span
                    className={
                      selected
                        ? "grid size-9 place-items-center rounded-xl bg-white/15"
                        : `grid size-9 place-items-center rounded-xl ${TONES[role.tone].soft}`
                    }
                  >
                    <RoleIcon className="size-[18px]" aria-hidden />
                  </span>
                  <span className="mt-2 block text-xs font-black">
                    {text(locale, role.titleAr, role.titleEn)}
                  </span>
                  <span
                    className={
                      selected
                        ? "mt-1 block text-[9px] text-white/70"
                        : "mt-1 block text-[9px] text-slate-400"
                    }
                  >
                    {text(locale, ROLE_DOMAINS[role.id].ar, ROLE_DOMAINS[role.id].en)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section
          aria-live="polite"
          className="overflow-hidden rounded-[30px] bg-white shadow-[0_18px_50px_rgb(15_23_42/0.10)] ring-1 ring-slate-200"
        >
          <div
            className={`relative overflow-hidden bg-gradient-to-br ${tone.hero} px-5 py-6 text-white sm:px-7`}
          >
            <div className="absolute -end-14 -top-16 size-48 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex flex-wrap items-start gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/12 backdrop-blur">
                <Icon className="size-7" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-black sm:text-3xl">
                    {text(locale, active.accountAr, active.accountEn)}
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/14 px-2.5 py-1 text-[9px] font-black ring-1 ring-white/20 sm:text-[10px]">
                    <BadgeCheck className="size-3" aria-hidden />
                    {text(locale, active.badgeAr, active.badgeEn)}
                  </span>
                </div>
                <p className="mt-1 text-xs font-bold text-white/72 sm:text-sm">
                  {text(locale, active.subtitleAr, active.subtitleEn)}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setCompleted((current) => {
                    const next = new Set(current);
                    next.delete(active.id);
                    return next;
                  })
                }
                className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white/75 transition hover:bg-white/20 hover:text-white"
                aria-label={text(locale, "إعادة ضبط الإجراء", "Reset action")}
              >
                <RefreshCw className="size-4" aria-hidden />
              </button>
            </div>
          </div>

          <div className="space-y-5 p-4 sm:p-6">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {active.metrics.map((metric) => (
                <div
                  key={metric.labelAr}
                  className={`rounded-2xl bg-slate-50 p-3.5 ring-1 ${tone.ring}`}
                >
                  <p className="text-[10px] font-bold text-slate-500 sm:text-xs">
                    {text(locale, metric.labelAr, metric.labelEn)}
                  </p>
                  <p className={`num mt-1 text-2xl font-black sm:text-3xl ${tone.text}`}>
                    {metric.value}
                  </p>
                  <p className="mt-1 truncate text-[9px] font-semibold text-slate-400 sm:text-[10px]">
                    {text(locale, metric.hintAr, metric.hintEn)}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.16fr_0.84fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black text-slate-400">
                      {text(locale, "العمل المطلوب الآن", "What needs attention")}
                    </p>
                    <h3 className="mt-0.5 text-base font-black">
                      {text(locale, "صندوق التشغيل", "Operations queue")}
                    </h3>
                  </div>
                  <Activity className={`size-5 ${tone.text}`} aria-hidden />
                </div>
                <div className="mt-3 space-y-2">
                  {active.queue.map((item) => (
                    <div
                      key={item.titleAr}
                      className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100"
                    >
                      <span
                        className={
                          item.state === "done"
                            ? "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"
                            : item.state === "active"
                              ? `mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${tone.soft}`
                              : "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700"
                        }
                      >
                        {item.state === "done" ? (
                          <Check className="size-4" />
                        ) : item.state === "active" ? (
                          <CircleDot className="size-4" />
                        ) : (
                          <Clock3 className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black sm:text-sm">
                          {text(locale, item.titleAr, item.titleEn)}
                        </p>
                        <p className="mt-1 truncate text-[10px] text-slate-500 sm:text-xs">
                          {text(locale, item.metaAr, item.metaEn)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[8px] font-black text-slate-600 ring-1 ring-slate-200 sm:text-[9px]">
                        {text(locale, item.statusAr, item.statusEn)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={`size-5 ${tone.text}`} aria-hidden />
                    <h3 className="text-sm font-black">
                      {text(locale, "قدرات هذا الحساب", "Account capabilities")}
                    </h3>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(locale === "ar" ? active.capabilitiesAr : active.capabilitiesEn).map(
                      (capability) => (
                        <div
                          key={capability}
                          className="flex min-h-14 items-center gap-2 rounded-xl bg-white px-3 text-[10px] font-bold text-slate-700 ring-1 ring-slate-200 sm:text-xs"
                        >
                          <Check className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
                          {capability}
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={completeAction}
                  disabled={actionCompleted}
                  className={
                    actionCompleted
                      ? "flex min-h-[72px] w-full items-center gap-3 rounded-2xl bg-emerald-600 px-4 text-start text-white shadow-lg shadow-emerald-900/15"
                      : `flex min-h-[72px] w-full items-center gap-3 rounded-2xl bg-gradient-to-br ${tone.hero} px-4 text-start text-white shadow-lg transition hover:-translate-y-0.5`
                  }
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15">
                    {actionCompleted ? (
                      <Check className="size-5" />
                    ) : (
                      <Play className="size-4 fill-current" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-xs font-black sm:text-sm">
                      {actionCompleted
                        ? text(locale, active.actionDoneAr, active.actionDoneEn)
                        : text(locale, active.primaryActionAr, active.primaryActionEn)}
                    </strong>
                    <small className="mt-1 block text-[9px] text-white/65 sm:text-[10px]">
                      {text(
                        locale,
                        "محاكاة آمنة بلا كتابة في بيانات العملاء",
                        "Safe simulation with no customer-data writes",
                      )}
                    </small>
                  </span>
                  {!actionCompleted ? (
                    <ChevronLeft className="size-5 shrink-0 rtl:rotate-0 ltr:rotate-180" />
                  ) : null}
                </button>
              </div>
            </div>
          </div>
        </section>

        <ConnectedJourney locale={locale} />

        <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <div className="flex items-center gap-2">
              <Link2 className="size-5 text-[#0b5cc5]" aria-hidden />
              <h2 className="text-lg font-black">
                {text(locale, "التكاملات الخارجية", "External integrations")}
              </h2>
            </div>
            <p className="mt-1 text-[10px] leading-5 text-slate-500 sm:text-xs">
              {text(
                locale,
                "مراجع الربط ظاهرة، أما الأسرار ومفاتيح المزود فتبقى خادمية ولا تُرسل للمتصفح.",
                "Connector metadata is visible while provider credentials remain server-side and never reach the browser.",
              )}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {LIVE_DEMO_INTEGRATIONS.map((integration) => (
                <div
                  key={integration.nameAr}
                  className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e8f2ff] text-[#0b5cc5]">
                    <ExternalLink className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black">
                      {text(locale, integration.nameAr, integration.nameEn)}
                    </p>
                    <p className="mt-0.5 truncate text-[9px] text-slate-500">
                      {text(locale, integration.ownerAr, integration.ownerEn)}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-[8px] font-black text-emerald-700">
                    {text(locale, integration.statusAr, integration.statusEn)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[26px] bg-[#071d46] p-5 text-white shadow-sm sm:p-6">
            <div className="flex items-center gap-2 text-cyan-200">
              <BarChart3 className="size-5" aria-hidden />
              <span className="text-[10px] font-black sm:text-xs">
                {text(locale, "جاهزية العرض", "Demo readiness")}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-black">
              {text(locale, "كل الفئات داخل نموذج واحد", "Every category in one model")}
            </h2>
            <p className="mt-2 text-xs leading-6 text-white/65">
              {text(
                locale,
                "إضافة فئة جديدة لا تحتاج نظامًا مستقلًا؛ نحدد قدراتها، ثم تظهر لها الوحدات المناسبة مع بقاء الحساب والبيانات معزولين.",
                "A new provider category does not need a separate system. Capabilities determine its modules while its account and data remain isolated.",
              )}
            </p>
            <Link
              to="/services"
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-xs font-black text-[#071d46]"
            >
              {text(locale, "تصفح الخدمات الحيّة", "Browse live services")}
              <ArrowLeft className="size-4 rtl:rotate-0 ltr:rotate-180" aria-hidden />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function ConnectedJourney({ locale }: { locale: "ar" | "en" }) {
  const steps = [
    {
      icon: Building2,
      ar: "حساب المتجر",
      en: "Store account",
      detailAr: "ينشر المنتج والإعلان",
      detailEn: "Publishes item and listing",
    },
    {
      icon: PackageCheck,
      ar: "طلب العميل",
      en: "Customer order",
      detailAr: "يُنشأ تحت الحساب نفسه",
      detailEn: "Created under the same account",
    },
    {
      icon: Truck,
      ar: "الناقل الشريك",
      en: "Partner carrier",
      detailAr: "يستلم الشحنة فقط",
      detailEn: "Receives only the shipment",
    },
    {
      icon: UsersRound,
      ar: "العميل",
      en: "Customer",
      detailAr: "يتابع حتى التسليم",
      detailEn: "Tracks through delivery",
    },
  ];
  return (
    <section className="rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <div className="flex items-center gap-2">
        <CalendarCheck2 className="size-5 text-[#0b5cc5]" aria-hidden />
        <h2 className="text-lg font-black">
          {text(locale, "رحلة مترابطة في النظام", "A connected platform journey")}
        </h2>
      </div>
      <p className="mt-1 text-[10px] leading-5 text-slate-500 sm:text-xs">
        {text(
          locale,
          "الشراكة تمرر المهمة اللازمة فقط ولا تمنح عضوية أو صلاحية داخل حساب الطرف الآخر.",
          "The partnership passes only the required task and never grants membership or access to the other account.",
        )}
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step.ar} className="relative rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <span className="grid size-10 place-items-center rounded-xl bg-[#e8f2ff] text-[#0b5cc5]">
                <step.icon className="size-5" aria-hidden />
              </span>
              <span className="num text-[10px] font-black text-slate-300">0{index + 1}</span>
            </div>
            <h3 className="mt-3 text-xs font-black sm:text-sm">{text(locale, step.ar, step.en)}</h3>
            <p className="mt-1 text-[9px] text-slate-500 sm:text-[10px]">
              {text(locale, step.detailAr, step.detailEn)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import ar from "./ar.json";
import en from "./en.json";

export type Locale = "ar" | "en";

const dictionaries: Record<Locale, Record<string, unknown>> = { ar, en };

// Product-copy overrides keep current terminology consistent without changing
// database names, RLS policies, or internal tenant semantics.
const COPY_OVERRIDES: Record<Locale, Record<string, string>> = {
  ar: {
    "signup.publicSubtitle": "أنشئ حساب عميل عادي لاستخدام السوق.",
    "signup.individualNote":
      "يمكنك بعد الدخول فتح حساب متجر أو التقديم كمقدم خدمة. حساب مدير النظام داخلي فقط.",
    "market.entry.kind.business": "متجر",
    "market.entry.businessSection": "متاجري",
    "market.entry.noBusinesses": "لا يوجد متجر حتى الآن.",
    "market.entry.newBusiness": "فتح حساب متجر",
    "market.entry.newBusinessHint": "قدّم طلب الانضمام ويُفعّل حساب العمل بعد المراجعة والقبول.",
    "market.business.new": "إنشاء متجر",
    "market.business.profile": "ملف المتجر",
    "market.business.manage": "إدارة المتجر",
    "market.more.business": "المتجر",
    "market.form.publishingAs": "سيُنشر الإعلان من حسابك الحالي.",
    "market.addListing": "إنشاء إعلان",
    "market.createStore": "إنشاء متجر",
    "market.services.myBookings": "حجوزاتي",
    "market.services.providerCenter": "مركز مقدم الخدمة",
    "market.services.manageServices": "إدارة الخدمات",
    "market.services.providerCenterHint":
      "تابع طلبات المواعيد، أكّدها، وابدأ الخدمة وأنهِها من مكان واحد.",
    "market.services.openProviderCenter": "فتح مركز الخدمة",
    "market.services.bookNow": "احجز موعدًا",
    "market.store.openStore": "فتح المتجر",

    "admin.console": "إدارة المنصة",
    "admin.consoleSubtitle": "مركز تشغيل كَحيل",
    "admin.pageEyebrow": "لوحة الإدارة",
    "admin.nav.businesses": "المتاجر",
    "admin.stats.businesses": "المتاجر",
    "market.admin.verifications": "توثيق المتاجر",
    "admin.consoleBrand": "لوحة كَحيل",
    "admin.paletteActive": "اللوحة المفعّلة",
    "admin.navSections.overview": "نظرة عامة",
    "admin.navSections.inbox": "صندوق العمل",
    "admin.navSections.market": "السوق والإعلانات",
    "admin.navSections.accounts": "الحسابات والمنشآت",
    "admin.navSections.verification": "التوثيق",
    "admin.navSections.reports": "البلاغات والاعتراضات",
    "admin.navSections.references": "التصنيفات والأنشطة والمواقع",
    "admin.navSections.analytics": "التقارير والتحليلات",
    "admin.navSections.staff": "المستخدمون الإداريون والصلاحيات",
    "admin.navSections.audit": "سجل العمليات",
    "admin.navSections.studio": "الاستوديو والمحتوى",
    "admin.navSections.content": "الأقسام والمحتوى",
    "admin.navSections.campaigns": "الحملات والستوري",
    "admin.navSections.aqar": "العقار",
    "admin.navSections.finance": "المالية والرصيد",
    "admin.navSections.guide": "الدليل",
    "admin.navSections.labels": "المسميات",
    "admin.navSections.settings": "إعدادات المنصة",
    "admin.studio.title": "استوديو كَحيل",
    "admin.studio.subtitle": "الترتيب الكلي والرسم وألوان المنصة من مكان واحد.",
    "admin.studio.eyebrow": "الاستوديو",
    "admin.studio.heroTitle": "رتّب المنصة وارسمها كما تريد",
    "admin.studio.heroDesc":
      "المؤلّف يرتّب كتل الصفحات، والرسم يبني الأشكال والتصاميم الموسومة، وألوان المنصة والوسائط تضبط الهوية — كل ذلك على بعد لمستين.",
    "admin.studio.openComposer": "فتح المؤلّف",
    "admin.studio.liveEdit": "وضع التحرير الحي",
    "admin.studio.composer": "المؤلّف",
    "admin.studio.composerDesc": "الترتيب الكلي: الكتل، الصفحة البيضاء، والنسخ.",
    "admin.studio.shapes": "الرسم والأشكال",
    "admin.studio.shapesDesc": "مكتبة الأشكال، محرر الرسم، الختم، والتنويعات.",
    "admin.studio.palette": "ألوان المنصة",
    "admin.studio.paletteDesc": "اللوحات والمنتقيات وفحص التباين.",
    "admin.studio.media": "الوسائط",
    "admin.studio.mediaDesc": "فتحات الصور وتنويعات الصفحات.",
    "admin.studio.statsTitle": "أرقام سريعة",
    "admin.studio.statsHint": "من بيانات المنصة الحقيقية — كل رقم يفتح شاشته.",
    "admin.studio.statListings": "إعلانات نشطة",
    "admin.studio.statRequests": "طلبات اليوم",
    "admin.studio.statCampaigns": "حملات فعّالة",
    "admin.studio.statLastEdit": "آخر تعديل مظهر",

    "admin.nav.designs": "مكتبة التصاميم",
    "admin.nav.canvasStudio": "استوديو الرسم",
    "admin.studio.canvas": "ورقة الرسم",
    "admin.studio.canvasDesc": "ارسم كتلة من الصفر ثم صدّرها ككتلة قابلة للنقر.",
    "admin.nav.integrations": "الخدمات الخارجية",
    "admin.nav.pricing": "الأسعار وسعر الصرف",
    "admin.dashboardBadge": "مركز المتابعة",
    "admin.dashboardWelcome": "كل عمليات المنصة في مكان واحد",
    "admin.dashboardIntro":
      "تابع المستخدمين والمتاجر والإعلانات والطلبات العاجلة من لوحة واضحة وسريعة.",
    "admin.dashboardPending": "يحتاج متابعة",
    "admin.dashboardOverview": "ملخص المنصة",
    "admin.dashboardOverviewHint": "الأرقام الحالية مرتبطة مباشرة بصفحات الإدارة والتفاصيل.",
    "admin.actionNeededHint": "العناصر التي تحتاج مراجعة أو قرارًا من فريق الإدارة.",
  },
  en: {
    "signup.publicSubtitle": "Create a regular customer account to use the marketplace.",
    "signup.individualNote":
      "After signing in, you can open a store account or apply as a service provider. System administrator accounts are internal only.",
    "market.entry.kind.business": "Store",
    "market.entry.businessSection": "My stores",
    "market.entry.noBusinesses": "No store has been created yet.",
    "market.entry.newBusiness": "Open a store account",
    "market.entry.newBusinessHint":
      "Apply to join; the work account activates after review and approval.",
    "market.business.new": "Create a store",
    "market.business.profile": "Store profile",
    "market.business.manage": "Manage store",
    "market.more.business": "Store",
    "market.form.publishingAs": "This listing will be published from your current account.",
    "market.addListing": "Create listing",
    "market.createStore": "Create store",
    "market.services.myBookings": "My bookings",
    "market.services.providerCenter": "Provider center",
    "market.services.manageServices": "Manage services",
    "market.services.providerCenterHint":
      "Review booking requests, confirm appointments, and run each service from one place.",
    "market.services.openProviderCenter": "Open provider center",
    "market.services.bookNow": "Book an appointment",
    "market.store.openStore": "Open store",

    "admin.console": "Platform management",
    "admin.consoleSubtitle": "Kaheel operations center",
    "admin.pageEyebrow": "Administration",
    "admin.nav.businesses": "Businesses",
    "admin.stats.businesses": "Businesses",
    "market.admin.verifications": "Business verification",
    "admin.consoleBrand": "Kaheel console",
    "admin.paletteActive": "Active palette",
    "admin.navSections.overview": "Overview",
    "admin.navSections.inbox": "Work inbox",
    "admin.navSections.market": "Marketplace and listings",
    "admin.navSections.accounts": "Accounts and businesses",
    "admin.navSections.verification": "Verification",
    "admin.navSections.reports": "Reports and appeals",
    "admin.navSections.references": "Categories, activities and places",
    "admin.navSections.analytics": "Reports and analytics",
    "admin.navSections.staff": "Platform staff and permissions",
    "admin.navSections.audit": "Operations log",
    "admin.navSections.studio": "Studio and content",
    "admin.navSections.content": "Sections and content",
    "admin.navSections.campaigns": "Campaigns and stories",
    "admin.navSections.aqar": "Real estate",
    "admin.navSections.finance": "Finance and credit",
    "admin.navSections.guide": "Guide",
    "admin.navSections.labels": "Labels",
    "admin.navSections.settings": "Platform settings",
    "admin.studio.title": "Kaheel Studio",
    "admin.studio.subtitle": "Total arrangement, drawing, and platform colors in one place.",
    "admin.studio.eyebrow": "Studio",
    "admin.studio.heroTitle": "Arrange and draw the whole platform",
    "admin.studio.heroDesc":
      "The composer arranges page blocks, the drawing tools build shapes and branded designs, and platform colors and media set the identity — all two taps away.",
    "admin.studio.openComposer": "Open composer",
    "admin.studio.liveEdit": "Live edit mode",
    "admin.studio.composer": "Composer",
    "admin.studio.composerDesc": "Total arrangement: blocks, blank page, and copies.",
    "admin.studio.shapes": "Drawing and shapes",
    "admin.studio.shapesDesc": "Shape library, canvas editor, brand stamp, variants.",
    "admin.studio.palette": "Platform colors",
    "admin.studio.paletteDesc": "Palettes, pickers, and the contrast guard.",
    "admin.studio.media": "Media",
    "admin.studio.mediaDesc": "Image slots and page variants.",
    "admin.studio.statsTitle": "Quick stats",
    "admin.studio.statsHint": "Live platform data — each number opens its screen.",
    "admin.studio.statListings": "Active listings",
    "admin.studio.statRequests": "Requests today",
    "admin.studio.statCampaigns": "Live campaigns",
    "admin.studio.statLastEdit": "Last appearance edit",

    "admin.nav.designs": "Design library",
    "admin.nav.canvasStudio": "Canvas studio",
    "admin.studio.canvas": "Canvas sheet",
    "admin.studio.canvasDesc": "Draw a block from scratch, then export it as a clickable block.",
    "admin.nav.integrations": "External services",
    "admin.nav.pricing": "Pricing and exchange rate",
    "admin.dashboardBadge": "Operations center",
    "admin.dashboardWelcome": "All platform operations in one place",
    "admin.dashboardIntro":
      "Monitor users, businesses, listings, and urgent work from a clear and fast dashboard.",
    "admin.dashboardPending": "Needs attention",
    "admin.dashboardOverview": "Platform overview",
    "admin.dashboardOverviewHint": "Current figures link directly to their management pages.",
    "admin.actionNeededHint":
      "Items that require review or a decision from the administration team.",
  },
};

const STORAGE_KEY = "tahqaq.locale";
let memoryLocale: Locale | null = null;

function lookup(dict: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split(".");
  let current: unknown = dict;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

/** Humanized fallback so a missing string never shows a raw key to the user. */
function fallbackLabel(key: string): string {
  const last = key.split(".").pop() ?? key;
  return last
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (character) => character.toUpperCase());
}

type Vars = Record<string, string | number>;

interface I18nContextValue {
  locale: Locale;
  dir: "rtl" | "ltr";
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Vars) => string;
  tl: (key: string, locale: Locale, vars?: Vars) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function translate(locale: Locale, key: string, vars?: Vars): string {
  const value =
    COPY_OVERRIDES[locale][key] ??
    lookup(dictionaries[locale], key) ??
    COPY_OVERRIDES[locale === "ar" ? "en" : "ar"][key] ??
    lookup(dictionaries[locale === "ar" ? "en" : "ar"], key) ??
    fallbackLabel(key);
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : `{${name}}`,
  );
}

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "ar";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const locale = stored === "en" ? "en" : stored === "ar" ? "ar" : memoryLocale;
    return locale ?? "ar";
  } catch {
    return memoryLocale ?? "ar";
  }
}

const localeListeners = new Set<() => void>();

function subscribeLocale(onChange: () => void) {
  localeListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    localeListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, readStoredLocale, () => "ar" as Locale);

  const setLocale = useCallback((next: Locale) => {
    memoryLocale = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The selected locale still applies to this render through subscribers;
      // it simply cannot persist when the browser denies local storage.
    }
    for (const listener of localeListeners) listener();
  }, []);

  const dir = locale === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dir,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
      tl: (key, forced, vars) => translate(forced, key, vars),
    }),
    [locale, dir, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

const fallbackI18n: I18nContextValue = {
  locale: "ar",
  dir: "rtl",
  setLocale: (next) => {
    if (typeof window !== "undefined") {
      memoryLocale = next;
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Keep the standalone error/404 boundary usable in embedded previews.
      }
      for (const listener of localeListeners) listener();
    }
  },
  t: (key, vars) => translate(readStoredLocale(), key, vars),
  tl: (key, forced, vars) => translate(forced, key, vars),
};

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context && import.meta.env.DEV) {
    console.warn("[i18n] useI18n rendered outside I18nProvider — using fallback dictionary.");
  }
  return context ?? fallbackI18n;
}

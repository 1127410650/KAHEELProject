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

// Product-copy overrides keep the current public-market terminology consistent
// without changing database names, RLS policies, or internal tenant semantics.
const COPY_OVERRIDES: Record<Locale, Record<string, string>> = {
  ar: {
    "signup.publicSubtitle": "أنشئ حسابًا لاستخدام السوق.",
    "signup.individualNote": "يمكنك إنشاء متجر لبيع منتجات.",
    "market.entry.kind.business": "متجر",
    "market.entry.businessSection": "متاجري",
    "market.entry.noBusinesses": "لا يوجد متجر حتى الآن.",
    "market.entry.newBusiness": "إنشاء متجر",
    "market.entry.newBusinessHint": "أنشئ متجرًا لعرض منتجاتك وإدارة إعلاناتك.",
    "market.business.new": "إنشاء متجر",
    "market.business.profile": "ملف المتجر",
    "market.business.manage": "إدارة المتجر",
    "market.more.business": "المتجر",
    "market.form.publishingAs": "سيُنشر الإعلان من حسابك الحالي.",
  },
  en: {
    "signup.publicSubtitle": "Create an account to use the marketplace.",
    "signup.individualNote": "You can create a store to sell products.",
    "market.entry.kind.business": "Store",
    "market.entry.businessSection": "My stores",
    "market.entry.noBusinesses": "No store has been created yet.",
    "market.entry.newBusiness": "Create a store",
    "market.entry.newBusinessHint": "Create a store to showcase products and manage listings.",
    "market.business.new": "Create a store",
    "market.business.profile": "Store profile",
    "market.business.manage": "Manage store",
    "market.more.business": "Store",
    "market.form.publishingAs": "This listing will be published from your current account.",
  },
};

const STORAGE_KEY = "tahqaq.locale";

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
    .replace(/^\w/, (c) => c.toUpperCase());
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
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "en" ? "en" : "ar";
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
    window.localStorage.setItem(STORAGE_KEY, next);
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
      window.localStorage.setItem(STORAGE_KEY, next);
      for (const listener of localeListeners) listener();
    }
  },
  t: (key, vars) => translate(readStoredLocale(), key, vars),
  tl: (key, forced, vars) => translate(forced, key, vars),
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx && import.meta.env.DEV) {
    console.warn("[i18n] useI18n rendered outside I18nProvider — using fallback dictionary.");
  }
  return ctx ?? fallbackI18n;
}

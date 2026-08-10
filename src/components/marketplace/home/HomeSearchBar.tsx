/**
 * شريط البحث المضغوط في الصفحة الرئيسية.
 *
 * • ارتفاع مضغوط (44px جوال / 48px شاشة كبيرة) بدل 56–60px السابق.
 * • زر «البحث التفصيلي» أيقونة فقط على الجوال، ونص على الشاشات الأوسع.
 * • نص متناوب كل 3 ثوانٍ بحركة انزلاق رأسي CSS خفيفة، يتوقف عند تركيز
 *   المستخدم على الحقل ويُحترم فيه `prefers-reduced-motion`.
 * • الارتفاع محجوز بأبعاد ثابتة للنص المتناوب ⇒ صفر هزّة تخطيط.
 */
import { Link } from "@tanstack/react-router";
import { Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import { useI18n } from "@/i18n";
import { nextShortGreetingIndex, shortGreetingAt } from "@/lib/takeover-copy";

const HINTS: { ar: string; en: string }[] = [
  { ar: "ابحث عن مطعم…", en: "Search for a restaurant…" },
  { ar: "ابحث عن شقة للإيجار…", en: "Search for an apartment to rent…" },
  { ar: "ابحث عن سيارة…", en: "Search for a car…" },
  { ar: "ابحث عن مقاضي…", en: "Search for groceries…" },
  { ar: "ابحث عن خدمة…", en: "Search for a service…" },
  { ar: "ابحث عن وظيفة…", en: "Search for a job…" },
];

const ROTATE_MS = 3000;
/** بعد كل دورتين اقتراح بحث يظهر ترحيب قصير من كَحيل (سطر واحد، بلا التفاف). */
const GREETING_EVERY = 3;

export function HomeSearchBar({ label, detailedLabel }: { label: string; detailedLabel: string }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // فهرس الترحيب يتغيّر عند كل ظهور، بلا تكرار متتالٍ لنفس السطر.
  const [greeting, setGreeting] = useState(() => nextShortGreetingIndex());

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setIndex((current) => {
        const next = current + 1;
        if (next % GREETING_EVERY === 0) setGreeting((last) => nextShortGreetingIndex(last));
        return next % (HINTS.length * GREETING_EVERY);
      });
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [paused]);

  // كل خطوة ثالثة ترحيب من كَحيل، وما بينها اقتراحات البحث المعتادة.
  const showGreeting = index % GREETING_EVERY === 0;
  const hint = HINTS[Math.floor(index / GREETING_EVERY) % HINTS.length]!;
  const line = showGreeting ? shortGreetingAt(ar, greeting) : ar ? hint.ar : hint.en;

  return (
    <div
      className="k-surface flex min-h-11 overflow-hidden rounded-[var(--r-card)] focus-within:border-brand-600/60 focus-within:ring-2 focus-within:ring-brand-700/30 sm:min-h-12"
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <Link
        to="/search"
        search={{}}
        aria-label={label}
        className="flex min-w-0 flex-1 items-center gap-[var(--sp-3)] px-3.5 text-brand-800 outline-none"
      >
        <Search className="size-[18px] shrink-0 text-brand-900" aria-hidden />
        {/* ارتفاع ثابت للسطر: النص يتبدّل داخله بلا أي تحرّك للشريط */}
        <span className="relative h-[18px] min-w-0 flex-1 overflow-hidden">
          <span
            key={index}
            className="absolute inset-0 flex items-center truncate text-desc font-semibold leading-[18px] animate-[k-search-hint_3s_ease-in-out_both] motion-reduce:animate-none sm:text-sm"
          >
            {line}
          </span>
        </span>
      </Link>
      <Link
        to="/search"
        search={{ filters: 1 }}
        aria-label={detailedLabel}
        title={detailedLabel}
        className="k-press m-1 inline-flex min-h-9 shrink-0 items-center gap-[var(--sp-2)] rounded-xl bg-[linear-gradient(140deg,#8A4FFF,#C3ABFF)] px-[var(--sp-3)] text-desc font-black text-white outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        <span className="hidden sm:inline">{detailedLabel}</span>
      </Link>
    </div>
  );
}

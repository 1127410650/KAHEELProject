/**
 * ═══════════════════════════════════════════════════════════════════════════
 * `PageStack` — بنية الصفحات الموحّدة في كل المنصة (نمط تطبيقات السوق الكبيرة).
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ترتيب الطبقات ثابت ولا يتغيّر من صفحة لأخرى:
 *  ١) الهيدر (شعار كَحيل + الموقع + الجرس) …………… يقدّمه `MarketShell`
 *  ٢) شريط التصنيفات الأفقي ……………………………… يقدّمه `MarketShell`
 *  ٣) شريط البحث المضغوط ………………………………… `search` (افتراضيًا ظاهر)
 *  ٤) شريط تنبيه/حالة رفيع قابل للإغلاق ……………… `notice`
 *  ٥) بانر إعلاني عريض …………………………………… `banner`
 *  ٦) شبكة بطاقات صغيرة (٤ في الصف) ………………… `tiles`
 *  ٧) شريط تقدّم/تحفيز …………………………………… `progress`
 *  ٨) أقسام محتوى إضافية ……………………………… `children`
 *
 * كل طبقة اختيارية، لكن **الترتيب لا يُعاد ترتيبه في أي صفحة** — لذلك تبدو
 * المنصة متسقة تمامًا. كل الطبقات تحجز ارتفاعها بنفسها (بلا صور بلا أبعاد وبلا
 * ظهور متأخّر يدفع المحتوى) ⇒ صفر هزّة تخطيط.
 */
import { Link } from "@tanstack/react-router";
import { ChevronRight, Search, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { useI18n } from "@/i18n";

// ── ٣) شريط البحث المضغوط ───────────────────────────────────────────────────
/** شريط بحث مضغوط يقود إلى `/search` — نفس الشكل في كل الصفحات. */
export function PageSearchBar({ placeholder, href = "/search" }: { placeholder?: string | undefined; href?: string }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  return (
    <Link
      to={href}
      className="k-surface flex min-h-11 items-center gap-2 rounded-2xl px-3 text-start outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
      aria-label={ar ? "ابحث في كَحيل" : "Search Kaheel"}
    >
      <Search className="size-4 shrink-0 text-brand-700" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-muted-foreground">
        {placeholder ?? (ar ? "ابحث عن أي شي في كَحيل…" : "Search anything on Kaheel…")}
      </span>
    </Link>
  );
}

// ── ٤) شريط التنبيه/الحالة الرفيع ───────────────────────────────────────────
const NOTICE_KEY = (id: string) => `kaheel.notice.${id}`;

/**
 * شريط رفيع للحالة، يظهر عند اللزوم فقط وقابل للإغلاق نهائيًا (يُحفظ الإغلاق).
 * يُركّب دائمًا بارتفاع ثابت 34px حتى لا يقفز المحتوى عند إخفائه.
 */
export function PageNoticeBar({
  id,
  children,
  tone = "info",
}: {
  id: string;
  children: ReactNode;
  tone?: "info" | "warn";
}) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  /**
   * يبدأ ظاهرًا على الخادم وفي أول رسم، ويُخفى بعد الترطيب فقط إذا كان الزائر قد
   * أغلقه سابقًا. الاتجاه مقصود: الظهور المتأخّر يدفع المحتوى (هزّة تخطيط)، أما
   * الإخفاء فلا يدفع شيئًا لأعلى إلا للزائر الذي أغلقه أصلًا ومرة واحدة.
   */
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(NOTICE_KEY(id)) === "off") setOpen(false);
    } catch {
      /* الوضع الخاص: يبقى ظاهرًا */
    }
  }, [id]);


  if (!open) return null;

  return (
    <div
      role="status"
      className={`flex min-h-[34px] items-center gap-2 rounded-xl px-3 py-1 text-[12px] font-bold ${
        tone === "warn"
          ? "bg-[#ffe8b3] text-[#5b3d00]"
          : "bg-brand-300/40 text-brand-900"
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          try {
            window.localStorage.setItem(NOTICE_KEY(id), "off");
          } catch {
            /* الوضع الخاص: الإغلاق لهذه الجلسة فقط */
          }
        }}
        aria-label={ar ? "إغلاق التنبيه" : "Dismiss notice"}
        className="grid size-6 shrink-0 place-items-center rounded-full bg-black/8 outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

// ── ٦) شبكة البطاقات الصغيرة (٤ في الصف) ────────────────────────────────────
export interface PageTile {
  key: string;
  label: string;
  href: string;
  icon?: ReactNode;
}

/** شبكة موحّدة: ٤ بطاقات في الصف على الجوال، ٦ ثم ٨ على الشاشات الأوسع. */
export function PageTileGrid({ items }: { items: PageTile[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
      {items.map((tile) => (
        <li key={tile.key} className="min-w-0">
          <a
            href={tile.href}
            className="k-surface flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-center outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-300/40 text-brand-900">
              {tile.icon}
            </span>
            <span className="w-full truncate text-[11px] font-bold text-brand-950">{tile.label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

// ── ٧) شريط التقدّم/التحفيز ─────────────────────────────────────────────────
export interface ProgressStep {
  key: string;
  label: string;
  href: string;
  done: boolean;
}

/**
 * شريط تحفيز واحد: يعرض أول خطوة ناقصة ونسبة الإنجاز. يختفي كليًا عند إتمام
 * كل الخطوات، ولا يظهر أبدًا بلا خطوات — فلا فراغ ولا قفزة.
 */
export function PageProgressStrip({ steps }: { steps: ProgressStep[] }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  if (steps.length === 0) return null;
  const done = steps.filter((step) => step.done).length;
  if (done === steps.length) return null;
  const next = steps.find((step) => !step.done)!;
  const percent = Math.round((done / steps.length) * 100);

  return (
    <a
      href={next.href}
      className="k-surface flex min-h-[58px] items-center gap-3 rounded-2xl px-3 py-2 outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-brand-700/40"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-black text-brand-950">{next.label}</span>
        <span
          aria-hidden
          className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-brand-300/45"
        >
          <span
            className="block h-full rounded-full bg-[linear-gradient(90deg,#7b2cbf,#c77dff)]"
            style={{ width: `${percent}%` }}
          />
        </span>
        <span className="num mt-1 block text-[11px] font-bold text-brand-800">
          {ar ? `${done}/${steps.length} خطوات — ${percent}%` : `${done}/${steps.length} steps — ${percent}%`}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-brand-700 rtl:rotate-180" aria-hidden />
    </a>
  );
}

// ── التخطيط الموحّد ─────────────────────────────────────────────────────────
export function PageStack({
  search = true,
  searchPlaceholder,
  notice,
  banner,
  tiles,
  progress,
  children,
  width = "wide",
}: {
  /** شريط البحث المضغوط — يمكن إخفاؤه في الصفحات التي فيها بحثها الخاص. */
  search?: boolean;
  searchPlaceholder?: string;
  notice?: ReactNode;
  banner?: ReactNode;
  tiles?: PageTile[];
  progress?: ProgressStep[];
  children?: ReactNode;
  width?: "wide" | "narrow";
}) {
  return (
    <div
      className={`mx-auto flex w-full flex-col gap-3 px-3 py-3 sm:px-4 ${
        width === "narrow" ? "max-w-2xl" : "max-w-[1240px] lg:px-8"
      }`}
    >
      {search && <PageSearchBar placeholder={searchPlaceholder} />}
      {notice}
      {banner}
      {tiles && tiles.length > 0 && <PageTileGrid items={tiles} />}
      {progress && progress.length > 0 && <PageProgressStrip steps={progress} />}
      {children}
    </div>
  );
}

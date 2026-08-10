/**
 * هيكل قسم «كَحيل عقار»: هيدر بنفسجي خاص بالقسم + شريط سفلي خاص به.
 *
 * القسم عالم فرعي: لا يستعمل هيدر السوق العام ولا شريطه السفلي، ويحتفظ بزر
 * رجوع واضح إلى السوق. عرض فقط — لا منطق بيانات هنا.
 */

import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRight, Heart, ClipboardList, MessagesSquare, Search } from "lucide-react";

import { Mascot } from "@/components/marketplace/campaign/Mascot";
import {
  HeaderChip,
  HeaderChipsRow,
  HeaderShapes,
} from "@/components/marketplace/home/noon/CollapsingHeaderParts";
import { useHeaderProgress } from "@/lib/use-header-progress";
import { useLabels } from "@/lib/mkt-ui-labels";

/** ارتفاع هيدر العقار — ثابت 96px (صف الهوية 44 + صف البحث 52) فلا تتحرّك الصفحة. */
const AQAR_HEADER_FULL_H = 96;

const NAV = [
  { to: "/aqar/browse", key: "aqar.browse", label: "تصفّح", icon: Search },
  { to: "/aqar/favorites", key: "aqar.favorites", label: "المفضلة", icon: Heart },
  { to: "/aqar/requests", key: "aqar.requests", label: "طلباتي", icon: ClipboardList },
  { to: "/aqar/chats", key: "aqar.chats", label: "المحادثات", icon: MessagesSquare },
] as const;


function AqarBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const label = useLabels();
  return (
    <nav
      aria-label="تنقل كَحيل عقار"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-3xl items-stretch">
        {NAV.map(({ to, key, label: fallback, icon: Icon }) => {
          const active = pathname === to;
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[47px] flex-col items-center justify-center gap-0.5 py-1 text-nav ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-5" aria-hidden />
                <span className="font-semibold">{label(key, fallback)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AqarShell({
  children,
  title = "كَحيل عقار",
  subtitle,
  back = "/",
  backLabel = "السوق",
}: {
  children: React.ReactNode;
  title?: string | undefined;
  subtitle?: string | undefined;
  back?: string | undefined;
  backLabel?: string | undefined;
}) {
  const p = useHeaderProgress();
  const style = { "--p": p } as React.CSSProperties;
  const label = useLabels();
  return (
    <div
      dir="rtl"
      className="market-surface flex min-h-dvh flex-col overflow-x-clip pb-[calc(3.5rem+env(safe-area-inset-bottom))]"
    >
      <header
        data-kslot="aqar.header"
        style={{
          ...style,
          // تُفرض هنا لأن `.k-header-hero` تعرّف position/الاستدارة خارج طبقات الأدوات.
          position: "fixed",
          borderBottomLeftRadius: "16px",
          borderBottomRightRadius: "16px",
        }}
        className="k-header-hero inset-x-0 top-0 z-40 h-24 overflow-hidden"
      >
        <HeaderShapes />
        {/* صف الهوية: رجوع + اسم القسم + الشخصية — ارتفاع 44px */}
        <div className="k-header-hero relative z-20 mx-auto flex h-11 max-w-3xl items-center gap-3 px-4">
          <Link
            to={back}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-full bg-card/20 px-3 text-desc font-semibold"
          >
            <ArrowRight className="size-4" aria-hidden />
            <span>{backLabel}</span>
          </Link>
          <strong className="min-w-0 flex-1 truncate text-base font-bold">{title}</strong>
          {subtitle ? <span className="sr-only">{subtitle}</span> : null}
          <Mascot name="kaheel" size="sm" className="hidden h-9 w-auto shrink-0 sm:block" />
        </div>
        {/* صف البحث — يبقى دائمًا قابلًا للنقر، بلا أي إعادة تخطيط ⇒ صفر CLS */}
        <div className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-2">
          <a
            href="/aqar/browse"
            className="flex h-11 w-full items-center gap-2 rounded-[var(--r-control)] border border-border bg-card px-3 text-muted-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
            aria-label={label("aqar.searchPlaceholder", "ابحث عن وحدة أو مدينة")}
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="truncate text-sm font-semibold">
              {label("aqar.searchPlaceholder", "ابحث عن وحدة أو مدينة")}
            </span>
          </a>
        </div>
      </header>

      <div aria-hidden style={{ height: `${AQAR_HEADER_FULL_H}px` }} />

      <main className="flex-1">{children}</main>
      <AqarBottomNav />
    </div>
  );
}


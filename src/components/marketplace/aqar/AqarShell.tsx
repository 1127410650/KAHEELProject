/**
 * هيكل قسم «كَحيل عقار»: هيدر بنفسجي خاص بالقسم + شريط سفلي خاص به.
 *
 * القسم عالم فرعي: لا يستعمل هيدر السوق العام ولا شريطه السفلي، ويحتفظ بزر
 * رجوع واضح إلى السوق. عرض فقط — لا منطق بيانات هنا.
 */

import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRight, Heart, ClipboardList, MessagesSquare, Search } from "lucide-react";

import { Mascot } from "@/components/marketplace/campaign/Mascot";

const NAV = [
  { to: "/aqar/browse", label: "بحث", icon: Search },
  { to: "/aqar/favorites", label: "مفضلة", icon: Heart },
  { to: "/aqar/requests", label: "طلباتي", icon: ClipboardList },
  { to: "/aqar/chats", label: "محادثات", icon: MessagesSquare },
] as const;

function AqarBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="تنقل كَحيل عقار"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-3xl items-stretch">
        {NAV.map(({ to, label, icon: Icon }) => {
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
                <span className="font-semibold">{label}</span>
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
  return (
    <div
      dir="rtl"
      className="market-surface flex min-h-dvh flex-col overflow-x-clip pb-[calc(3.5rem+env(safe-area-inset-bottom))]"
    >
      <header data-kslot="aqar.header" className="k-header-hero relative overflow-hidden px-4 pb-5 pt-3">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            to={back}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-full bg-card/20 px-3 text-desc font-semibold"
          >
            <ArrowRight className="size-4" aria-hidden />
            <span>{backLabel}</span>
          </Link>
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-section font-extrabold">{title}</strong>
            {subtitle ? <span className="block truncate text-desc opacity-90">{subtitle}</span> : null}
          </div>
          <Mascot name="kaheel" size="sm" className="hidden h-14 w-auto shrink-0 sm:block" />
        </div>
      </header>

      <main className="flex-1">{children}</main>
      <AqarBottomNav />
    </div>
  );
}

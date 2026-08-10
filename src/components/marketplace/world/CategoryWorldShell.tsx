/**
 * قالب «عالم القسم» العام — هيكل مستوحى من «كَحيل عقار» لكن بلا كود خاص بقسم:
 * هيدر بنفسجي باسم القسم وزر عودة للسوق، وشريط سفلي خاص بالعالم.
 *
 * أي قسم رئيسي (`is_primary`) يحصل على عالمه من هذا القالب على `/c/{slug}`.
 * عرض فقط — لا منطق بيانات هنا.
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRight, LayoutGrid, MessagesSquare, Search, Sparkles } from "lucide-react";

import { Mascot } from "@/components/marketplace/campaign/Mascot";
import { sectionAccent } from "@/lib/section-accent";

export function CategoryWorldShell({
  slug,
  title,
  subtitle,
  children,
}: {
  slug: string;
  title: string;
  subtitle?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div
      dir="rtl"
      /* لمسة لون القسم تُضبط هنا فتسري على الرأس والحالات النشطة داخل العالم. */
      style={{ "--section-accent": sectionAccent(slug) } as React.CSSProperties}
      className="market-surface flex min-h-dvh flex-col overflow-x-clip pb-[calc(3.5rem+env(safe-area-inset-bottom))]"
    >
      <header
        data-kslot={`world.${slug}.header`}
        /* حاشية الأمان + الهامش الأفقي القياسي: مرة واحدة على حاوية الرأس. */
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)" }}
        className="k-header-hero relative overflow-hidden px-[var(--page-x)] pb-[var(--sp-4)]"
      >
        <div className="mx-auto flex min-h-11 max-w-5xl items-center gap-1.5">
          <Link
            to="/"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-full bg-card/20 px-3 text-desc font-semibold"
          >
            <ArrowRight className="size-4" aria-hidden />
            <span>السوق</span>
          </Link>
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-section font-extrabold">{title}</strong>
            {subtitle ? (
              <span className="block truncate text-desc opacity-90">{subtitle}</span>
            ) : null}
          </div>
          <Mascot name="kaheel" size="sm" className="hidden h-14 w-auto shrink-0 sm:block" />
        </div>
      </header>

      <main className="flex-1">{children}</main>
      <WorldBottomNav slug={slug} />
    </div>
  );
}

function WorldBottomNav({ slug }: { slug: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const worldPath = `/c/${slug}`;
  const items = [
    { key: "world", to: worldPath, label: "العالم", icon: LayoutGrid, active: pathname === worldPath },
    { key: "search", to: "/search", label: "بحث", icon: Search, active: false },
    { key: "new", to: "/search", label: "الأحدث", icon: Sparkles, active: false },
    { key: "chats", to: "/my/chats", label: "محادثات", icon: MessagesSquare, active: false },
  ] as const;

  return (
    <nav
      aria-label={`تنقل ${slug}`}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-3xl items-stretch">
        {items.map(({ key, to, label, icon: Icon, active }) => (
          <li key={key} className="flex-1">
            <a
              href={to}
              aria-current={active ? "page" : undefined}
              className={`k-press flex min-h-[47px] flex-col items-center justify-center gap-0.5 py-1 text-nav ${
                active ? "k-accent-text" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-5" aria-hidden />
              <span className="font-semibold">{label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

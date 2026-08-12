/**
 * تبويبات «لوحة الاستديو والمحتوى» — أربعة أقسام فرعية.
 *
 * تبويب «الأكواد البرمجية» لا يُرسَم إلا لمالك المنصة (`is_system_owner`)، لكن
 * الإخفاء هنا تجميلي فقط: الخادم يرفض كل دوال محرر الكود بـ `NOT_OWNER`
 * ومسار `/admin/content/code` نفسه يعرض «ممنوع» لغير المالك.
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { Code2, FileText, Palette, Sparkles } from "lucide-react";

import { usePlatformIdentity } from "@/lib/mkt-platform";

const TABS = [
  { to: "/admin/content", label: "هوية وبيانات المنصة", icon: Sparkles, exact: true },
  { to: "/admin/content/design", label: "خيارات التصميم", icon: Palette, exact: false },
  { to: "/admin/content/pages", label: "صفحات المنصة", icon: FileText, exact: false },
] as const;

export function StudioTabs() {
  const { identity } = usePlatformIdentity();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const isOwner = identity?.is_system_owner === true;

  const items = [
    ...TABS,
    ...(isOwner
      ? ([{ to: "/admin/content/code", label: "الأكواد البرمجية", icon: Code2, exact: false }] as const)
      : []),
  ];

  return (
    <nav
      aria-label="أقسام لوحة الاستديو"
      className="mb-[var(--sp-4)] flex flex-wrap gap-2 border-b border-border pb-2"
    >
      {items.map((tab) => {
        const active = tab.exact ? path === tab.to : path.startsWith(tab.to);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={[
              "inline-flex items-center gap-[var(--sp-2)] rounded-full px-3 py-2 text-desc font-bold transition",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            ].join(" ")}
            style={{ minHeight: 44 }}
          >
            <Icon className="size-4" aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

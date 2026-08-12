/**
 * لوحة الاستديو والمحتوى — تبويب «خيارات التصميم» (/admin/content/design)
 *
 * يجمع رموز التصميم وحضور الشخصيات وتصاميم الصفحات في مكان واحد، ويشرح نطاق
 * كل فتحة من سجل `mkt_editable_slots`: المكوّنات الوظيفية المشتركة معروضة
 * كـ«ثابتة» ولا تُفتح لها لوحة تحرير لأي أحد — بما في ذلك المالك.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutTemplate, Lock, MousePointerClick, Palette } from "lucide-react";

import { AdminCard, AdminPageHead } from "@/components/admin/AdminPage";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { StudioTabs } from "@/components/admin/StudioTabs";
import { DesignTokensCard } from "@/components/marketplace/admin/DesignTokensCard";
import { MascotPresenceCard } from "@/components/marketplace/admin/MascotPresenceCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requestLiveEdit } from "@/lib/mkt-live-edit";
import { useEditableSlots, type SlotScope } from "@/lib/mkt-studio";

export const Route = createFileRoute("/admin/content/design")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "خيارات التصميم — استوديو كَحيل" },
      {
        name: "description",
        content: "رموز التصميم وحضور الشخصيات ونطاق تحرير كل مكوّن في المنصة.",
      },
      { property: "og:title", content: "خيارات التصميم — استوديو كَحيل" },
      { property: "og:description", content: "تحكم كامل في تصميم المنصة بنطاقات محددة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudioDesignRoute,
});

const SCOPE_TEXT: Record<SlotScope, string> = {
  platform: "مدير المنصة",
  store: "صاحب المتجر",
  listing: "صاحب الإعلان",
  functional: "ثابت — مكوّن وظيفي مشترك",
};

function StudioDesignRoute() {
  const slots = useEditableSlots();

  return (
    <AdminShell title="لوحة الاستديو والمحتوى">
      <StudioTabs />
      <AdminPageHead
        title="خيارات التصميم"
        description="كل ما يتعلّق بالشكل: الرموز، الشخصيات، تصاميم الصفحات، ونطاق التحرير لكل مكوّن."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-[var(--sp-2)]"
              onClick={() => {
                requestLiveEdit(true);
                window.location.assign("/");
              }}
              style={{ minHeight: 44 }}
            >
              <MousePointerClick className="size-4" aria-hidden />
              محرر مباشر على الموقع
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-[var(--sp-2)]">
              <Link to="/admin/appearance/variants">
                <LayoutTemplate className="size-4" aria-hidden />
                تصاميم الصفحات
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mb-[var(--sp-4)]">
        <DesignTokensCard />
      </div>

      <div className="mb-[var(--sp-4)]">
        <MascotPresenceCard />
      </div>

      <AdminCard
        title="نطاق التحرير لكل مكوّن"
        description="النطاق مصدره القاعدة، والفحص يتكرّر في كل عملية حفظ — لا اعتماد على الواجهة."
      >
        {slots.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : slots.isError ? (
          <p className="text-body text-destructive">تعذّر تحميل سجل الفتحات — حدّث الصفحة.</p>
        ) : (
          <ul className="space-y-2">
            {(slots.data ?? []).map((slot) => (
              <li
                key={slot.slot_key}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--r-card)] border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <span className="block truncate text-body font-bold text-foreground">
                    {slot.label_ar}
                  </span>
                  <span className="block truncate text-nav text-muted-foreground" dir="ltr">
                    {slot.slot_key} · {slot.module}
                  </span>
                </div>
                <span
                  className={[
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-nav font-bold",
                    slot.scope === "functional"
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/10 text-primary",
                  ].join(" ")}
                >
                  {slot.scope === "functional" ? (
                    <Lock className="size-3.5" aria-hidden />
                  ) : (
                    <Palette className="size-3.5" aria-hidden />
                  )}
                  {SCOPE_TEXT[slot.scope]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </AdminShell>
  );
}

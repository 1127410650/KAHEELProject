/**
 * لوحة الاستديو والمحتوى — تبويب «هوية وبيانات المنصة» (/admin/content)
 *
 * الهوية البصرية (اللوحة والشعار والصور المولّدة) وبيانات التواصل في مكان واحد.
 * كل كتابة تمرّ بدوال SECURITY DEFINER تفحص `mkt_is_platform_admin` في القاعدة.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Code2, FileText, Images, Palette, Settings } from "lucide-react";

import { AdminCard, AdminPageHead } from "@/components/admin/AdminPage";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { StudioTabs } from "@/components/admin/StudioTabs";
import { BrandImageStudio } from "@/components/marketplace/admin/BrandImageStudio";
import { ThemePaletteCard } from "@/components/marketplace/admin/ThemePaletteCard";
import { Button } from "@/components/ui/button";
import { useRefreshMediaSlots } from "@/lib/mkt-media-slots";
import { usePlatformIdentity } from "@/lib/mkt-platform";

export const Route = createFileRoute("/admin/content/")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "هوية وبيانات المنصة — استوديو كَحيل" },
      {
        name: "description",
        content: "لوحة ألوان كَحيل والشعار والصور وبيانات التواصل الرسمية للمنصة.",
      },
      { property: "og:title", content: "هوية وبيانات المنصة — استوديو كَحيل" },
      { property: "og:description", content: "الهوية البصرية وبيانات المنصة من مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudioBrandRoute,
});

function StudioBrandRoute() {
  const refresh = useRefreshMediaSlots();
  const { identity } = usePlatformIdentity();
  const isOwner = identity?.is_system_owner === true;

  return (
    <AdminShell title="لوحة الاستديو والمحتوى">
      <StudioTabs />
      <AdminPageHead
        title="هوية وبيانات المنصة"
        description="اللوحة والشعار والصور وبيانات التواصل — أساس كل ما يظهر للزائر."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline" className="gap-[var(--sp-2)]">
              <Link to="/admin/settings">
                <Settings className="size-4" aria-hidden />
                بيانات التواصل والإعدادات
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-[var(--sp-2)]">
              <Link to="/admin/appearance">
                <Images className="size-4" aria-hidden />
                فتحات الوسائط
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mb-[var(--sp-4)]">
        <ThemePaletteCard />
      </div>

      <AdminCard
        title="مكتبة الصور المولّدة"
        description="التوليد لمدير المنصة فقط بسقف شهري، وكل صورة تُختَم باسم كَحيل قبل الحفظ."
        className="mb-[var(--sp-4)]"
      >
        <BrandImageStudio onChanged={refresh} />
      </AdminCard>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          to="/admin/content/design"
          className="flex items-center gap-[var(--sp-2)] rounded-[var(--r-card)] border border-border bg-card p-3 text-body font-bold text-foreground hover:border-primary/40"
        >
          <Palette className="size-5 text-primary" aria-hidden />
          خيارات التصميم
        </Link>
        <Link
          to="/admin/content/pages"
          className="flex items-center gap-[var(--sp-2)] rounded-[var(--r-card)] border border-border bg-card p-3 text-body font-bold text-foreground hover:border-primary/40"
        >
          <FileText className="size-5 text-primary" aria-hidden />
          صفحات المنصة
        </Link>
        {isOwner ? (
          <Link
            to="/admin/content/code"
            className="flex items-center gap-[var(--sp-2)] rounded-[var(--r-card)] border border-border bg-card p-3 text-body font-bold text-foreground hover:border-primary/40"
          >
            <Code2 className="size-5 text-primary" aria-hidden />
            الأكواد البرمجية
          </Link>
        ) : null}
      </div>
    </AdminShell>
  );
}

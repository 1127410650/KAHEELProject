/**
 * /admin/appearance — مركز إدارة الوسائط: كل «فتحة» بصرية في المنصة في مكان واحد.
 *
 * الشاشة للإدارة فقط (`AdminShell` يفحص `mkt_is_platform_admin` خادميًا)، وكل
 * كتابة تمرّ بدوال SECURITY DEFINER تعيد فحص الصلاحية في القاعدة.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutTemplate } from "lucide-react";

import { AdminShell } from "@/components/marketplace/AdminShell";
import { MediaSlotCard } from "@/components/marketplace/admin/MediaSlotCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { groupSlotsBySection, useMediaSlots, useRefreshMediaSlots } from "@/lib/mkt-media-slots";

export const Route = createFileRoute("/admin/appearance")({
  head: () => ({
    meta: [
      { title: "إدارة المظهر والوسائط — كَحيل" },
      { name: "description", content: "رفع واستبدال وإخفاء صور كل الفتحات البصرية في المنصة." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "إدارة المظهر والوسائط — كَحيل" },
      { property: "og:description", content: "كل عنصر بصري في المنصة يُدار من هنا بلا تعديل كود." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppearancePage,
});

function AppearancePage() {
  const slots = useMediaSlots();
  const refresh = useRefreshMediaSlots();
  const groups = groupSlotsBySection(slots.data ?? []);

  return (
    <AdminShell
      title="إدارة المظهر والوسائط"
      actions={
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link to="/admin/appearance/variants">
            <LayoutTemplate className="size-4" aria-hidden />
            تصاميم الصفحات
          </Link>
        </Button>
      }
    >
      <p className="mb-4 rounded-2xl border border-primary/25 bg-primary/8 p-3 text-desc text-foreground">
        كل صورة في الواجهة العامة مرتبطة بفتحة هنا. الرفع يضغط الصورة تلقائيًا (أطول ضلع ١٦٠٠ بكسل ·
        صيغة WebP · حتى ٣٠٠ كيلوبايت)، والفتحة الفارغة تعرض صورة احتياطية مفتوحة الترخيص. الفيديو
        حاليًا برابط خارجي فقط.
      </p>

      {slots.isPending ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : slots.isError ? (
        <p className="text-body text-destructive">تعذّر تحميل الفتحات — حدّث الصفحة.</p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.section} aria-labelledby={`slot-${group.section}`}>
              <h2 id={`slot-${group.section}`} className="mb-2 text-section font-extrabold text-foreground">
                {group.label}
                <span className="ms-2 text-nav font-bold text-muted-foreground">
                  {group.slots.length.toLocaleString("en-US")}
                </span>
              </h2>
              <ul className="grid gap-3 lg:grid-cols-2">
                {group.slots.map((slot) => (
                  <MediaSlotCard key={slot.slot_key} slot={slot} onChanged={refresh} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

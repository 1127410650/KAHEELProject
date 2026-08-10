/**
 * /admin/appearance — مركز إدارة الوسائط: كل «فتحة» بصرية في المنصة في مكان واحد.
 *
 * الشاشة للإدارة فقط (`AdminShell` يفحص `mkt_is_platform_admin` خادميًا)، وكل
 * كتابة تمرّ بدوال SECURITY DEFINER تعيد فحص الصلاحية في القاعدة.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleDollarSign, LayoutTemplate, MousePointerClick, Sparkles } from "lucide-react";

import { AdminShell } from "@/components/marketplace/AdminShell";
import { BrandImageStudio } from "@/components/marketplace/admin/BrandImageStudio";
import { useAiLibrary } from "@/lib/mkt-ai-studio";
import { MediaSlotCard } from "@/components/marketplace/admin/MediaSlotCard";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { groupSlotsBySection, useMediaSlots, useRefreshMediaSlots } from "@/lib/mkt-media-slots";
import { requestLiveEdit } from "@/lib/mkt-live-edit";

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
  const library = useAiLibrary(true);

  const groups = groupSlotsBySection(slots.data ?? []);

  return (
    <AdminShell
      title="إدارة المظهر والوسائط"
      actions={
        <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="gap-[var(--sp-2)]"
          onClick={() => {
            /* الوضع يُفتح على الموقع الفعلي، والقاعدة تعيد التحقق من صفة المدير. */
            requestLiveEdit(true);
            window.location.assign("/");
          }}
        >
          <MousePointerClick className="size-4" aria-hidden />
          وضع التحرير
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-[var(--sp-2)]">
          <Link to="/admin/designs">
            <Sparkles className="size-4" aria-hidden />
            بانِ العروض والترويج
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-[var(--sp-2)]">
          <Link to="/admin/pricing">
            <CircleDollarSign className="size-4" aria-hidden />
            الأسعار والقيم
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-[var(--sp-2)]">
          <Link to="/admin/appearance/variants">
            <LayoutTemplate className="size-4" aria-hidden />
            تصاميم الصفحات
          </Link>
        </Button>
        </div>
      }
    >
      <p className="mb-4 rounded-[var(--r-card)] border border-primary/25 bg-primary/8 p-3 text-desc text-foreground">
        كل صورة في الواجهة العامة مرتبطة بفتحة هنا. الرفع يضغط الصورة تلقائيًا (أطول ضلع ١٦٠٠ بكسل ·
        صيغة WebP · حتى ٣٠٠ كيلوبايت)، والفتحة الفارغة تعرض صورة احتياطية مفتوحة الترخيص. الفيديو
        حاليًا برابط خارجي فقط.
      </p>

      <details className="mb-4 rounded-[var(--r-card)] border border-border bg-card p-3">
        <summary className="flex cursor-pointer items-center gap-[var(--sp-2)] text-section font-extrabold text-foreground">
          <Sparkles className="size-4 text-primary" aria-hidden />
          مكتبة تصاميمي — توليد بالذكاء الاصطناعي
        </summary>
        <p className="mt-1 mb-3 text-desc text-muted-foreground">
          التوليد لمدير المنصة فقط، بسقف شهري بالدولار يوقف الخدمة آليًا، وكل صورة تُختَم باسم كَحيل
          قبل الحفظ. لتوليد صورة لفتحة معيّنة استخدم زر «ولّد بالذكاء الاصطناعي» داخل بطاقتها.
        </p>
        <BrandImageStudio onChanged={refresh} />

        {(library.data ?? []).length > 0 ? (
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {(library.data ?? []).map((item) => (
              <li key={item.path} className="overflow-hidden rounded-xl border border-border">
                <img
                  src={item.url}
                  alt="صورة في مكتبة كَحيل المولّدة"
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
              </li>
            ))}
          </ul>
        ) : null}
      </details>

      <div className="mb-6">
        <MascotPresenceCard />
      </div>


      {slots.isPending ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-28 w-full rounded-[var(--r-card)]" />
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

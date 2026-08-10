/**
 * عالم القسم على `/c/{slug}` — قالب واحد يخدم كل قسم رئيسي بلا كود جديد.
 *
 * الحارس: `beforeLoad` يُنفَّذ على الخادم فيعيد تحويلًا 301 حقيقيًا للأقسام
 * المدموجة أو المخفَّضة قبل إرسال أي HTML، ومصدره جدول
 * `mkt_category_redirects`. «كَحيل عقار» يبقى بعالمه المخصص على `/aqar`.
 */
import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { CategoryWorldPage } from "@/components/marketplace/world/CategoryWorldPage";
import { CategoryWorldShell } from "@/components/marketplace/world/CategoryWorldShell";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { categoryName, useCategoryTree } from "@/lib/mkt-category-tree";
import { getCategoryRedirect } from "@/lib/mkt-category-redirects.functions";
import { canonicalLinks, canonicalMeta } from "@/lib/share-links";

/** الأقسام التي لها عالم مخصص مكتوب — لا يخدمها القالب. */
const CUSTOM_WORLDS: Record<string, string> = { "real-estate": "/aqar" };

export const Route = createFileRoute("/c/$slug")({
  ssr: "data-only",
  beforeLoad: async ({ params }) => {
    const custom = CUSTOM_WORLDS[params.slug];
    if (custom) throw redirect({ href: custom, statusCode: 301 });

    const { toPath } = await getCategoryRedirect({ data: { fromPath: `/c/${params.slug}` } });
    if (toPath) throw redirect({ href: toPath, statusCode: 301 });
  },
  head: ({ params }) => {
    const title = `عالم ${params.slug} — كَحيل`;
    const description =
      "عالم القسم في كَحيل: الأقسام الفرعية، الإعلانات المميزة، وأحدث ما نُشر داخل القسم.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "index, follow" },
        ...canonicalMeta(`/c/${params.slug}`),
      ],
      links: canonicalLinks(`/c/${params.slug}`),
    };
  },
  component: CategoryWorldRoute,
});

function CategoryWorldRoute() {
  const { slug } = Route.useParams();
  const { locale } = useI18n();
  const tree = useCategoryTree();
  const world = (tree.data ?? []).find((row) => row.slug === slug && row.is_primary) ?? null;

  if (tree.isLoading) {
    return (
      <CategoryWorldShell slug={slug} title="…">
        <div className="mx-auto w-full max-w-5xl space-y-3 p-4">
          <Skeleton className="h-40 rounded-[var(--r-card)]" />
          <Skeleton className="h-28 rounded-[var(--r-card)]" />
        </div>
      </CategoryWorldShell>
    );
  }

  if (!world) {
    return (
      <CategoryWorldShell slug={slug} title="القسم غير موجود">
        <div className="py-20 text-center">
          <p className="text-body font-bold text-foreground">لا يوجد عالم بهذا المسار.</p>
          <Link to="/" className="mt-4 inline-block text-sm font-medium text-primary">
            العودة إلى السوق
          </Link>
        </div>
      </CategoryWorldShell>
    );
  }

  return (
    <CategoryWorldShell
      slug={slug}
      title={categoryName(world, locale)}
      subtitle={world.tagline_ar ?? undefined}
    >
      <CategoryWorldPage world={world} tree={tree.data ?? []} />
    </CategoryWorldShell>
  );
}

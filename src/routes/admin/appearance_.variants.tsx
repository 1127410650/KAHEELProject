/**
 * /admin/appearance/variants — تبديل تصميم كل صفحة رئيسية بضغطة.
 *
 * التصاميم مسجّلة في `mkt_page_variants`، والتفعيل عبر
 * `mkt_admin_activate_page_variant` (SECURITY DEFINER يفحص مدير المنصة).
 * إضافة تصميم لاحقًا = مكوّن جديد + سجل في الجدول، بلا لمس ما سبق.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Images } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/marketplace/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  activatePageVariant,
  useRefreshPageVariants,
  usePageVariants,
  type PageVariant,
} from "@/lib/mkt-page-variants";

const PAGE_LABELS: Record<string, { title: string; href: string }> = {
  home: { title: "الصفحة الرئيسية", href: "/" },
  aqar: { title: "رئيسية كَحيل عقار", href: "/aqar" },
};

export const Route = createFileRoute("/admin/appearance_/variants")({
  head: () => ({
    meta: [
      { title: "تصاميم الصفحات — كَحيل" },
      { name: "description", content: "لكل صفحة عدة تصاميم؛ التبديل يسري فورًا على كل الزوار." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "تصاميم الصفحات — كَحيل" },
      { property: "og:description", content: "تعدد التصاميم لكل صفحة مع شرح ما يميّز كل تصميم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VariantsPage,
});

function VariantsPage() {
  const variants = usePageVariants();
  const refresh = useRefreshPageVariants();
  const [busy, setBusy] = useState<string | null>(null);

  const pages = [...new Set((variants.data ?? []).map((item) => item.page))];

  const activate = async (variant: PageVariant) => {
    setBusy(variant.variant_key);
    try {
      await activatePageVariant(variant.page, variant.variant_key);
      refresh();
      toast.success(`فُعّل «${variant.name_ar}» — يسري على كل الزوار الآن.`);
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      toast.error(raw.includes("NOT_ADMIN") ? "التبديل لمدير المنصة فقط." : `تعذّر التفعيل (${raw})`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminShell
      title="تصاميم الصفحات"
      actions={
        <Button asChild size="sm" variant="outline" className="gap-[var(--sp-2)]">
          <Link to="/admin/appearance">
            <Images className="size-4" aria-hidden />
            إدارة الوسائط
          </Link>
        </Button>
      }
    >
      <p className="mb-4 rounded-[var(--r-card)] border border-primary/25 bg-primary/8 p-3 text-desc text-foreground">
        لكل صفحة تصميم نشط واحد. التبديل يظهر لكل الزوار فورًا ولا يكسر أي رابط، والمحتوى نفسه لا
        يتغيّر — يتغيّر ترتيبه وحجم بطاقاته فقط.
      </p>

      {variants.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-[var(--r-card)]" />
          <Skeleton className="h-24 w-full rounded-[var(--r-card)]" />
        </div>
      ) : variants.isError ? (
        <p className="text-body text-destructive">تعذّر تحميل التصاميم — حدّث الصفحة.</p>
      ) : (
        <div className="space-y-6">
          {pages.map((page) => {
            const meta = PAGE_LABELS[page] ?? { title: page, href: "/" };
            const rows = (variants.data ?? []).filter((item) => item.page === page);
            return (
              <section key={page} aria-labelledby={`page-${page}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 id={`page-${page}`} className="text-section font-extrabold text-foreground">
                    {meta.title}
                  </h2>
                  <a
                    href={meta.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-desc font-bold text-primary underline"
                  >
                    معاينة الصفحة
                  </a>
                </div>

                <ul className="grid gap-3 lg:grid-cols-2">
                  {rows.map((variant) => (
                    <li
                      key={variant.variant_key}
                      className={`rounded-[var(--r-card)] border p-3 ${
                        variant.is_active ? "border-primary bg-primary/8" : "border-border bg-card"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <strong className="text-body font-extrabold text-foreground">
                          {variant.name_ar}
                        </strong>
                        {variant.is_active ? (
                          <Badge className="gap-1">
                            <Check className="size-3.5" aria-hidden />
                            نشط
                          </Badge>
                        ) : (
                          <Badge variant="outline">متاح</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-desc text-muted-foreground">{variant.description_ar}</p>
                      <div className="mt-3">
                        <Button
                          type="button"
                          size="sm"
                          disabled={variant.is_active || busy !== null}
                          onClick={() => void activate(variant)}
                        >
                          {busy === variant.variant_key
                            ? "جارٍ التفعيل…"
                            : variant.is_active
                              ? "مفعّل حاليًا"
                              : "تفعيل هذا التصميم"}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}

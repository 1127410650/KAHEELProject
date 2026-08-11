/**
 * استوديو المحتوى — قائمة الصفحات (/admin/content)
 *
 * نمو للمؤلّف القائم لا بديل عنه: نفس `BLOCK_LIBRARY` ونفس عارض `PageBlocks`،
 * لكن مع نموذج صفحات ونسخ ونشر ورجوع. المسودة لا تظهر لزائر عادي أبدًا.
 */
import { useState } from "react";

import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Globe, Plus } from "lucide-react";
import { toast } from "sonner";

import { AdminCard, AdminEmptyState, AdminPageHead } from "@/components/admin/AdminPage";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { useCmsErrorText, useCmsMutations, useCmsPages, type CmsPage } from "@/lib/mkt-cms";

export const Route = createFileRoute("/admin/content/")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "استوديو المحتوى — كَحيل" },
      {
        name: "description",
        content: "صفحات المنصة ونسخها ودورة المسودة والمعاينة والنشر والرجوع من مكان واحد.",
      },
      { property: "og:title", content: "استوديو المحتوى — كَحيل" },
      { property: "og:description", content: "إدارة صفحات المنصة ونسخها ونشرها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminContentIndex,
});

const STATUS_TEXT: Record<string, string> = {
  draft: "مسودة",
  published: "منشورة",
  archived: "مؤرشفة",
};

function PageRow({ page }: { page: CmsPage }) {
  return (
    <li className="rounded-[var(--r-card)] border border-border bg-card p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <span className="block truncate text-body font-bold text-foreground">{page.title_ar}</span>
          <span className="block truncate text-nav text-muted-foreground" dir="ltr">
            {page.route_path}
          </span>
          <span className="mt-1 inline-flex items-center gap-2 text-nav text-muted-foreground">
            {STATUS_TEXT[page.status] ?? page.status} • {formatDateTime(page.updated_at)}
          </span>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/content/pages/$id" params={{ id: page.id }}>
            تحرير
          </Link>
        </Button>
      </div>
    </li>
  );
}

function AdminContentIndex() {
  const pages = useCmsPages();
  const { createPage } = useCmsMutations();
  const errorText = useCmsErrorText();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");

  const submit = () => {
    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");
    if (!title.trim() || !cleanSlug) {
      toast.error("العنوان والمسار مطلوبان");
      return;
    }
    createPage.mutate(
      { slug: cleanSlug, route_path: `/${cleanSlug}`, title_ar: title.trim() },
      {
        onSuccess: () => {
          toast.success("أُنشئت الصفحة كمسودة — غير ظاهرة للعامة");
          setOpen(false);
          setTitle("");
          setSlug("");
        },
        onError: (error) => toast.error(errorText(error)),
      },
    );
  };

  return (
    <AdminShell title="استوديو المحتوى">
      <AdminPageHead
        title="صفحات المنصة"
        description="كل صفحة قائمة كتل من نفس مكتبة المكوّنات — مسودة، معاينة، نشر، ورجوع بنسخة كاملة."
        actions={
          <Button onClick={() => setOpen((v) => !v)} style={{ minHeight: 44 }}>
            <Plus aria-hidden className="size-4" />
            صفحة جديدة
          </Button>
        }
      />

      {open && (
        <AdminCard title="صفحة جديدة" className="mb-[var(--sp-4)]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-desc">العنوان</Label>
              <Input
                value={title}
                maxLength={120}
                onChange={(event) => setTitle(event.target.value.replace(/[<>]/g, ""))}
                style={{ minHeight: 44 }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-desc">المسار</Label>
              <Input
                dir="ltr"
                value={slug}
                placeholder="about-us"
                onChange={(event) => setSlug(event.target.value)}
                style={{ minHeight: 44 }}
              />
            </div>
          </div>
          <Button
            className="mt-3"
            disabled={createPage.isPending}
            onClick={submit}
            style={{ minHeight: 44 }}
          >
            إنشاء كمسودة
          </Button>
        </AdminCard>
      )}

      <AdminCard title="الصفحات" description="المسودات لا تُقرأ للعامة إطلاقًا.">
        {pages.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (pages.data ?? []).length === 0 ? (
          <AdminEmptyState
            icon={FileText}
            title="لا صفحات بعد"
            hint="أنشئ صفحة مسودة ثم ابنِ كتلها من نفس مكتبة المكوّنات."
          />
        ) : (
          <ul className="space-y-2">
            {(pages.data ?? []).map((page) => (
              <PageRow key={page.id} page={page} />
            ))}
          </ul>
        )}
      </AdminCard>

      <p className="mt-[var(--sp-4)] flex items-center gap-2 text-nav text-muted-foreground">
        <Globe aria-hidden className="size-4" />
        الرئيسية الحالية تبقى هي المنشورة حتى يعتمد المالك نسخة من الاستوديو بنفسه.
      </p>
    </AdminShell>
  );
}

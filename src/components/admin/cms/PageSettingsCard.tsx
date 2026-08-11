/**
 * إعدادات الصفحة داخل محرّر الاستوديو: حقول SEO بالعربية والإنجليزية،
 * صورة المشاركة، تغيير المسار عبر `changeRoutePath` (فحص تعارض + سجل تحويل)،
 * وإجراءات الأرشفة وإلغاء النشر.
 *
 * لا يبني نظام إعدادات ثانيًا: كل الكتابة تمر بدوال `mkt-cms`.
 */
import { useEffect, useState } from "react";

import { Archive, ArchiveRestore, EyeOff, Link2, Save } from "lucide-react";
import { toast } from "sonner";

import { AdminCard } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CmsPage, CmsPageSettings, useCmsMutations } from "@/lib/mkt-cms";

interface Props {
  page: CmsPage;
  mutations: ReturnType<typeof useCmsMutations>;
  errorText: (error: unknown) => string;
  disabled?: boolean;
  onChanged: () => void;
}

export function PageSettingsCard({ page, mutations, errorText, disabled, onChanged }: Props) {
  const [form, setForm] = useState<CmsPageSettings>({
    title_ar: page.title_ar,
    title_en: page.title_en,
    description_ar: page.description_ar,
    description_en: page.description_en,
    og_image_path: page.og_image_path,
    robots: page.robots,
  });
  const [path, setPath] = useState(page.route_path);

  useEffect(() => {
    setForm({
      title_ar: page.title_ar,
      title_en: page.title_en,
      description_ar: page.description_ar,
      description_en: page.description_en,
      og_image_path: page.og_image_path,
      robots: page.robots,
    });
    setPath(page.route_path);
  }, [page]);

  const set = <K extends keyof CmsPageSettings>(key: K, value: CmsPageSettings[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const archived = page.status === "archived";

  return (
    <AdminCard title="إعدادات الصفحة" description="بيانات الوصف والفهرسة والمسار.">
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="cms-title-ar">العنوان (عربي)</Label>
          <Input
            id="cms-title-ar"
            value={form.title_ar}
            disabled={disabled}
            onChange={(e) => set("title_ar", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cms-title-en">العنوان (إنجليزي)</Label>
          <Input
            id="cms-title-en"
            dir="ltr"
            value={form.title_en ?? ""}
            disabled={disabled}
            onChange={(e) => set("title_en", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cms-desc-ar">الوصف (عربي)</Label>
          <Textarea
            id="cms-desc-ar"
            rows={2}
            value={form.description_ar ?? ""}
            disabled={disabled}
            onChange={(e) => set("description_ar", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cms-desc-en">الوصف (إنجليزي)</Label>
          <Textarea
            id="cms-desc-en"
            dir="ltr"
            rows={2}
            value={form.description_en ?? ""}
            disabled={disabled}
            onChange={(e) => set("description_en", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cms-og">صورة المشاركة (مسار داخلي أو رابط https)</Label>
          <Input
            id="cms-og"
            dir="ltr"
            placeholder="/media/og/page.webp"
            value={form.og_image_path ?? ""}
            disabled={disabled}
            onChange={(e) => set("og_image_path", e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={form.robots === "noindex" ? "default" : "outline"}
            disabled={disabled}
            style={{ minHeight: 44 }}
            onClick={() => set("robots", form.robots === "noindex" ? "index" : "noindex")}
          >
            <EyeOff aria-hidden className="size-4" />
            {form.robots === "noindex" ? "غير مفهرسة" : "مفهرسة"}
          </Button>
          <Button
            size="sm"
            disabled={disabled || mutations.saveSettings.isPending}
            style={{ minHeight: 44 }}
            onClick={() =>
              mutations.saveSettings.mutate(form, {
                onSuccess: () => {
                  toast.success("حُفظت الإعدادات");
                  onChanged();
                },
                onError: (error) => toast.error(errorText(error)),
              })
            }
          >
            <Save aria-hidden className="size-4" />
            حفظ الإعدادات
          </Button>
        </div>

        <div className="space-y-1 border-t border-border pt-3">
          <Label htmlFor="cms-path">مسار الصفحة</Label>
          <Input
            id="cms-path"
            dir="ltr"
            value={path}
            disabled={disabled}
            onChange={(e) => setPath(e.target.value)}
          />
          <p className="text-nav text-muted-foreground">
            تغيير المسار يُسجّل تحويلًا من المسار القديم ويُرفض عند التعارض.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || path === page.route_path || mutations.changePath.isPending}
            style={{ minHeight: 44 }}
            onClick={() =>
              mutations.changePath.mutate(
                { page, nextPath: path },
                {
                  onSuccess: () => {
                    toast.success("تغيّر المسار وسُجّل التحويل");
                    onChanged();
                  },
                  onError: (error) => toast.error(errorText(error)),
                },
              )
            }
          >
            <Link2 aria-hidden className="size-4" />
            تغيير المسار
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {page.status === "published" && (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || mutations.unpublish.isPending}
              style={{ minHeight: 44 }}
              onClick={() =>
                mutations.unpublish.mutate(undefined, {
                  onSuccess: () => {
                    toast.success("أُلغي النشر — التاريخ والنسخ كما هي");
                    onChanged();
                  },
                  onError: (error) => toast.error(errorText(error)),
                })
              }
            >
              <EyeOff aria-hidden className="size-4" />
              إلغاء النشر
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || mutations.setArchived.isPending}
            style={{ minHeight: 44 }}
            onClick={() =>
              mutations.setArchived.mutate(!archived, {
                onSuccess: () => {
                  toast.success(archived ? "أُعيدت من الأرشيف" : "أُرشفت الصفحة");
                  onChanged();
                },
                onError: (error) => toast.error(errorText(error)),
              })
            }
          >
            {archived ? (
              <ArchiveRestore aria-hidden className="size-4" />
            ) : (
              <Archive aria-hidden className="size-4" />
            )}
            {archived ? "إرجاع من الأرشيف" : "أرشفة"}
          </Button>
        </div>
      </div>
    </AdminCard>
  );
}

/**
 * إدارة «ستوريات كَحيل» من لوحة مدير النظام.
 *
 * الكتابة كلها تحت RLS لا يجتازها إلا مدير المنصة، فإخفاء الواجهة ليس ضابطًا
 * بحد ذاته. الصورة اختيارية وسقفها 150KB يُتحقّق منه قبل أن تلمس التخزين،
 * والخلفية المتدرجة وحدها ستوري صالحة بلا أي بايت صورة.
 */
import { useState } from "react";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Mascot, type MascotName, type MascotPose } from "@/components/marketplace/campaign/Mascot";
import { useI18n } from "@/i18n";
import { formatNumber } from "@/lib/format";
import {
  STORY_GRADIENTS,
  STORY_GRADIENT_CSS,
  STORY_IMAGE_ACCEPT,
  STORY_IMAGE_LIMIT,
  uploadStoryImage,
  useAdminStories,
  useDeleteStory,
  useSaveStory,
  type StoryGradient,
  type StoryStatus,
} from "@/lib/mkt-stories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const STATUSES: StoryStatus[] = ["draft", "active", "paused", "ended"];
const POSES: { value: MascotPose; mascot: MascotName; label: [string, string] }[] = [
  { value: "welcome", mascot: "kaheel", label: ["كَحيل يرحّب", "Kaheel welcoming"] },
  { value: "present", mascot: "kaheel", label: ["كَحيل يقدّم العرض", "Kaheel presenting"] },
  { value: "thanks", mascot: "kaheel", label: ["كَحيل يشكر", "Kaheel thanking"] },
  { value: "wave", mascot: "kaheelan", label: ["كَحيلان يلوّح", "Kaheelan waving"] },
  { value: "mustache", mascot: "kaheelan", label: ["كَحيلان يفتل شواربه", "Kaheelan twirling"] },
  { value: "tray", mascot: "kaheelan", label: ["كَحيلان بالصينية", "Kaheelan with a tray"] },
  { value: "idle", mascot: "kaheelan", label: ["كَحيلان واقف", "Kaheelan idle"] },
];

export function StoriesManager() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const stories = useAdminStories(true);
  const save = useSaveStory();
  const remove = useDeleteStory();

  const [slug, setSlug] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [bodyAr, setBodyAr] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [ctaAr, setCtaAr] = useState("اذهب للعرض");
  const [ctaEn, setCtaEn] = useState("Go to the offer");
  const [clickUrl, setClickUrl] = useState("/search");
  const [gradient, setGradient] = useState<StoryGradient>("violet");
  const [poseIndex, setPoseIndex] = useState(0);
  const [priority, setPriority] = useState("50");
  const [endsAt, setEndsAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const pose = POSES[poseIndex]!;

  const create = async () => {
    if (!slug.trim() || !titleAr.trim()) {
      toast.error(ar ? "المعرّف والعنوان العربي مطلوبان" : "Slug and Arabic title are required");
      return;
    }
    setBusy(true);
    try {
      let image: { path: string; width: number; height: number } | null = null;
      if (file) image = await uploadStoryImage(file);
      await save.mutateAsync({
        values: {
          slug: slug.trim(),
          title_ar: titleAr.trim(),
          title_en: titleEn.trim() || titleAr.trim(),
          body_ar: bodyAr.trim(),
          body_en: bodyEn.trim() || bodyAr.trim(),
          cta_ar: ctaAr.trim(),
          cta_en: ctaEn.trim() || ctaAr.trim(),
          click_url: clickUrl.trim() || "/search",
          gradient,
          mascot: pose.mascot,
          mascot_pose: pose.value,
          priority: Number(priority) || 0,
          status: "active",
          ...(image
            ? { image_path: image.path, image_width: image.width, image_height: image.height }
            : {}),
          ...(endsAt ? { ends_at: new Date(endsAt).toISOString() } : {}),
        },
      });
      setSlug("");
      setTitleAr("");
      setTitleEn("");
      setBodyAr("");
      setBodyEn("");
      setFile(null);
      toast.success(ar ? "أُنشئت الستوري" : "Story created");
    } catch (error: unknown) {
      const code = error instanceof Error ? error.message : "ERROR";
      toast.error(
        code === "STORY_IMAGE_TOO_LARGE"
          ? ar
            ? "الصورة أكبر من 150KB"
            : "Image exceeds 150KB"
          : code,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4" aria-labelledby="admin-stories-title">
      <h2 id="admin-stories-title" className="flex items-center gap-2 text-lg font-black">
        <Sparkles className="size-5" aria-hidden />
        {ar ? "ستوريات كَحيل" : "Kaheel stories"}
      </h2>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
          <div className="space-y-[var(--sp-2)]">
            <Label htmlFor="story-slug">{ar ? "المعرّف" : "Slug"}</Label>
            <Input id="story-slug" value={slug} onChange={(event) => setSlug(event.target.value)} />
          </div>
          <div className="space-y-[var(--sp-2)]">
            <Label htmlFor="story-url">{ar ? "الرابط" : "Link"}</Label>
            <Input
              id="story-url"
              value={clickUrl}
              onChange={(event) => setClickUrl(event.target.value)}
            />
          </div>
          <div className="space-y-[var(--sp-2)]">
            <Label htmlFor="story-title-ar">{ar ? "العنوان (عربي)" : "Title (Arabic)"}</Label>
            <Input
              id="story-title-ar"
              value={titleAr}
              onChange={(event) => setTitleAr(event.target.value)}
            />
          </div>
          <div className="space-y-[var(--sp-2)]">
            <Label htmlFor="story-title-en">{ar ? "العنوان (إنجليزي)" : "Title (English)"}</Label>
            <Input
              id="story-title-en"
              value={titleEn}
              onChange={(event) => setTitleEn(event.target.value)}
            />
          </div>
          <div className="space-y-[var(--sp-2)]">
            <Label htmlFor="story-body-ar">{ar ? "النص (عربي)" : "Body (Arabic)"}</Label>
            <Input
              id="story-body-ar"
              value={bodyAr}
              onChange={(event) => setBodyAr(event.target.value)}
            />
          </div>
          <div className="space-y-[var(--sp-2)]">
            <Label htmlFor="story-body-en">{ar ? "النص (إنجليزي)" : "Body (English)"}</Label>
            <Input
              id="story-body-en"
              value={bodyEn}
              onChange={(event) => setBodyEn(event.target.value)}
            />
          </div>
          <div className="space-y-[var(--sp-2)]">
            <Label htmlFor="story-cta-ar">{ar ? "زر الإجراء (عربي)" : "CTA (Arabic)"}</Label>
            <Input
              id="story-cta-ar"
              value={ctaAr}
              onChange={(event) => setCtaAr(event.target.value)}
            />
          </div>
          <div className="space-y-[var(--sp-2)]">
            <Label htmlFor="story-cta-en">{ar ? "زر الإجراء (إنجليزي)" : "CTA (English)"}</Label>
            <Input
              id="story-cta-en"
              value={ctaEn}
              onChange={(event) => setCtaEn(event.target.value)}
            />
          </div>
          <div className="space-y-[var(--sp-2)]">
            <Label htmlFor="story-priority">{ar ? "الترتيب" : "Priority"}</Label>
            <Input
              id="story-priority"
              inputMode="numeric"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            />
          </div>
          <div className="space-y-[var(--sp-2)]">
            <Label htmlFor="story-ends">{ar ? "ينتهي في" : "Ends at"}</Label>
            <Input
              id="story-ends"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </div>

          <div className="space-y-[var(--sp-2)]">
            <Label>{ar ? "الخلفية" : "Background"}</Label>
            <div className="flex flex-wrap gap-2">
              {STORY_GRADIENTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={value}
                  aria-pressed={gradient === value}
                  onClick={() => setGradient(value)}
                  className={`size-9 rounded-full ring-offset-2 ${gradient === value ? "ring-2 ring-primary" : ""}`}
                  style={{ background: STORY_GRADIENT_CSS[value] }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-[var(--sp-2)]">
            <Label>{ar ? "الشخصية والوضعية" : "Character and pose"}</Label>
            <div className="flex flex-wrap gap-2">
              {POSES.map((item, index) => (
                <Button
                  key={item.value + item.mascot}
                  type="button"
                  size="sm"
                  variant={poseIndex === index ? "default" : "outline"}
                  onClick={() => setPoseIndex(index)}
                >
                  {ar ? item.label[0] : item.label[1]}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-[var(--sp-2)]">
            <Label htmlFor="story-image">
              {ar
                ? `صورة اختيارية (حد ${formatNumber(STORY_IMAGE_LIMIT / 1024)}KB)`
                : `Optional image (max ${formatNumber(STORY_IMAGE_LIMIT / 1024)}KB)`}
            </Label>
            <Input
              id="story-image"
              type="file"
              accept={STORY_IMAGE_ACCEPT}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>

          <div className="space-y-[var(--sp-2)]">
            <Label>{ar ? "معاينة" : "Preview"}</Label>
            <div
              className="grid h-[120px] place-items-center overflow-hidden rounded-[var(--r-card)]"
              style={{ background: STORY_GRADIENT_CSS[gradient] }}
            >
              <Mascot
                name={pose.mascot}
                pose={pose.value}
                lang={ar ? "ar" : "en"}
                className="h-[104px] w-auto"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <Button type="button" disabled={busy} onClick={() => void create()}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {ar ? "إنشاء ستوري" : "Create story"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {stories.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          (stories.data ?? []).map((row) => (
            <Card key={row.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <span
                  className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full"
                  style={{ background: STORY_GRADIENT_CSS[row.gradient] }}
                >
                  <Mascot
                    name={row.mascot}
                    pose={row.mascot_pose as MascotPose}
                    lang={ar ? "ar" : "en"}
                    animated={false}
                    className="h-12 w-auto"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{ar ? row.title_ar : row.title_en}</p>
                  <p className="truncate text-desc text-muted-foreground">
                    {row.slug} · {row.click_url}
                  </p>
                </div>
                <Badge variant="outline">{row.status}</Badge>
                <span className="text-desc text-muted-foreground">
                  {ar ? "مشاهدات" : "Views"} {formatNumber(row.views)} ·{" "}
                  {ar ? "نقرات" : "Clicks"} {formatNumber(row.clicks)}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {STATUSES.filter((status) => status !== row.status).map((status) => (
                    <Button
                      key={status}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void save
                          .mutateAsync({ id: row.id, values: { status } })
                          .then(() => toast.success(ar ? "تم التحديث" : "Updated"))
                          .catch((error: unknown) =>
                            toast.error(error instanceof Error ? error.message : "ERROR"),
                          )
                      }
                    >
                      {status}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={ar ? "حذف" : "Delete"}
                    onClick={() =>
                      void remove
                        .mutateAsync(row.id)
                        .then(() => toast.success(ar ? "حُذفت الستوري" : "Story deleted"))
                        .catch((error: unknown) =>
                          toast.error(error instanceof Error ? error.message : "ERROR"),
                        )
                    }
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}

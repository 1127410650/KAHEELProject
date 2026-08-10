/**
 * «الخلفيات الموسمية» في لوحة مدير النظام.
 *
 * كل شيء من هنا بلا كود: رفع صورة الموسم وطبقة العناصر، تحديد أين تظهر، مدة
 * السريان، الأولوية والحالة، والشخصية البارزة. الصفوف المسودة/الموقوفة لا يراها
 * الزائر إطلاقًا (سياسة القراءة العامة في قاعدة البيانات)، وإخفاء هذه البطاقة
 * ليس ضابطًا بحد ذاته: الكتابة لا تمرّ إلا لمدير منصة.
 *
 * الصور: WebP/JPEG/PNG ≤ ١ ميغابايت يُتحقّق من نوعها من البايتات الأولى لا من
 * الامتداد، وتُحفظ في مجلد الحملات العام، وتُخزَّن أبعادها مع الصف لضمان صفر
 * هزّة تخطيط عند العرض.
 */
import { useMemo, useState } from "react";
import { CalendarClock, Images, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import {
  campaignAssetPath,
  prepareCampaignAsset,
  uploadCampaignAsset,
} from "@/lib/mkt-campaigns";
import {
  MOTIF_LABEL,
  OVERLAY_LABEL,
  PLACEMENT_LABEL,
  SEASON_PLACEMENTS,
  SEASON_STATUS_LABEL,
  seasonLabel,
  useAdminSeasons,
  type SeasonalBackdrop,
  type SeasonMascot,
  type SeasonMotif,
  type SeasonOverlay,
  type SeasonPlacement,
  type SeasonStatus,
} from "@/lib/mkt-seasons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MOTIFS: SeasonMotif[] = [
  "none",
  "stars",
  "school",
  "lanterns",
  "sparks",
  "confetti",
  "flag",
];
const OVERLAYS: SeasonOverlay[] = ["soft", "medium", "strong"];
const MASCOTS: SeasonMascot[] = ["none", "kaheel", "kaheelan", "custom"];
const STATUSES: SeasonStatus[] = ["draft", "active", "paused", "ended"];

const MASCOT_LABEL: Record<SeasonMascot, [string, string]> = {
  none: ["بلا شخصية", "No character"],
  kaheel: ["كَحيل", "Kaheel"],
  kaheelan: ["الزعيم كَحيلان", "Boss Kaheelan"],
  custom: ["صورة مرفوعة", "Uploaded image"],
};

interface Upload {
  path: string;
  url: string;
  width: number;
  height: number;
}

export function SeasonalBackdropsCard() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { data, isLoading, save, remove } = useAdminSeasons();
  const rows = useMemo(() => data ?? [], [data]);

  const [slug, setSlug] = useState("");
  const [labelAr, setLabelAr] = useState("");
  const [labelEn, setLabelEn] = useState("");
  const [placement, setPlacement] = useState<SeasonPlacement>("header");
  const [sectionKey, setSectionKey] = useState("");
  const [motif, setMotif] = useState<SeasonMotif>("stars");
  const [overlay, setOverlay] = useState<SeasonOverlay>("strong");
  const [accent, setAccent] = useState("#f59e0b");
  const [mascot, setMascot] = useState<SeasonMascot>("none");
  const [priority, setPriority] = useState("0");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [headlineAr, setHeadlineAr] = useState("");
  const [headlineEn, setHeadlineEn] = useState("");
  const [subAr, setSubAr] = useState("");
  const [subEn, setSubEn] = useState("");

  const [image, setImage] = useState<Upload | null>(null);
  const [decor, setDecor] = useState<Upload | null>(null);
  const [mascotFile, setMascotFile] = useState<Upload | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | null, apply: (value: Upload | null) => void) {
    if (!file) return apply(null);
    setBusy(true);
    try {
      const prepared = await prepareCampaignAsset(file);
      if (prepared.error === "type" || prepared.kind === "lottie" || prepared.kind === "mp4") {
        toast.error(ar ? "الصور فقط: WebP أو JPEG أو PNG" : "Images only: WebP, JPEG or PNG");
        return;
      }
      if (prepared.error === "tooLarge") {
        toast.error(ar ? "الحجم أكبر من ١ ميغابايت" : "Larger than 1 MB");
        return;
      }
      if (prepared.error || !prepared.width || !prepared.height) {
        toast.error(ar ? "تعذّر قراءة الصورة" : "Could not read the image");
        return;
      }
      const path = campaignAssetPath(prepared.kind);
      await uploadCampaignAsset(path, prepared.blob);
      apply({
        path,
        url: URL.createObjectURL(prepared.blob),
        width: prepared.width,
        height: prepared.height,
      });
      toast.success(ar ? "تم الرفع" : "Uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ERROR");
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    const trimmed = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{3,40}$/.test(trimmed)) {
      toast.error(ar ? "المعرّف: حروف إنجليزية وأرقام وشرطة" : "Slug: latin letters, digits, dashes");
      return;
    }
    if (placement === "section" && !sectionKey.trim()) {
      toast.error(ar ? "اكتب مفتاح القسم" : "Enter the section key");
      return;
    }
    if (mascot === "custom" && !mascotFile) {
      toast.error(ar ? "ارفع صورة الشخصية" : "Upload the character image");
      return;
    }
    setBusy(true);
    try {
      await save.mutateAsync({
        values: {
          slug: trimmed,
          label_ar: labelAr.trim(),
          label_en: labelEn.trim(),
          placement,
          section_key: placement === "section" ? sectionKey.trim() : "",
          image_path: image?.path ?? null,
          image_width: image?.width ?? 1600,
          image_height: image?.height ?? 906,
          decor_path: decor?.path ?? null,
          motif,
          overlay,
          accent,
          mascot,
          mascot_path: mascot === "custom" ? mascotFile?.path ?? null : null,
          headline_ar: headlineAr.trim(),
          headline_en: headlineEn.trim(),
          subheadline_ar: subAr.trim(),
          subheadline_en: subEn.trim(),
          priority: Number(priority) || 0,

          status: "draft",
          ...(startsAt ? { starts_at: new Date(startsAt).toISOString() } : {}),
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        },
      });
      toast.success(ar ? "أُضيف الموسم كمسودة" : "Season added as a draft");
      setSlug("");
      setLabelAr("");
      setLabelEn("");
      setHeadlineAr("");
      setHeadlineEn("");
      setSubAr("");
      setSubEn("");

      setImage(null);
      setDecor(null);
      setMascotFile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ERROR");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-4">
        <header className="flex flex-wrap items-center gap-2">
          <span className="grid size-9 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Images className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-black">{ar ? "الخلفيات الموسمية" : "Seasonal backdrops"}</p>
            <p className="text-[11px] text-muted-foreground">
              {ar
                ? "طبقة مزخرفة خلف الهيدر وأقسام المتاجر، تبدأ وتنتهي بالتاريخ تلقائيًا"
                : "A decorative layer behind the header and store sections, starting and ending by date"}
            </p>
          </div>
        </header>

        {/* معاينة حية للموسم قيد الإنشاء */}
        <div className="relative h-28 overflow-hidden rounded-2xl bg-[linear-gradient(130deg,#240046,#5a189a)]">
          {image ? (
            <img
              src={image.url}
              alt=""
              width={image.width}
              height={image.height}
              className="absolute inset-0 size-full object-cover"
            />
          ) : null}
          {decor ? (
            <img
              src={decor.url}
              alt=""
              width={decor.width}
              height={decor.height}
              className="k-season-float absolute inset-0 size-full object-cover opacity-55 mix-blend-screen"
            />
          ) : null}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(36_0_70/0.62),rgb(36_0_70/0.8))]" />
          <p className="absolute inset-x-3 bottom-3 text-xs font-black text-white">
            {labelAr || labelEn || (ar ? "معاينة الموسم" : "Season preview")}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="season-slug">{ar ? "المعرّف" : "Slug"}</Label>
            <Input
              id="season-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="ramadan-2027"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="season-priority">{ar ? "الأولوية" : "Priority"}</Label>
            <Input
              id="season-priority"
              value={priority}
              inputMode="numeric"
              onChange={(event) => setPriority(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="season-label-ar">{ar ? "الاسم بالعربية" : "Arabic name"}</Label>
            <Input
              id="season-label-ar"
              value={labelAr}
              onChange={(event) => setLabelAr(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="season-label-en">{ar ? "الاسم بالإنجليزية" : "English name"}</Label>
            <Input
              id="season-label-en"
              value={labelEn}
              onChange={(event) => setLabelEn(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="season-start">{ar ? "بداية السريان" : "Starts at"}</Label>
            <Input
              id="season-start"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="season-end">{ar ? "نهاية السريان" : "Ends at"}</Label>
            <Input
              id="season-end"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="season-headline-ar">
              {ar ? "النص البارز (عربي)" : "Headline (Arabic)"}
            </Label>
            <Input
              id="season-headline-ar"
              value={headlineAr}
              onChange={(event) => setHeadlineAr(event.target.value)}
              placeholder="جيناكم سوريا"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="season-headline-en">
              {ar ? "النص البارز (إنجليزي)" : "Headline (English)"}
            </Label>
            <Input
              id="season-headline-en"
              value={headlineEn}
              onChange={(event) => setHeadlineEn(event.target.value)}
              placeholder="Hello Syria"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="season-sub-ar">{ar ? "السطر الفرعي (عربي)" : "Subtitle (Arabic)"}</Label>
            <Input
              id="season-sub-ar"
              value={subAr}
              onChange={(event) => setSubAr(event.target.value)}
              placeholder="سوقك الأول… من أرضك ولأهلك"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="season-sub-en">
              {ar ? "السطر الفرعي (إنجليزي)" : "Subtitle (English)"}
            </Label>
            <Input
              id="season-sub-en"
              value={subEn}
              onChange={(event) => setSubEn(event.target.value)}
            />
          </div>

        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold">{ar ? "أين تظهر" : "Where it shows"}</p>
          <div className="flex flex-wrap gap-2">
            {SEASON_PLACEMENTS.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={placement === value ? "default" : "outline"}
                onClick={() => setPlacement(value)}
              >
                {PLACEMENT_LABEL[value][ar ? 0 : 1]}
              </Button>
            ))}
          </div>
          {placement === "section" ? (
            <Input
              value={sectionKey}
              onChange={(event) => setSectionKey(event.target.value)}
              placeholder={ar ? "مفتاح القسم، مثال: restaurants" : "Section key, e.g. restaurants"}
            />
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <p className="text-xs font-bold">{ar ? "العناصر المتحركة" : "Animated elements"}</p>
            <div className="flex flex-wrap gap-1.5">
              {MOTIFS.map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={motif === value ? "default" : "outline"}
                  onClick={() => setMotif(value)}
                >
                  {MOTIF_LABEL[value][ar ? 0 : 1]}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold">{ar ? "حجاب القراءة" : "Readability scrim"}</p>
            <div className="flex flex-wrap gap-1.5">
              {OVERLAYS.map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={overlay === value ? "default" : "outline"}
                  onClick={() => setOverlay(value)}
                >
                  {OVERLAY_LABEL[value][ar ? 0 : 1]}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="season-accent" className="text-xs font-bold">
              {ar ? "لون البريق" : "Accent"}
            </Label>
            <Input
              id="season-accent"
              type="color"
              value={accent}
              onChange={(event) => setAccent(event.target.value)}
              className="h-10 w-20 p-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold">{ar ? "شخصية تطلّ من الأعلى" : "Character peeking on top"}</p>
          <div className="flex flex-wrap gap-1.5">
            {MASCOTS.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={mascot === value ? "default" : "outline"}
                onClick={() => setMascot(value)}
              >
                {MASCOT_LABEL[value][ar ? 0 : 1]}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <FilePick
            id="season-image"
            label={ar ? "صورة الخلفية" : "Backdrop image"}
            done={!!image}
            busy={busy}
            onPick={(file) => void pick(file, setImage)}
          />
          <FilePick
            id="season-decor"
            label={ar ? "طبقة العناصر (اختياري)" : "Elements layer (optional)"}
            done={!!decor}
            busy={busy}
            onPick={(file) => void pick(file, setDecor)}
          />
          {mascot === "custom" ? (
            <FilePick
              id="season-mascot"
              label={ar ? "صورة الشخصية" : "Character image"}
              done={!!mascotFile}
              busy={busy}
              onPick={(file) => void pick(file, setMascotFile)}
            />
          ) : null}
        </div>

        <Button type="button" onClick={() => void create()} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {ar ? "إضافة الموسم كمسودة" : "Add season as draft"}
        </Button>

        {/* القائمة */}
        <div className="space-y-2">
          <p className="text-xs font-bold">
            {ar ? "المواسم المعرّفة" : "Defined seasons"}
            {isLoading ? " …" : ` (${rows.length})`}
          </p>
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{seasonLabel(row, ar)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {PLACEMENT_LABEL[row.placement][ar ? 0 : 1]}
                  {row.section_key ? ` · ${row.section_key}` : ""} ·{" "}
                  {SEASON_STATUS_LABEL[row.status][ar ? 0 : 1]} · {formatDateTime(row.starts_at)}
                  {row.ends_at ? ` → ${formatDateTime(row.ends_at)}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {STATUSES.map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={row.status === value ? "default" : "outline"}
                    onClick={() =>
                      void save.mutateAsync({ id: row.id, values: { status: value } }).catch(() =>
                        toast.error(ar ? "تعذّر التحديث" : "Update failed"),
                      )
                    }
                  >
                    {SEASON_STATUS_LABEL[value][ar ? 0 : 1]}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={ar ? "حذف" : "Delete"}
                  onClick={() =>
                    void remove.mutateAsync(row.id).catch(() =>
                      toast.error(ar ? "تعذّر الحذف" : "Delete failed"),
                    )
                  }
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
              <SeasonTextEditor
                row={row}
                ar={ar}
                onSave={(values) =>
                  save.mutateAsync({ id: row.id, values }).then(
                    () => toast.success(ar ? "حُفظ النص" : "Text saved"),
                    () => toast.error(ar ? "تعذّر التحديث" : "Update failed"),
                  )
                }
              />
            </div>

          ))}
          {!isLoading && rows.length === 0 ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="size-4" aria-hidden />
              {ar ? "لا مواسم بعد" : "No seasons yet"}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function FilePick({
  id,
  label,
  done,
  busy,
  onPick,
}: {
  id: string;
  label: string;
  done: boolean;
  busy: boolean;
  onPick: (file: File | null) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="flex items-center gap-1 text-xs font-bold">
        <Upload className="size-3.5" aria-hidden />
        {label}
      </Label>
      <Input
        id={id}
        type="file"
        accept="image/webp,image/jpeg,image/png"
        disabled={busy}
        onChange={(event) => onPick(event.target.files?.[0] ?? null)}
      />
      {done ? <p className="text-[11px] text-success">✓</p> : null}
    </div>
  );
}

/** تحرير نصوص الموسم (النص البارز والسطر الفرعي) بعد إنشائه. */
function SeasonTextEditor({
  row,
  ar,
  onSave,
}: {
  row: SeasonalBackdrop;
  ar: boolean;
  onSave: (values: Partial<SeasonalBackdrop>) => Promise<unknown>;
}) {
  const [headlineAr, setHeadlineAr] = useState(row.headline_ar ?? "");
  const [headlineEn, setHeadlineEn] = useState(row.headline_en ?? "");
  const [subAr, setSubAr] = useState(row.subheadline_ar ?? "");
  const [subEn, setSubEn] = useState(row.subheadline_en ?? "");
  const [saving, setSaving] = useState(false);

  const dirty =
    headlineAr !== (row.headline_ar ?? "") ||
    headlineEn !== (row.headline_en ?? "") ||
    subAr !== (row.subheadline_ar ?? "") ||
    subEn !== (row.subheadline_en ?? "");

  return (
    <div className="w-full space-y-2 border-t border-border/60 pt-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={headlineAr}
          onChange={(event) => setHeadlineAr(event.target.value)}
          placeholder={ar ? "النص البارز (عربي)" : "Headline (Arabic)"}
          aria-label={ar ? "النص البارز (عربي)" : "Headline (Arabic)"}
        />
        <Input
          value={headlineEn}
          onChange={(event) => setHeadlineEn(event.target.value)}
          placeholder={ar ? "النص البارز (إنجليزي)" : "Headline (English)"}
          aria-label={ar ? "النص البارز (إنجليزي)" : "Headline (English)"}
        />
        <Input
          value={subAr}
          onChange={(event) => setSubAr(event.target.value)}
          placeholder={ar ? "السطر الفرعي (عربي)" : "Subtitle (Arabic)"}
          aria-label={ar ? "السطر الفرعي (عربي)" : "Subtitle (Arabic)"}
        />
        <Input
          value={subEn}
          onChange={(event) => setSubEn(event.target.value)}
          placeholder={ar ? "السطر الفرعي (إنجليزي)" : "Subtitle (English)"}
          aria-label={ar ? "السطر الفرعي (إنجليزي)" : "Subtitle (English)"}
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!dirty || saving}
        onClick={() => {
          setSaving(true);
          void onSave({
            headline_ar: headlineAr.trim(),
            headline_en: headlineEn.trim(),
            subheadline_ar: subAr.trim(),
            subheadline_en: subEn.trim(),
          }).finally(() => setSaving(false));
        }}
      >
        {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {ar ? "حفظ النص" : "Save text"}
      </Button>
    </div>
  );
}

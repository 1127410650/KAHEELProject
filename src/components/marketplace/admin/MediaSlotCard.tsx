/**
 * بطاقة فتحة بصرية واحدة في `/admin/appearance`.
 *
 * تعرض: المعاينة الحالية (أو «فارغة — يظهر الاحتياطي»)، زر رفع/استبدال بأيقونة
 * واضحة، إخفاء/إظهار، إفراغ، ونص بديل. الرفع يضغط الصورة في المتصفح قبل
 * إرسالها (١٦٠٠px · WebP · ≤٣٠٠KB)، والفيديو رابط خارجي فقط حاليًا.
 */
import { useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  ImagePlus,
  Link2,
  RefreshCw,
  Sparkles,
  Stamp,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";

import { toast } from "sonner";

import { BrandImageStudio } from "@/components/marketplace/admin/BrandImageStudio";
import { LocatePreviewButton } from "@/components/marketplace/admin/LocatePreviewButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { readableSize } from "@/lib/media-compress";

import {
  BRAND_STAMP_DEFAULTS,
  STAMP_COLORS,
  STAMP_POSITIONS,
  STAMP_SIZES,
  type BrandStampOptions,
} from "@/lib/kaheel-brand-stamp";

import {
  clearMediaSlot,
  saveMediaSlotMeta,
  setMediaSlotHidden,
  uploadMediaSlotImage,
  type MediaSlot,
} from "@/lib/mkt-media-slots";
import { enhanceImageLocally, withEnhanceAudit } from "@/lib/mkt-image-enhance";



const ERRORS: Record<string, string> = {
  COMPRESS_TOO_LARGE: "تعذّر ضغط الصورة تحت ٣٠٠ كيلوبايت — جرّب صورة أبسط.",
  WEBP_UNSUPPORTED: "المتصفح لا يدعم WebP — استخدم متصفحًا أحدث.",
  IMAGE_DECODE_FAILED: "الملف ليس صورة صالحة.",
  NOT_ADMIN: "هذه العملية لمدير المنصة فقط.",
};

function message(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return ERRORS[raw] ?? (raw.includes("NOT_ADMIN") ? ERRORS["NOT_ADMIN"]! : `تعذّر التنفيذ (${raw})`);
}

export function MediaSlotCard({ slot, onChanged }: { slot: MediaSlot; onChanged: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "upload" | "hide" | "clear" | "meta" | "enhance">(null);
  const [alt, setAlt] = useState(slot.alt_text ?? "");
  const [videoUrl, setVideoUrl] = useState(slot.kind === "video_url" ? slot.external_url ?? "" : "");
  const [stampOn, setStampOn] = useState(false);
  const [enhanceOn, setEnhanceOn] = useState(true);
  const [studioOpen, setStudioOpen] = useState(false);

  const [stamp, setStamp] = useState<BrandStampOptions>(BRAND_STAMP_DEFAULTS);
  const setStampField = <K extends keyof BrandStampOptions>(key: K, value: BrandStampOptions[K]) =>
    setStamp((prev) => ({ ...prev, [key]: value }));

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<void>, done: string) => {
    setBusy(kind);
    try {
      await action();
      onChanged();
      toast.success(done);
    } catch (error) {
      toast.error(message(error));
    } finally {
      setBusy(null);
    }
  };

  /** تحسين محلي (تكبير + إبراز + إعادة ضغط ≤300KB) مُسجَّل في سجل الصرف. */
  const enhanceFile = async (file: File): Promise<File> => {
    const { result } = await withEnhanceAudit(
      { provider: "local-canvas", purpose: "media_slot", slotKey: slot.slot_key, unitUsd: 0 },
      async () => {
        const out = await enhanceImageLocally(file, { targetWidth: 1536 });
        return { result: out, bytes: out.bytes };
      },
    );
    toast.message(
      `تحسين: ${result.width}×${result.height} · ${readableSize(result.bytes)} · ×${result.scaled}`,
    );
    return new File([result.blob], `${slot.slot_key}-enhanced.webp`, { type: "image/webp" });
  };

  const pick = (file: File | undefined) => {
    if (!file) return;
    void run(
      "upload",
      async () => {
        const source = enhanceOn && file.type.startsWith("image/") ? await enhanceFile(file) : file;
        const out = await uploadMediaSlotImage(slot, source, stampOn ? stamp : undefined);
        toast.message(
          `تم الضغط: ${out.width}×${out.height} · ${readableSize(out.bytes)}${
            out.stamped ? " · مختومة باسم كَحيل والأصل محفوظ" : ""
          }`,
        );
      },
      "تم رفع الصورة وظهرت في مكانها.",
    );
  };

  /** «حسّن الصورة» للصورة المنشورة حاليًا في الفتحة. */
  const enhanceCurrent = () => {
    if (!slot.url) return;
    void run(
      "enhance",
      async () => {
        const response = await fetch(slot.url as string);
        if (!response.ok) throw new Error("FETCH_FAILED");
        const blob = await response.blob();
        const source = await enhanceFile(
          new File([blob], `${slot.slot_key}.webp`, { type: blob.type || "image/webp" }),
        );
        await uploadMediaSlotImage(slot, source, stampOn ? stamp : undefined);
      },
      "تم تحسين الصورة الحالية.",
    );
  };



  return (
    <li className="rounded-[var(--r-card)] border border-border bg-card p-3">
      <div className="flex items-start gap-3">
        <span className="relative block size-20 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
          {slot.url ? (
            <img src={slot.url} alt="" className="size-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <span className="flex size-full items-center justify-center text-muted-foreground">
              <ImagePlus className="size-6" aria-hidden />
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <strong className="block truncate text-body font-extrabold text-foreground">
            {slot.title_ar ?? slot.slot_key}
          </strong>
          {slot.subtitle_ar ? (
            <span className="block truncate text-nav font-semibold text-primary">{slot.subtitle_ar}</span>
          ) : null}
          <span className="mt-0.5 block truncate text-nav text-muted-foreground" dir="ltr">
            {slot.slot_key}
          </span>
          <span className="mt-1 block text-desc text-muted-foreground">
            {slot.hidden
              ? "مخفية — لا تظهر للزوار."
              : slot.path || slot.external_url
                ? "منشورة — تظهر للزوار الآن."
                : "فارغة — تظهر الصورة الاحتياطية."}
          </span>
        </div>
      </div>

      <fieldset className="mt-3 rounded-xl border border-border p-[var(--sp-3)]">
        <legend className="px-1 text-desc font-bold text-foreground">نصاعة الصورة</legend>
        <label
          className="flex items-center gap-2 text-desc font-bold text-foreground"
          style={{ minHeight: 44 }}
        >
          <input
            type="checkbox"
            checked={enhanceOn}
            onChange={(event) => setEnhanceOn(event.target.checked)}
            className="size-5 accent-primary"
          />
          <Wand2 className="size-4 text-primary" aria-hidden />
          حسّن الصورة تلقائيًا عند الرفع
        </label>
        <button
          type="button"
          onClick={enhanceCurrent}
          disabled={!slot.url || busy !== null}
          className="k-press mt-2 inline-flex items-center gap-2 rounded-[var(--r-btn,12px)] border border-border px-4 text-desc font-bold text-foreground disabled:opacity-50"
          style={{ minHeight: 44 }}
        >
          <Wand2 className="size-4 text-primary" aria-hidden />
          {busy === "enhance" ? "جارٍ التحسين…" : "حسّن الصورة الحالية"}
        </button>
        <p className="mt-1 text-desc text-muted-foreground">
          تكبير إلى ١٥٣٦ بكسل مع إبراز الحدود وإعادة ضغط WebP بحدّ ٣٠٠ كيلوبايت.
        </p>
      </fieldset>

      <fieldset className="mt-3 rounded-xl border border-border p-[var(--sp-3)]">
        <legend className="px-1 text-desc font-bold text-foreground">ختم العلامة</legend>

        <label className="flex items-center gap-2 text-desc font-bold text-foreground" style={{ minHeight: 44 }}>
          <input
            type="checkbox"
            checked={stampOn}
            onChange={(event) => setStampOn(event.target.checked)}
            className="size-5 accent-primary"
          />
          <Stamp className="size-4 text-primary" aria-hidden />
          اختم باسم كَحيل عند الرفع
        </label>
        {stampOn ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="text-desc font-bold text-foreground">
              الموضع
              <select
                className="mt-1 w-full rounded-xl border border-border bg-card px-3 text-body font-bold text-foreground"
                style={{ minHeight: 44 }}
                value={stamp.position}
                onChange={(event) =>
                  setStampField("position", event.target.value as BrandStampOptions["position"])
                }
              >
                {STAMP_POSITIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-desc font-bold text-foreground">
              الحجم
              <select
                className="mt-1 w-full rounded-xl border border-border bg-card px-3 text-body font-bold text-foreground"
                style={{ minHeight: 44 }}
                value={stamp.size}
                onChange={(event) => setStampField("size", event.target.value as BrandStampOptions["size"])}
              >
                {STAMP_SIZES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-desc font-bold text-foreground">
              اللون
              <select
                className="mt-1 w-full rounded-xl border border-border bg-card px-3 text-body font-bold text-foreground"
                style={{ minHeight: 44 }}
                value={stamp.color}
                onChange={(event) => setStampField("color", event.target.value as BrandStampOptions["color"])}
              >
                {STAMP_COLORS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-desc font-bold text-foreground">
              الشفافية <span className="num">{stamp.opacity}%</span>
              <input
                type="range"
                min={30}
                max={100}
                value={stamp.opacity}
                onChange={(event) => setStampField("opacity", Number(event.target.value))}
                className="mt-2 w-full accent-primary"
              />
            </label>

            <label
              className="flex items-center gap-2 text-desc font-bold text-foreground sm:col-span-2"
              style={{ minHeight: 44 }}
            >
              <input
                type="checkbox"
                checked={stamp.ribbon}
                onChange={(event) => setStampField("ribbon", event.target.checked)}
                className="size-5 accent-primary"
              />
              خلفية شريط بتدرّج الهوية خلف الاسم
            </label>
            <p className="text-desc text-muted-foreground sm:col-span-2">
              تُحفظ النسخة المختومة للعرض، والأصلية بجانبها في المكتبة.
            </p>
          </div>
        ) : null}
      </fieldset>

      <div className="mt-3">
        <LocatePreviewButton target={{ kind: "slot", slotKey: slot.slot_key }} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            pick(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          size="sm"
          disabled={busy !== null}
          onClick={() => fileRef.current?.click()}
          className="gap-[var(--sp-2)]"
        >
          {slot.path ? <RefreshCw className="size-4" aria-hidden /> : <Upload className="size-4" aria-hidden />}
          {busy === "upload" ? "جارٍ الرفع…" : slot.path ? "استبدال الصورة" : "رفع صورة"}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy !== null}
          className="gap-[var(--sp-2)]"
          onClick={() =>
            void run(
              "hide",
              () => setMediaSlotHidden(slot.slot_key, !slot.hidden),
              slot.hidden ? "أصبحت الفتحة ظاهرة." : "أُخفيت الفتحة.",
            )
          }
        >
          {slot.hidden ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
          {slot.hidden ? "إظهار" : "إخفاء"}
        </Button>

        {slot.path || slot.external_url ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy !== null}
            className="gap-[var(--sp-2)]"
            onClick={() => void run("clear", () => clearMediaSlot(slot), "أُفرغت الفتحة — عاد الاحتياطي.")}
          >
            <Trash2 className="size-4" aria-hidden />
            إفراغ
          </Button>
        ) : null}

        {slot.kind === "image" ? (
          <Dialog open={studioOpen} onOpenChange={setStudioOpen}>
            <DialogTrigger asChild>
              <Button type="button" size="sm" variant="outline" className="gap-[var(--sp-2)]" disabled={busy !== null}>
                <Sparkles className="size-4" aria-hidden />
                ولّد بالذكاء الاصطناعي
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>توليد صورة لهذه الفتحة</DialogTitle>
                <DialogDescription>
                  {slot.title_ar ?? slot.slot_key} — الصورة المولّدة تُختَم باسم كَحيل ثم تُربط بالفتحة.
                </DialogDescription>
              </DialogHeader>
              <BrandImageStudio
                slot={slot}
                onChanged={() => {
                  onChanged();
                  setStudioOpen(false);
                }}
              />
            </DialogContent>
          </Dialog>
        ) : null}
      </div>


      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-desc font-semibold text-foreground">النص البديل</span>
          <Input
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            onBlur={() => {
              if ((slot.alt_text ?? "") === alt) return;
              void run("meta", () => saveMediaSlotMeta(slot.slot_key, { alt_text: alt }), "حُفظ النص البديل.");
            }}
            placeholder="وصف الصورة لقارئ الشاشة"
          />
        </label>

        <label className="block">
          <span className="mb-1 flex items-center gap-1 text-desc font-semibold text-foreground">
            <Link2 className="size-4 text-primary" aria-hidden />
            رابط مقطع فيديو (اختياري)
          </span>
          <Input
            dir="ltr"
            value={videoUrl}
            onChange={(event) => setVideoUrl(event.target.value)}
            onBlur={() => {
              const next = videoUrl.trim();
              if (!next || next === (slot.external_url ?? "")) return;
              if (!/^https:\/\//i.test(next)) {
                toast.error("الرابط يجب أن يبدأ بـ https://");
                return;
              }
              void run(
                "meta",
                () => saveMediaSlotMeta(slot.slot_key, { external_url: next, kind: "video_url" }),
                "حُفظ رابط المقطع.",
              );
            }}
            placeholder="https://…"
          />
        </label>
      </div>
    </li>
  );
}

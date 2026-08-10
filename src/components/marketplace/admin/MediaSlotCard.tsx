/**
 * بطاقة فتحة بصرية واحدة في `/admin/appearance`.
 *
 * تعرض: المعاينة الحالية (أو «فارغة — يظهر الاحتياطي»)، زر رفع/استبدال بأيقونة
 * واضحة، إخفاء/إظهار، إفراغ، ونص بديل. الرفع يضغط الصورة في المتصفح قبل
 * إرسالها (١٦٠٠px · WebP · ≤٣٠٠KB)، والفيديو رابط خارجي فقط حاليًا.
 */
import { useRef, useState } from "react";
import { Eye, EyeOff, ImagePlus, Link2, RefreshCw, Stamp, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readableSize } from "@/lib/media-compress";
import {
  STAMP_POSITIONS,
  type BrandStampOptions,
  type BrandStampPosition,
} from "@/lib/kaheel-brand-stamp";
import {
  clearMediaSlot,
  saveMediaSlotMeta,
  setMediaSlotHidden,
  uploadMediaSlotImage,
  type MediaSlot,
} from "@/lib/mkt-media-slots";


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
  const [busy, setBusy] = useState<null | "upload" | "hide" | "clear" | "meta">(null);
  const [alt, setAlt] = useState(slot.alt_text ?? "");
  const [videoUrl, setVideoUrl] = useState(slot.kind === "video_url" ? slot.external_url ?? "" : "");

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

  const pick = (file: File | undefined) => {
    if (!file) return;
    void run(
      "upload",
      async () => {
        const out = await uploadMediaSlotImage(slot, file);
        toast.message(`تم الضغط: ${out.width}×${out.height} · ${readableSize(out.bytes)}`);
      },
      "تم رفع الصورة وظهرت في مكانها.",
    );
  };

  return (
    <li className="rounded-2xl border border-border bg-card p-3">
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
          className="gap-1.5"
        >
          {slot.path ? <RefreshCw className="size-4" aria-hidden /> : <Upload className="size-4" aria-hidden />}
          {busy === "upload" ? "جارٍ الرفع…" : slot.path ? "استبدال الصورة" : "رفع صورة"}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy !== null}
          className="gap-1.5"
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
            className="gap-1.5"
            onClick={() => void run("clear", () => clearMediaSlot(slot), "أُفرغت الفتحة — عاد الاحتياطي.")}
          >
            <Trash2 className="size-4" aria-hidden />
            إفراغ
          </Button>
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

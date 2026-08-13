/**
 * «هوية الواجهة» — بطاقتا رفع صورة معزولتان لمالك المنصة: بنر الرئيسية وشعار
 * الهيدر.
 *
 * ليست محرّر كود ولا لوحة استوديو: مجرد رفع/حذف صورة واحدة لكل فتحة، عبر نفس
 * دوال `mkt_media_slots` المحمية بـ SECURITY DEFINER (`mkt_is_platform_admin`)
 * ونفس حاوية الهوية `mkt-media` (كتابة للمالك، قراءة عامة للمنشور فقط).
 *
 * البنر يقبل «استخدام الرسم الافتراضي» فيرفع رسم «سوريا فخرنا» المضمّن في
 * الحزمة كصورة للفتحة ⇒ الرسم القديم لم يُحذف، صار خيارًا قابلًا للتبديل.
 */
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  clearMediaSlot,
  uploadMediaSlotImage,
  useMediaSlots,
  useRefreshMediaSlots,
  type MediaSlot,
} from "@/lib/mkt-media-slots";

import prideArt from "@/assets/market/home-syria-pride.jpg";

const HERO_KEY = "home.hero.banner";
const LOGO_KEY = "brand.logo.header.light";

export function BrandIdentityUploads() {
  const slots = useMediaSlots();
  const refresh = useRefreshMediaSlots();
  const find = (key: string) => slots.data?.find((slot) => slot.slot_key === key);

  return (
    <section aria-labelledby="brand-identity" className="mb-6">
      <h2 id="brand-identity" className="mb-2 text-section font-extrabold text-foreground">
        هوية الواجهة — البنر والشعار
      </h2>
      <ul className="grid gap-3 lg:grid-cols-2">
        <IdentityCard
          slotKey={HERO_KEY}
          slot={find(HERO_KEY)}
          title="بنر الصفحة الرئيسية"
          specs="المقاس الموصى به 1920×600 · نسبة 16:5 · PNG أو JPG أو WebP · أقل من 2 ميجابايت"
          warning="اترك هامش أمان 10% من الحواف: النص والبطاقة يعلوان مركز الصورة، وقد تُقصّ الأطراف على الشاشات الضيقة."
          aspect="16 / 5"
          defaultArt={prideArt}
          onChanged={refresh}
        />
        <IdentityCard
          slotKey={LOGO_KEY}
          slot={find(LOGO_KEY)}
          title="شعار الهيدر"
          specs="المقاس التقريبي 240×80 · نسبة 3:1 · SVG مفضّل أو PNG شفاف · أقل من 500 كيلوبايت"
          warning="بلا شعار مرفوع يظهر نص «كَحيل» بلون الهوية الداكن تلقائيًا."
          aspect="3 / 1"
          onChanged={refresh}
        />
      </ul>
    </section>
  );
}

function IdentityCard({
  slotKey,
  slot,
  title,
  specs,
  warning,
  aspect,
  defaultArt,
  onChanged,
}: {
  slotKey: string;
  slot: MediaSlot | undefined;
  title: string;
  specs: string;
  warning: string;
  aspect: string;
  defaultArt?: string;
  onChanged: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر إتمام العملية.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-[var(--r-card)] border border-border bg-card p-[var(--sp-4)]">
      <h3 className="text-section font-bold text-foreground">{title}</h3>
      <p className="mt-1 text-desc text-muted-foreground">{specs}</p>
      <p className="mt-1 text-desc text-foreground/80">{warning}</p>

      <div
        className="mt-3 grid w-full place-items-center overflow-hidden rounded-xl border border-border bg-secondary/40"
        style={{ aspectRatio: aspect }}
      >
        {slot?.url ? (
          <img src={slot.url} alt={slot.alt_text ?? title} className="size-full object-cover" />
        ) : (
          <span className="text-desc text-muted-foreground">
            {slot ? "لا صورة مرفوعة — تظهر الهيئة الافتراضية" : "الفتحة غير مهيّأة بعد"}
          </span>
        )}
      </div>

      {!slot ? (
        <p className="mt-3 rounded-xl border border-primary/25 bg-primary/8 p-2 text-desc text-foreground">
          هذه الفتحة تحتاج تهيئة في قاعدة البيانات (سجل واحد في <code>mkt_media_slots</code>) قبل
          تفعيل الرفع — الهجرة جاهزة وتنتظر موافقة المالك.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file || !slot) return;
            void run(async () => {
              await uploadMediaSlotImage(slot, file);
              toast.success("تم تحديث الصورة.");
            });
          }}
        />
        <Button
          size="sm"
          className="gap-[var(--sp-2)]"
          disabled={busy || !slot}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="size-4" aria-hidden />
          )}
          {slot?.url ? "تغيير الصورة" : "رفع صورة"}
        </Button>

        {defaultArt ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !slot}
            onClick={() => {
              if (!slot) return;
              void run(async () => {
                const response = await fetch(defaultArt);
                const blob = await response.blob();
                await uploadMediaSlotImage(
                  slot,
                  new File([blob], "kaheel-syria-pride.jpg", { type: blob.type || "image/jpeg" }),
                );
                toast.success("تم تطبيق الرسم الافتراضي (علم سوريا).");
              });
            }}
          >
            استخدام الرسم الافتراضي (علم سوريا)
          </Button>
        ) : null}

        <Button
          size="sm"
          variant="outline"
          className="gap-[var(--sp-2)] text-destructive"
          disabled={busy || !slot?.url}
          onClick={() => {
            if (!slot) return;
            void run(async () => {
              await clearMediaSlot(slot);
              toast.success("تم حذف الصورة.");
            });
          }}
        >
          <Trash2 className="size-4" aria-hidden />
          حذف
        </Button>
      </div>

      <p className="mt-2 text-nav text-muted-foreground">
        مفتاح الفتحة: <code>{slotKey}</code>
      </p>
    </li>
  );
}

export default BrandIdentityUploads;

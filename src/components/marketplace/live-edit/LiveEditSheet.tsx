/**
 * لوحة تعديل فتحة واحدة في وضع التحرير البصري.
 *
 * الأدوات تتبع نوع الفتحة: خلفية (لون/تدرّج/صورة)، وسائط (رفع واستبدال)،
 * إعلان (ربط حملة وجدولة)، تصميم (اختيار نمط الصفحة). كل تعديل يُحفظ مسوّدة
 * يراها المدير وحده حتى يضغط «نشر التغيير»، وكل نشر يُسجّل ويمكن التراجع عنه.
 */
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCheck, ImagePlus, Undo2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { readableSize } from "@/lib/media-compress";
import { fmtDateTime } from "@/lib/format";
import { activatePageVariant, usePageVariants, useRefreshPageVariants } from "@/lib/mkt-page-variants";
import { useAdminCampaigns } from "@/lib/mkt-campaigns";
import type { MediaSlot } from "@/lib/mkt-media-slots";
import {
  CONTRAST_MIN,
  discardSlotDraft,
  fetchSlotHistory,
  publishSlotDraft,
  saveSlotDraft,
  undoSlotChange,
  uploadSlotDraftImage,
  useRefreshLiveEdit,
  worstContrast,
  type SlotPatch,
} from "@/lib/mkt-live-edit";

const ERRORS: Record<string, string> = {
  NOT_ADMIN: "هذه العملية لمدير المنصة فقط.",
  NO_DRAFT: "لا توجد مسوّدة لنشرها.",
  NO_HISTORY: "لا يوجد تغيير سابق للتراجع عنه.",
  BAD_COLOR: "اللون غير مقبول — استخدم لونًا سداسيًا صحيحًا.",
  BAD_ANGLE: "الزاوية يجب أن تكون بين 0 و360.",
  BAD_CAMPAIGN: "الحملة غير موجودة.",
  COMPRESS_TOO_LARGE: "تعذّر ضغط الصورة تحت ٣٠٠ كيلوبايت — جرّب صورة أبسط.",
};

function message(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const key = Object.keys(ERRORS).find((code) => raw.includes(code));
  return key ? ERRORS[key]! : `تعذّر التنفيذ (${raw})`;
}

const HEX = /^#[0-9a-f]{6}$/i;

export function LiveEditSheet({
  slot,
  draft,
  onClose,
}: {
  slot: MediaSlot;
  draft: SlotPatch | undefined;
  onClose: () => void;
}) {
  const refresh = useRefreshLiveEdit();
  const refreshVariants = useRefreshPageVariants();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const current: SlotPatch = { ...slot, ...draft };
  const [bg, setBg] = useState(current.bg_color ?? "");
  const [from, setFrom] = useState(current.grad_from ?? "");
  const [to, setTo] = useState(current.grad_to ?? "");
  const [angle, setAngle] = useState(current.grad_angle ?? 90);
  const [alt, setAlt] = useState(current.alt_text ?? "");
  const [campaign, setCampaign] = useState(current.campaign_id ?? "");
  const [startsAt, setStartsAt] = useState((current.campaign_from ?? "").slice(0, 16));
  const [endsAt, setEndsAt] = useState((current.campaign_to ?? "").slice(0, 16));

  useEffect(() => {
    setBg(slot.bg_color ?? "");
  }, [slot.slot_key, slot.bg_color]);

  const campaigns = useAdminCampaigns(slot.edit_kind === "ad");
  const variants = usePageVariants();
  const history = useQuery({
    queryKey: ["mkt", "slot-history", slot.slot_key],
    queryFn: () => fetchSlotHistory(slot.slot_key, 4),
  });

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await action();
      refresh();
      void history.refetch();
      toast.success(done);
    } catch (error) {
      toast.error(message(error));
    } finally {
      setBusy(false);
    }
  };

  /** فحص التباين: النص أبيض فوق الخلفية المقترحة، والحد 4.5:1 لا يُتجاوز. */
  const contrast = worstContrast("#ffffff", [bg || null, from || null, to || null]);
  const contrastFails = contrast < CONTRAST_MIN;

  const saveStyle = () => {
    if (bg && !HEX.test(bg)) return toast.error(ERRORS["BAD_COLOR"]!);
    if ((from && !HEX.test(from)) || (to && !HEX.test(to))) return toast.error(ERRORS["BAD_COLOR"]!);
    if (contrastFails)
      return toast.error(
        `التباين ${contrast.toFixed(2)}:1 أقل من ٤٫٥:١ — اختر لونًا أغمق ليبقى النص مقروءًا.`,
      );
    void run(
      () =>
        saveSlotDraft(slot.slot_key, {
          bg_color: bg || null,
          grad_from: from || null,
          grad_to: to || null,
          grad_angle: from && to ? Number(angle) : null,
        }),
      "حُفظ كمسوّدة — تراه أنت وحدك حتى النشر.",
    );
  };

  const pickImage = (file: File | undefined) => {
    if (!file) return;
    void run(async () => {
      const out = await uploadSlotDraftImage(slot.slot_key, file);
      await saveSlotDraft(slot.slot_key, { path: out.path });
      toast.message(`تم الضغط: ${out.width}×${out.height} · ${readableSize(out.bytes)}`);
    }, "الصورة محفوظة كمسوّدة — اضغط «نشر التغيير» لإظهارها للزوار.");
  };

  const pageVariants = (variants.data ?? []).filter((item) => item.page === slot.variant_page);

  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl">
        <SheetTitle className="text-section font-extrabold">
          {slot.title_ar ?? slot.slot_key}
        </SheetTitle>
        <p className="mb-3 text-desc text-muted-foreground" dir="ltr">
          {slot.slot_key}
        </p>

        {draft ? (
          <p className="mb-3 rounded-2xl border border-gold/40 bg-gold/12 p-2.5 text-desc font-bold text-foreground">
            لديك مسوّدة غير منشورة على هذه الفتحة — يراها المدير فقط.
          </p>
        ) : null}

        {slot.edit_kind === "background" ? (
          <div className="space-y-3">
            <label className="block text-desc font-bold text-foreground">
              لون الخلفية
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={HEX.test(bg) ? bg : "#8a4fff"}
                  onChange={(event) => setBg(event.target.value)}
                  className="size-11 rounded-xl border border-border"
                  aria-label="لون الخلفية"
                />
                <Input value={bg} onChange={(event) => setBg(event.target.value)} placeholder="#8a4fff" dir="ltr" />
              </div>
            </label>

            <fieldset className="rounded-2xl border border-border p-2.5">
              <legend className="px-1 text-desc font-bold text-foreground">تدرّج بلونين</legend>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={HEX.test(from) ? from : "#8a4fff"}
                  onChange={(event) => setFrom(event.target.value)}
                  className="size-11 rounded-xl border border-border"
                  aria-label="لون البداية"
                />
                <input
                  type="color"
                  value={HEX.test(to) ? to : "#c3abff"}
                  onChange={(event) => setTo(event.target.value)}
                  className="size-11 rounded-xl border border-border"
                  aria-label="لون النهاية"
                />
                <label className="flex-1 text-desc font-bold text-foreground">
                  الزاوية
                  <Input
                    className="num mt-1"
                    type="number"
                    min={0}
                    max={360}
                    value={angle}
                    onChange={(event) => setAngle(Number(event.target.value))}
                  />
                </label>
              </div>
            </fieldset>

            <p
              className={`text-desc font-bold ${contrastFails ? "text-destructive" : "text-muted-foreground"}`}
            >
              تباين النص الأبيض: <span className="num">{contrast.toFixed(2)}</span>:1
              {contrastFails ? " — مرفوض، الحد ٤٫٥:١" : " ✓"}
            </p>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy || contrastFails} onClick={saveStyle}>
                حفظ كمسوّدة
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
                <ImagePlus className="size-4" aria-hidden /> صورة خلفية
              </Button>
            </div>
          </div>
        ) : null}

        {slot.edit_kind === "media" ? (
          <div className="space-y-3">
            <span className="block h-32 overflow-hidden rounded-2xl border border-border bg-muted">
              {slot.url ? (
                <img src={slot.url} alt="" className="size-full object-cover" loading="lazy" />
              ) : null}
            </span>
            <label className="block text-desc font-bold text-foreground">
              النص البديل
              <Input className="mt-1" value={alt} onChange={(event) => setAlt(event.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                <ImagePlus className="size-4" aria-hidden /> رفع / استبدال
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void run(() => saveSlotDraft(slot.slot_key, { alt_text: alt }), "حُفظ النص كمسوّدة.")}
              >
                حفظ النص
              </Button>
            </div>
          </div>
        ) : null}

        {slot.edit_kind === "ad" ? (
          <div className="space-y-3">
            <label className="block text-desc font-bold text-foreground">
              الحملة المعروضة
              <select
                className="mt-1 w-full rounded-xl border border-border bg-card px-3 text-body"
                style={{ minHeight: 44 }}
                value={campaign}
                onChange={(event) => setCampaign(event.target.value)}
              >
                <option value="">بلا ربط (تلقائي حسب الأولوية)</option>
                {(campaigns.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title_ar || item.slug} — {item.placement}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-desc font-bold text-foreground">
                من
                <Input
                  className="num mt-1"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                />
              </label>
              <label className="block text-desc font-bold text-foreground">
                إلى
                <Input
                  className="num mt-1"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                />
              </label>
            </div>
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    saveSlotDraft(slot.slot_key, {
                      campaign_id: campaign || null,
                      campaign_from: startsAt ? new Date(startsAt).toISOString() : null,
                      campaign_to: endsAt ? new Date(endsAt).toISOString() : null,
                    }),
                  "ربط الحملة محفوظ كمسوّدة.",
                )
              }
            >
              حفظ كمسوّدة
            </Button>
          </div>
        ) : null}

        {slot.edit_kind === "design" ? (
          <ul className="space-y-2">
            {pageVariants.map((item) => (
              <li key={item.variant_key}>
                <Button
                  variant={item.is_active ? "default" : "outline"}
                  className="h-auto w-full justify-start py-2 text-start"
                  disabled={busy || item.is_active}
                  onClick={() =>
                    void run(async () => {
                      await activatePageVariant(item.page, item.variant_key);
                      refreshVariants();
                    }, `تم تفعيل تصميم «${item.name_ar}» لكل الزوار.`)
                  }
                >
                  <span className="min-w-0">
                    <strong className="block text-body font-extrabold">{item.name_ar}</strong>
                    <span className="block text-desc opacity-80">{item.description_ar}</span>
                  </span>
                </Button>
              </li>
            ))}
            {pageVariants.length === 0 ? (
              <li className="text-desc text-muted-foreground">لا تصاميم مسجّلة لهذه الصفحة.</li>
            ) : null}
          </ul>
        ) : null}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            pickImage(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
          <Button
            size="sm"
            disabled={busy || !draft}
            onClick={() => void run(() => publishSlotDraft(slot.slot_key), "نُشر التغيير — الزوار يرونه الآن.")}
          >
            <CheckCheck className="size-4" aria-hidden /> نشر التغيير
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !draft}
            onClick={() => void run(() => discardSlotDraft(slot.slot_key), "أُلغيت المسوّدة.")}
          >
            <X className="size-4" aria-hidden /> إلغاء المسوّدة
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void run(() => undoSlotChange(slot.slot_key), "تم التراجع لآخر قيمة.")}
          >
            <Undo2 className="size-4" aria-hidden /> تراجع
          </Button>
        </div>

        {(history.data ?? []).length > 0 ? (
          <ul className="mt-3 space-y-1">
            {(history.data ?? []).map((row) => (
              <li key={row.id} className="text-desc text-muted-foreground">
                <span className="num">{fmtDateTime(row.created_at)}</span> — تعديل منشور
              </li>
            ))}
          </ul>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

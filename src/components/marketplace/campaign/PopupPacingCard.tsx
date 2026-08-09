/**
 * Admin switch for the tap-triggered mascot cards.
 *
 * The cards no longer appear on a timer: the mascot only drops when the visitor
 * taps something, so the single meaningful control left is on/off. It is stored
 * in `mkt_platform_settings` (`popup.pacing`) alongside the legacy timing keys,
 * which stay untouched for backward compatibility.
 */
import type React from "react";
import { useEffect, useState } from "react";
import { Loader2, Timer } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { savePlatformSetting } from "@/lib/mkt-platform";
import {
  DEFAULT_PACING,
  loadPopupPacing,
  POPUP_PACING_KEY,
  type PopupPacing,
} from "@/lib/popup-pacing";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function PopupPacingCard() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [values, setValues] = useState<PopupPacing>(DEFAULT_PACING);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadPopupPacing().then(setValues);
  }, []);

  async function save() {
    setBusy(true);
    try {
      await savePlatformSetting(
        POPUP_PACING_KEY,
        {
          first_delay_ms: values.firstDelayMs,
          interval_ms: values.intervalMs,
          max_per_session: values.maxPerSession,
          auto_dismiss_ms: values.autoDismissMs,
          page_settle_ms: values.pageSettleMs,
          drop_cooldown_ms: values.dropCooldownMs,
          drop_visible_ms: values.dropVisibleMs,
          rapid_taps: values.rapidTaps,
          rapid_window_ms: values.rapidWindowMs,
          entrance_ms: values.entranceMs,
          enabled: values.enabled,
        },
        ar ? "تعديل إيقاع البطاقات الترويجية" : "Promo popup pacing update",
      );
      toast.success(ar ? "حُفظ إيقاع البطاقات" : "Pacing saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ERROR");
    } finally {
      setBusy(false);
    }
  }

  /** حقل رقمي واحد — كل توقيتات المشاهد قابلة للضبط من هنا. */
  const field = (
    key: "dropCooldownMs" | "dropVisibleMs" | "rapidTaps" | "rapidWindowMs" | "entranceMs",
    labelAr: string,
    labelEn: string,
    hintAr: string,
  ) => (
    <label key={key} className="space-y-1 text-xs">
      <span className="font-bold">{ar ? labelAr : labelEn}</span>
      <Input
        type="number"
        inputMode="numeric"
        value={values[key]}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          setValues((prev) => ({ ...prev, [key]: Number(event.target.value) || 0 }))
        }
      />
      <span className="block text-[11px] text-muted-foreground">{hintAr}</span>
    </label>
  );

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <Timer className="size-4 text-primary" aria-hidden />
          <p className="text-sm font-bold">
            {ar ? "بطاقات الشخصية عند اللمس" : "Tap-triggered mascot cards"}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {ar
            ? "الشخصية لا تظهر من تلقاء نفسها: يسقط «الزعيم كَحيلان» عند لمس الزائر لرابط أو زر، وتبقى البطاقة ظاهرة حتى يضغط الزائر زر الإغلاق (×) — لا اختفاء تلقائي. ولا تحجب المحتوى ولا تعطّل التمرير، ولا تظهر أثناء الكتابة أو المحادثة أو المكالمة أو الدفع، ولا تظهر بطاقة ثانية ما دامت واحدة مفتوحة."
            : "The mascot never self-appears: Boss Kaheelan drops in when the visitor taps a link or button, and the card stays until the visitor presses close (×) — no auto-dismiss. It never blocks content or scrolling, never shows during typing, chat, a call or checkout, and never stacks a second card."}
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {field(
            "dropCooldownMs",
            "فاصل بين سقوطين (مللي ثانية)",
            "Gap between drops (ms)",
            "٢٠٠٠ – ٣٠٠٠٠٠",
          )}
          {field("rapidTaps", "ضغطات مزحة الكبس", "Rapid-tap joke threshold", "٣ – ١٥ ضغطة")}
          {field(
            "rapidWindowMs",
            "نافذة الكبس (مللي ثانية)",
            "Rapid-tap window (ms)",
            "١٠٠٠ – ١٥٠٠٠",
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={values.enabled ? "default" : "outline"}
            onClick={() => setValues((prev) => ({ ...prev, enabled: !prev.enabled }))}
          >
            {values.enabled
              ? ar
                ? "البطاقات مُفعّلة"
                : "Cards enabled"
              : ar
                ? "البطاقات موقوفة"
                : "Cards paused"}
          </Button>
          <Button type="button" size="sm" onClick={() => void save()} disabled={busy}>
            {busy ? <Loader2 className="me-1 size-4 animate-spin" aria-hidden /> : null}
            {ar ? "حفظ" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


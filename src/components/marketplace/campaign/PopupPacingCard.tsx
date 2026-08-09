/**
 * Admin control for the promo popup rhythm.
 *
 * Everything the cards do in time — first delay, gap between cards, session
 * cap, auto-dismiss — is stored in `mkt_platform_settings` (`popup.pacing`) so
 * the owner can retune the cadence without a code change. Values are clamped
 * both here and in `normalisePacing`, so a typo cannot turn the cards into a
 * nuisance.
 */
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
import { Label } from "@/components/ui/label";

type Field = {
  key: keyof PopupPacing;
  ar: string;
  en: string;
  /** Shown value unit: seconds are friendlier than milliseconds. */
  seconds?: boolean;
};

const FIELDS: Field[] = [
  { key: "firstDelayMs", ar: "أول ظهور بعد (ثانية)", en: "First card after (s)", seconds: true },
  { key: "intervalMs", ar: "الفاصل بين البطاقات (ثانية)", en: "Gap between cards (s)", seconds: true },
  { key: "autoDismissMs", ar: "الاختفاء التلقائي (ثانية)", en: "Auto-dismiss (s)", seconds: true },
  { key: "pageSettleMs", ar: "هدوء بعد تحميل الصفحة (ثانية)", en: "Quiet after page load (s)", seconds: true },
  { key: "maxPerSession", ar: "الحد الأقصى في الجلسة", en: "Max per session" },
];

export function PopupPacingCard() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [values, setValues] = useState<PopupPacing>(DEFAULT_PACING);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadPopupPacing().then(setValues);
  }, []);

  const shown = (field: Field) =>
    field.seconds ? Math.round(Number(values[field.key]) / 1000) : Number(values[field.key]);

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

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <Timer className="size-4 text-primary" aria-hidden />
          <p className="text-sm font-bold">
            {ar ? "إيقاع البطاقات الترويجية" : "Promo popup pacing"}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {ar
            ? "تُطبَّق هذه الأرقام على البطاقات الخفيفة الجانبية. لا تظهر البطاقات أثناء الكتابة أو المحادثة أو المكالمة أو الدفع، وتتوقف تلقائيًا إذا أغلقها الزائر مرتين بسرعة."
            : "These numbers drive the light side cards. Cards never appear while typing, chatting, calling or paying, and stop themselves after two impatient closes."}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <div key={field.key} className="space-y-1">
              <Label>{ar ? field.ar : field.en}</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={shown(field)}
                onChange={(event) => {
                  const raw = Number(event.target.value);
                  const next = Number.isFinite(raw) ? raw : 0;
                  setValues((prev) => ({
                    ...prev,
                    [field.key]: field.seconds ? next * 1000 : next,
                  }));
                }}
              />
            </div>
          ))}
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
            {ar ? "حفظ الإيقاع" : "Save pacing"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

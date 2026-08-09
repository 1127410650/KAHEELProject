/**
 * لوحة العلامة المائية وحقوق الأصول البصرية — لمدير النظام.
 *
 * تقرأ إعداد `assets.watermark` وتكتبه عبر `mkt_admin_set_setting` (يستوجب سببًا
 * ويُسجَّل في سجل التدقيق). المعاينة تستخدم نفس دالة الرسم المستخدمة في الإنتاج
 * `drawKaheelWatermark`، فما تراه هنا هو ما يُطبَّق على الأصل فعلًا.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { adminErrorMessage, savePlatformSetting } from "@/lib/mkt-platform";
import { supabase } from "@/integrations/supabase/client";
import {
  clearWatermarkCache,
  drawKaheelWatermark,
  normalizeWatermarkConfig,
  WATERMARK_POSITIONS,
  WATERMARK_SETTING_KEY,
  type WatermarkConfig,
} from "@/lib/kaheel-watermark";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ReasonDialog } from "@/components/marketplace/ReasonDialog";

const PREVIEW_W = 320;
const PREVIEW_H = 180;

export function WatermarkCard() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<WatermarkConfig | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const setting = useQuery({
    queryKey: ["mkt", "admin", "watermark"],
    queryFn: async (): Promise<WatermarkConfig> => {
      const { data } = await supabase
        .from("mkt_platform_settings")
        .select("value")
        .eq("key", WATERMARK_SETTING_KEY)
        .maybeSingle();
      return normalizeWatermarkConfig((data as { value?: unknown } | null)?.value);
    },
  });

  const saved = setting.data ?? null;
  const config = draft ?? saved;

  const dirty = useMemo(
    () => !!saved && !!draft && JSON.stringify(saved) !== JSON.stringify(draft),
    [saved, draft],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !config) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // خلفية معاينة بتدرّج الهوية حتى يُرى النص على الفاتح والغامق معًا.
    const gradient = ctx.createLinearGradient(0, 0, PREVIEW_W, PREVIEW_H);
    gradient.addColorStop(0, "#2a1147");
    gradient.addColorStop(0.55, "#7c3aed");
    gradient.addColorStop(1, "#f3e8ff");
    ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
    if (config.enabled) drawKaheelWatermark(ctx, PREVIEW_W, PREVIEW_H, config);
  }, [config]);

  const update = (patch: Partial<WatermarkConfig>) => {
    if (!config) return;
    setDraft({ ...config, ...patch });
  };

  async function save(reason: string) {
    if (!draft) return;
    setBusy(true);
    try {
      await savePlatformSetting(WATERMARK_SETTING_KEY, { ...draft }, reason);
      clearWatermarkCache();
      toast.success(t("admin.actionDone"));
      setConfirming(false);
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "watermark"] });
      await queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "settings"] });
    } catch (error) {
      toast.error(adminErrorMessage(error, t("admin.actionFailed")));
    } finally {
      setBusy(false);
    }
  }

  const ar = locale === "ar";

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-foreground">{t("admin.watermark.title")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("admin.watermark.hint")}</p>
        </div>
        {config && (
          <span className="grid min-h-11 min-w-11 shrink-0 place-items-center">
            <Switch
              checked={config.enabled}
              aria-label={t("admin.watermark.enabled")}
              onCheckedChange={(next) => update({ enabled: next })}
            />
          </span>
        )}
      </header>

      {setting.isLoading || !config ? (
        <Skeleton className="mt-4 h-48 w-full rounded-xl" />
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div>
            <canvas
              ref={canvasRef}
              width={PREVIEW_W}
              height={PREVIEW_H}
              className="h-[180px] w-full max-w-[320px] rounded-lg border border-border"
              aria-label={t("admin.watermark.preview")}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">{t("admin.watermark.preview")}</p>
          </div>

          <div className="grid gap-4">
            <div>
              <p className="text-xs font-semibold text-foreground">{t("admin.watermark.position")}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {WATERMARK_POSITIONS.map((item) => (
                  <Button
                    key={item.key}
                    type="button"
                    size="sm"
                    variant={config.position === item.key ? "default" : "outline"}
                    className="min-h-11 justify-center"
                    onClick={() => update({ position: item.key })}
                  >
                    {ar ? item.ar : item.en}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center justify-between text-xs font-semibold text-foreground">
                <span>{t("admin.watermark.opacity")}</span>
                <span className="tabular-nums text-muted-foreground">{config.opacity}%</span>
              </label>
              <Slider
                className="mt-3"
                value={[config.opacity]}
                min={20}
                max={90}
                step={5}
                aria-label={t("admin.watermark.opacity")}
                onValueChange={([next]) => update({ opacity: next ?? config.opacity })}
              />
            </div>

            <div>
              <label className="flex items-center justify-between text-xs font-semibold text-foreground">
                <span>{t("admin.watermark.size")}</span>
                <span className="tabular-nums text-muted-foreground">
                  {config.sizePct.toFixed(1)}%
                </span>
              </label>
              <Slider
                className="mt-3"
                value={[config.sizePct]}
                min={1}
                max={8}
                step={0.2}
                aria-label={t("admin.watermark.size")}
                onValueChange={([next]) => update({ sizePct: next ?? config.sizePct })}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold text-foreground">
                {t("admin.watermark.text")}
                <Input
                  value={config.text}
                  maxLength={60}
                  className="h-11"
                  onChange={(event) => update({ text: event.target.value })}
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-foreground">
                {t("admin.watermark.url")}
                <Input
                  value={config.url}
                  maxLength={60}
                  dir="ltr"
                  className="h-11"
                  onChange={(event) => update({ url: event.target.value })}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="min-h-11"
                disabled={!dirty}
                onClick={() => setConfirming(true)}
              >
                {t("common.save")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                disabled={!dirty}
                onClick={() => setDraft(null)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ReasonDialog
        open={confirming}
        title={t("admin.watermark.title")}
        description={t("admin.watermark.hint")}
        confirmLabel={t("common.save")}
        pending={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={(reason) => void save(reason)}
      />
    </section>
  );
}

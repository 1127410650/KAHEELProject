/**
 * مكتبة الخلفيات في لوحة مدير النظام.
 *
 * المصغّرات هنا هي ملفات الخلفية نفسها (أكبرها ١٠١ كيلوبايت) وتُحمَّل بـ
 * `loading="lazy"` داخل هذه الصفحة الإدارية وحدها — الزائر العادي لا يرى هذا
 * المكوّن ولا يحمّل شيئًا منه.
 *
 * كل شيء يُحفظ في `mkt_platform_settings` عبر `mkt_admin_set_setting`، وهي
 * دالة لا يمرّها إلا مدير منصة، فإخفاء الزر ليس ضابطًا بحد ذاته.
 */
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Images, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { savePlatformSetting } from "@/lib/mkt-platform";
import {
  BACKDROP_HEIGHT,
  BACKDROP_LIBRARY,
  BACKDROP_SETTINGS_KEY,
  BACKDROP_WIDTH,
  DEFAULT_BACKDROP_SETTINGS,
  SEASON_LABEL,
  backdropSettingsPayload,
  loadBackdropSettings,
  resolveBackdrop,
  riyadhDayKey,
  type BackdropSettings,
} from "@/lib/mkt-backdrops";
import { campaignAssetPath, prepareCampaignAsset, uploadCampaignAsset } from "@/lib/mkt-campaigns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MODES = ["daily", "fixed", "off"] as const;
const MODE_LABEL: Record<(typeof MODES)[number], [string, string]> = {
  daily: ["تبديل يومي", "Daily rotation"],
  fixed: ["خلفية ثابتة", "Fixed backdrop"],
  off: ["بلا خلفية", "No backdrop"],
};

export function BackdropLibraryCard() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [settings, setSettings] = useState<BackdropSettings>(DEFAULT_BACKDROP_SETTINGS);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    void loadBackdropSettings().then(setSettings);
  }, []);

  const dayKey = riyadhDayKey();
  const today = useMemo(() => resolveBackdrop(settings, dayKey), [settings, dayKey]);
  const totalBytes = BACKDROP_LIBRARY.reduce((sum, item) => sum + item.bytes, 0);

  const toggle = (list: "enabled" | "holdback", id: string) =>
    setSettings((prev) => ({
      ...prev,
      [list]: prev[list].includes(id) ? prev[list].filter((entry) => entry !== id) : [...prev[list], id],
    }));

  const setWindow = (id: string, part: "from" | "to", value: string) =>
    setSettings((prev) => {
      const current = prev.windows[id] ?? { from: "", to: "" };
      const next = { ...current, [part]: value };
      const windows = { ...prev.windows };
      if (next.from && next.to) windows[id] = next;
      else if (!next.from && !next.to) delete windows[id];
      else windows[id] = next;
      return { ...prev, windows };
    });

  async function save() {
    setBusy(true);
    try {
      await savePlatformSetting(
        BACKDROP_SETTINGS_KEY,
        backdropSettingsPayload(settings),
        ar ? "تعديل مكتبة خلفيات كَحيل" : "Kaheel backdrop library update",
      );
      toast.success(ar ? "حُفظت إعدادات الخلفيات" : "Backdrop settings saved");
    } catch {
      toast.error(ar ? "تعذّر الحفظ" : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const prepared = await prepareCampaignAsset(file);
      if (prepared.error || (prepared.kind !== "webp" && prepared.kind !== "image")) {
        toast.error(ar ? "الملف يجب أن يكون صورة WebP/JPG/PNG وبحجم مقبول" : "Use a WebP/JPG/PNG image");
        return;
      }
      const path = campaignAssetPath(prepared.kind);
      await uploadCampaignAsset(path, prepared.blob);
      const id = `custom-${crypto.randomUUID().slice(0, 8)}`;
      setSettings((prev) => ({
        ...prev,
        custom: [...prev.custom, { id, path, label: file.name.replace(/\.[^.]+$/, ""), tone: "dark" }],
        enabled: [...prev.enabled, id],
      }));
      toast.success(ar ? "أُضيفت الخلفية — لا تنسَ الحفظ" : "Backdrop added — remember to save");
    } catch {
      toast.error(ar ? "تعذّر الرفع" : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <Images className="size-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <h2 className="text-section truncate font-black">
                {ar ? "مكتبة خلفيات كَحيل" : "Kaheel backdrop library"}
              </h2>
              <p className="text-desc text-muted-foreground">
                {ar
                  ? `${BACKDROP_LIBRARY.length} خلفية جاهزة — تُحمَّل خلفية اليوم وحدها في الزيارة.`
                  : `${BACKDROP_LIBRARY.length} ready backdrops — only today's file is downloaded.`}
              </p>
            </div>
          </div>
          <Button onClick={save} disabled={busy} size="sm">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {ar ? "حفظ" : "Save"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {MODES.map((mode) => (
            <Button
              key={mode}
              type="button"
              size="sm"
              variant={settings.mode === mode ? "default" : "outline"}
              onClick={() => setSettings((prev) => ({ ...prev, mode }))}
            >
              {MODE_LABEL[mode][ar ? 0 : 1]}
            </Button>
          ))}
          <span className="text-desc font-bold text-muted-foreground">
            {ar ? "خلفية اليوم:" : "Today:"} {today?.label ?? (ar ? "لا شيء" : "none")}
          </span>
        </div>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {BACKDROP_LIBRARY.map((item) => {
            const enabled = settings.enabled.includes(item.id);
            const held = settings.holdback.includes(item.id);
            const win = settings.windows[item.id];
            return (
              <li key={item.id} className="space-y-2 rounded-[var(--r-card)] border border-border p-2">
                <button
                  type="button"
                  onClick={() => setPreview(item.url)}
                  className="block w-full overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label={ar ? `معاينة ${item.label[0]}` : `Preview ${item.label[1]}`}
                >
                  <img
                    src={item.url}
                    alt={item.label[ar ? 0 : 1]}
                    width={BACKDROP_WIDTH}
                    height={BACKDROP_HEIGHT}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[16/9] w-full object-cover"
                  />
                </button>
                <p className="truncate text-desc font-black">{item.label[ar ? 0 : 1]}</p>
                <p className="text-desc font-bold text-muted-foreground">
                  {SEASON_LABEL[item.season][ar ? 0 : 1]} · {Math.round(item.bytes / 1024)} KB
                  {today?.id === item.id ? (ar ? " · اليوم" : " · today") : ""}
                </p>
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={enabled ? "default" : "outline"}
                    className="h-7 px-2 text-desc"
                    onClick={() => toggle("enabled", item.id)}
                  >
                    {enabled ? (ar ? "مفعّلة" : "On") : ar ? "موقوفة" : "Off"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={held ? "secondary" : "outline"}
                    className="h-7 px-2 text-desc"
                    onClick={() => toggle("holdback", item.id)}
                  >
                    {ar ? "لموسمها" : "Season only"}
                  </Button>
                  {settings.mode === "fixed" && (
                    <Button
                      type="button"
                      size="sm"
                      variant={settings.fixedId === item.id ? "default" : "outline"}
                      className="h-7 px-2 text-desc"
                      onClick={() => setSettings((prev) => ({ ...prev, fixedId: item.id }))}
                    >
                      {ar ? "ثابتة" : "Fixed"}
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <Input
                    type="date"
                    aria-label={ar ? "من تاريخ" : "From"}
                    value={win?.from ?? ""}
                    onChange={(event) => setWindow(item.id, "from", event.target.value)}
                    className="h-7 px-1 text-desc"
                  />
                  <Input
                    type="date"
                    aria-label={ar ? "إلى تاريخ" : "To"}
                    value={win?.to ?? ""}
                    onChange={(event) => setWindow(item.id, "to", event.target.value)}
                    className="h-7 px-1 text-desc"
                  />
                </div>
              </li>
            );
          })}
        </ul>

        {settings.custom.length > 0 && (
          <ul className="space-y-1">
            {settings.custom.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-desc font-bold"
              >
                <span className="min-w-0 truncate">{item.label}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-desc"
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      custom: prev.custom.filter((entry) => entry.id !== item.id),
                      enabled: prev.enabled.filter((entry) => entry !== item.id),
                    }))
                  }
                >
                  {ar ? "حذف" : "Remove"}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Label
            htmlFor="backdrop-upload"
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-desc font-black"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
            {ar ? "رفع خلفية مخصصة" : "Upload custom backdrop"}
          </Label>
          <input
            id="backdrop-upload"
            type="file"
            accept="image/webp,image/jpeg,image/png"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
          <p className="inline-flex items-center gap-1 text-desc text-muted-foreground">
            <CalendarClock className="size-3.5" aria-hidden />
            {ar
              ? `إجمالي المكتبة ${Math.round(totalBytes / 1024)} KB — والزيارة تحمّل خلفية واحدة فقط.`
              : `Library total ${Math.round(totalBytes / 1024)} KB — one file per visit.`}
          </p>
        </div>

        {preview && (
          <div className="space-y-2">
            <img
              src={preview}
              alt={ar ? "معاينة الخلفية" : "Backdrop preview"}
              width={BACKDROP_WIDTH}
              height={BACKDROP_HEIGHT}
              className="aspect-[16/9] w-full rounded-[var(--r-card)] object-cover"
            />
            <Button type="button" size="sm" variant="outline" onClick={() => setPreview(null)}>
              {ar ? "إغلاق المعاينة" : "Close preview"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

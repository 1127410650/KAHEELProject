/**
 * «توليد صورة» — campaign asset studio inside the admin campaigns page.
 *
 * The browser only ever holds a prompt and the returned bytes: the model call,
 * the admin check and the daily quota all live behind `generateCampaignImage`.
 * Candidates stay in memory until one is approved; approval is the only step
 * that writes to storage.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { formatDateTime, formatNumber } from "@/lib/format";
import { generateCampaignImage } from "@/lib/mkt-ai-image.functions";
import {
  AI_PRESETS,
  AI_SIZES,
  approveAiAsset,
  toCampaignWebp,
  useAiImageJobs,
  type AiImageSizeKey,
  type GeneratedAsset,
  type UploadedAiAsset,
} from "@/lib/mkt-ai-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  /** Called once a candidate is uploaded, so the form can attach it. */
  onApproved: (asset: UploadedAiAsset) => void;
}

export function AiImageStudio({ onApproved }: Props) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const generate = useServerFn(generateCampaignImage);
  const jobs = useAiImageJobs(true);

  const [prompt, setPrompt] = useState("");
  const [sizeKey, setSizeKey] = useState<AiImageSizeKey>("banner");
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState<{ remaining: number; limit: number } | null>(null);
  const [candidates, setCandidates] = useState<GeneratedAsset[]>([]);
  const [approving, setApproving] = useState(false);

  function reasonText(reason?: string): string {
    if (reason === "daily_limit_reached")
      return ar ? "بلغت الحد اليومي للتوليد" : "Daily generation limit reached";
    if (reason === "not_authorized")
      return ar ? "هذه الأداة لمدير المنصة فقط" : "Platform admins only";
    if (reason === "invalid_prompt") return ar ? "الوصف قصير جدًا" : "Prompt is too short";
    return ar ? "تعذّر التوليد، جرّب مرة أخرى" : "Generation failed, try again";
  }

  async function run() {
    const text = prompt.trim();
    if (text.length < 4) {
      toast.error(ar ? "اكتب وصفًا أوضح" : "Write a clearer prompt");
      return;
    }
    setBusy(true);
    try {
      for (let index = 0; index < count; index += 1) {
        const result = await generate({ data: { prompt: text, sizeKey } });
        if (!result.ok || !result.b64) {
          toast.error(reasonText(result.reason));
          break;
        }
        if (typeof result.remaining === "number" && typeof result.dailyLimit === "number") {
          setQuota({ remaining: result.remaining, limit: result.dailyLimit });
        }
        const asset = await toCampaignWebp(result.b64, result.mime ?? "image/png");
        asset.jobId = result.jobId;
        setCandidates((previous) => [...previous, asset]);
      }
      void jobs.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error && error.message === "TOO_LARGE"
          ? ar
            ? "الصورة أكبر من الحد المسموح (1MB)"
            : "Image exceeds the 1 MB limit"
          : ar
            ? "تعذّر تجهيز الصورة"
            : "Could not prepare the image",
      );
    } finally {
      setBusy(false);
    }
  }

  async function approve(asset: GeneratedAsset) {
    setApproving(true);
    try {
      const uploaded = await approveAiAsset(asset);
      onApproved(uploaded);
      toast.success(ar ? "اعتُمدت الصورة ورُفعت" : "Image approved and uploaded");
      setCandidates((previous) => previous.filter((item) => item !== asset));
      void jobs.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ERROR");
    } finally {
      setApproving(false);
    }
  }

  const rows = jobs.data ?? [];

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid size-9 place-items-center rounded-[var(--r-card)] bg-primary/10 text-primary">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <p className="text-sm font-bold">{ar ? "توليد صورة" : "Generate an image"}</p>
          {quota ? (
            <Badge variant="secondary">
              {ar
                ? `المتبقي اليوم ${formatNumber(quota.remaining)} من ${formatNumber(quota.limit)}`
                : `${formatNumber(quota.remaining)} of ${formatNumber(quota.limit)} left today`}
            </Badge>
          ) : null}
        </div>

        <div className="space-y-1">
          <Label>{ar ? "قوالب جاهزة" : "Presets"}</Label>
          <div className="flex flex-wrap gap-2">
            {AI_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setPrompt(preset.prompt);
                  setSizeKey(preset.sizeKey);
                }}
              >
                {ar ? preset.ar : preset.en}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="ai-prompt">{ar ? "الوصف" : "Prompt"}</Label>
          <Textarea
            id="ai-prompt"
            rows={3}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={
              ar ? "اكتب وصف الصورة بالعربية أو الإنجليزية" : "Describe the image, Arabic or English"
            }
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>{ar ? "المقاس" : "Size"}</Label>
            <div className="flex flex-wrap gap-2">
              {AI_SIZES.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  size="sm"
                  variant={sizeKey === item.key ? "default" : "outline"}
                  onClick={() => setSizeKey(item.key)}
                >
                  {ar ? item.ar : item.en}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>{ar ? "عدد النسخ" : "Variations"}</Label>
            <div className="flex gap-2">
              {[1, 2, 3].map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={count === value ? "default" : "outline"}
                  onClick={() => setCount(value)}
                >
                  {formatNumber(value)}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <Button type="button" onClick={() => void run()} disabled={busy}>
          {busy ? <Loader2 className="me-2 size-4 animate-spin" aria-hidden /> : null}
          {ar ? "توليد" : "Generate"}
        </Button>

        {candidates.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {candidates.map((asset) => (
              <div key={asset.previewUrl} className="space-y-2 rounded-[var(--r-card)] border p-2">
                <img
                  src={asset.previewUrl}
                  width={asset.width}
                  height={asset.height}
                  alt={ar ? "معاينة الصورة المولّدة" : "Generated image preview"}
                  className="h-auto w-full rounded-xl bg-muted"
                />
                <p className="text-desc text-muted-foreground">
                  {formatNumber(asset.width)}×{formatNumber(asset.height)} ·{" "}
                  {formatNumber(Math.round(asset.blob.size / 1024))} KB
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={approving}
                    onClick={() => void approve(asset)}
                  >
                    <Check className="me-1 size-4" aria-hidden />
                    {ar ? "اعتماد ورفع" : "Approve & upload"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={ar ? "تجاهل" : "Discard"}
                    onClick={() => {
                      URL.revokeObjectURL(asset.previewUrl);
                      setCandidates((previous) => previous.filter((item) => item !== asset));
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="space-y-1 border-t pt-3">
            <p className="text-desc font-bold">{ar ? "سجل التوليد" : "Generation log"}</p>
            {rows.map((row) => (
              <p key={row.id} className="text-desc text-muted-foreground">
                {formatDateTime(row.created_at)} · {row.size_key} · {row.status} ·{" "}
                {formatNumber(Math.round(row.bytes / 1024))} KB ·{" "}
                {ar ? "تكلفة تقديرية" : "est. cost"} {formatNumber(Number(row.cost_credits))} ·{" "}
                {row.prompt.slice(0, 60)}
              </p>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

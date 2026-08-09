/**
 * Campaign manager — the animated ads that run on the home banner rail and in
 * the welcome takeover.
 *
 * Uploads are validated by their real magic bytes and per-kind size ceilings
 * (Lottie ≤ 300 KB, WebP/photo ≤ 1 MB, MP4 ≤ 2 MB) before a single byte reaches
 * storage, and every row is written under RLS that only a platform admin
 * satisfies — hiding this page would not be a control on its own.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Clapperboard, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { formatDateTime, formatNumber } from "@/lib/format";
import {
  CAMPAIGN_ACCEPT,
  CAMPAIGN_LIMITS,
  campaignAssetPath,
  prepareCampaignAsset,
  uploadCampaignAsset,
  useAdminCampaigns,
  useDeleteCampaign,
  useSaveCampaign,
  type CampaignAssetKind,
  type CampaignPlacement,
  type CampaignStatus,
} from "@/lib/mkt-campaigns";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/campaigns")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "الحملات المتحركة — لوحة مدير النظام" },
      {
        name: "description",
        content: "إدارة البانرات المتحركة ونافذة الترحيب مع مرات الظهور والنقر.",
      },
      { property: "og:title", content: "الحملات المتحركة — لوحة مدير النظام" },
      { property: "og:description", content: "إنشاء وإيقاف الحملات الإعلانية المتحركة." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminCampaignsPage,
});

const PLACEMENTS: CampaignPlacement[] = ["home_banner", "home_strip", "welcome_takeover"];
const STATUSES: CampaignStatus[] = ["draft", "active", "paused", "ended"];

function AdminCampaignsPage() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const list = useAdminCampaigns(true);
  const save = useSaveCampaign();
  const remove = useDeleteCampaign();

  const [placement, setPlacement] = useState<CampaignPlacement>("home_banner");
  const [slug, setSlug] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [subtitleAr, setSubtitleAr] = useState("");
  const [subtitleEn, setSubtitleEn] = useState("");
  const [badgeAr, setBadgeAr] = useState("");
  const [badgeEn, setBadgeEn] = useState("");
  const [ctaAr, setCtaAr] = useState("");
  const [ctaEn, setCtaEn] = useState("");
  const [clickUrl, setClickUrl] = useState("/search");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = list.data ?? [];
  const totals = useMemo(
    () => ({
      impressions: rows.reduce((sum, row) => sum + Number(row.impressions), 0),
      clicks: rows.reduce((sum, row) => sum + Number(row.clicks), 0),
    }),
    [rows],
  );

  const limitLabel = (kind: CampaignAssetKind) =>
    `${formatNumber(Math.round(CAMPAIGN_LIMITS[kind] / 1024))} KB`;

  async function submit() {
    if (!file) {
      toast.error(ar ? "اختر ملف الحملة أولًا" : "Pick a campaign file first");
      return;
    }
    if (!slug.trim()) {
      toast.error(ar ? "أدخل معرّف الحملة" : "Enter a campaign slug");
      return;
    }
    setBusy(true);
    try {
      const prepared = await prepareCampaignAsset(file);
      if (prepared.error === "type") {
        toast.error(ar ? "نوع الملف غير مدعوم" : "Unsupported file type");
        return;
      }
      if (prepared.error === "tooLarge") {
        toast.error(
          ar
            ? `الملف أكبر من الحد المسموح (${limitLabel(prepared.kind)})`
            : `File exceeds the limit (${limitLabel(prepared.kind)})`,
        );
        return;
      }
      if (prepared.error === "corrupt") {
        toast.error(ar ? "تعذّر قراءة الملف" : "Could not read the file");
        return;
      }

      const path = campaignAssetPath(prepared.kind);
      await uploadCampaignAsset(path, prepared.blob);
      await save.mutateAsync({
        values: {
          slug: slug.trim(),
          placement,
          asset_kind: prepared.kind,
          asset_path: path,
          asset_width: prepared.width,
          asset_height: prepared.height,
          title_ar: titleAr,
          title_en: titleEn,
          subtitle_ar: subtitleAr,
          subtitle_en: subtitleEn,
          badge_ar: badgeAr,
          badge_en: badgeEn,
          cta_ar: ctaAr,
          cta_en: ctaEn,
          click_url: clickUrl || "/search",
          status: "draft",
        },
      });
      toast.success(ar ? "أُنشئت الحملة كمسودة" : "Campaign created as a draft");
      setSlug("");
      setFile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ERROR");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title={ar ? "الحملات المتحركة" : "Animated campaigns"}>
      <div className="space-y-6">
        <header className="flex flex-wrap items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Clapperboard className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-lg font-black">
              {ar ? "الحملات المتحركة" : "Animated campaigns"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {ar
                ? `${formatNumber(totals.impressions)} ظهور · ${formatNumber(totals.clicks)} نقرة`
                : `${formatNumber(totals.impressions)} impressions · ${formatNumber(totals.clicks)} clicks`}
            </p>
          </div>
        </header>

        <Card>
          <CardContent className="space-y-4 p-4">
            <p className="text-sm font-bold">{ar ? "حملة جديدة" : "New campaign"}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>{ar ? "المعرّف" : "Slug"}</Label>
                <Input value={slug} onChange={(event) => setSlug(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{ar ? "الموضع" : "Placement"}</Label>
                <div className="flex gap-2">
                  {PLACEMENTS.map((item) => (
                    <Button
                      key={item}
                      type="button"
                      size="sm"
                      variant={placement === item ? "default" : "outline"}
                      onClick={() => setPlacement(item)}
                    >
                      {item === "home_banner"
                        ? ar
                          ? "بانر الرئيسية"
                          : "Home banner"
                        : item === "home_strip"
                          ? ar
                            ? "شريط الرئيسية"
                            : "Home strip"
                          : ar
                            ? "نافذة ترحيب"
                            : "Welcome takeover"}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label>{ar ? "العنوان (عربي)" : "Title (Arabic)"}</Label>
                <Input value={titleAr} onChange={(event) => setTitleAr(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{ar ? "العنوان (إنجليزي)" : "Title (English)"}</Label>
                <Input value={titleEn} onChange={(event) => setTitleEn(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{ar ? "الوصف (عربي)" : "Subtitle (Arabic)"}</Label>
                <Input value={subtitleAr} onChange={(event) => setSubtitleAr(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{ar ? "الوصف (إنجليزي)" : "Subtitle (English)"}</Label>
                <Input value={subtitleEn} onChange={(event) => setSubtitleEn(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{ar ? "الشارة (عربي)" : "Badge (Arabic)"}</Label>
                <Input value={badgeAr} onChange={(event) => setBadgeAr(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{ar ? "الشارة (إنجليزي)" : "Badge (English)"}</Label>
                <Input value={badgeEn} onChange={(event) => setBadgeEn(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{ar ? "نص الزر (عربي)" : "CTA (Arabic)"}</Label>
                <Input value={ctaAr} onChange={(event) => setCtaAr(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{ar ? "نص الزر (إنجليزي)" : "CTA (English)"}</Label>
                <Input value={ctaEn} onChange={(event) => setCtaEn(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{ar ? "رابط النقر" : "Click URL"}</Label>
                <Input value={clickUrl} onChange={(event) => setClickUrl(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{ar ? "الملف" : "Asset"}</Label>
                <Input
                  type="file"
                  accept={CAMPAIGN_ACCEPT}
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
                <p className="text-[11px] text-muted-foreground">
                  {ar
                    ? "Lottie ≤ 300KB · WebP ≤ 1MB · MP4 ≤ 2MB"
                    : "Lottie ≤ 300KB · WebP ≤ 1MB · MP4 ≤ 2MB"}
                </p>
              </div>
            </div>
            <Button type="button" onClick={() => void submit()} disabled={busy}>
              {busy ? <Loader2 className="me-2 size-4 animate-spin" aria-hidden /> : null}
              {ar ? "إنشاء كمسودة" : "Create as draft"}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {list.isLoading ? (
            <>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {ar ? "لا توجد حملات بعد." : "No campaigns yet."}
            </p>
          ) : (
            rows.map((row) => {
              const ctr =
                Number(row.impressions) > 0
                  ? Math.round((Number(row.clicks) / Number(row.impressions)) * 1000) / 10
                  : 0;
              return (
                <Card key={row.id}>
                  <CardContent className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-40 flex-1">
                      <p className="text-sm font-bold">{ar ? row.title_ar : row.title_en}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {row.slug} · {row.placement} · {row.asset_kind} ·{" "}
                        {formatDateTime(row.created_at)}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatNumber(Number(row.impressions))}{" "}
                        {ar ? "ظهور" : "impressions"} · {formatNumber(Number(row.clicks))}{" "}
                        {ar ? "نقرة" : "clicks"} · CTR {formatNumber(ctr)}%
                      </p>
                    </div>
                    <Badge variant={row.status === "active" ? "default" : "secondary"}>
                      {row.status}
                    </Badge>
                    <div className="flex flex-wrap gap-2">
                      {STATUSES.filter((status) => status !== row.status).map((status) => (
                        <Button
                          key={status}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void save
                              .mutateAsync({ id: row.id, values: { status } })
                              .then(() => toast.success(ar ? "تم التحديث" : "Updated"))
                              .catch((error: unknown) =>
                                toast.error(error instanceof Error ? error.message : "ERROR"),
                              )
                          }
                        >
                          {status}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={ar ? "حذف" : "Delete"}
                        onClick={() =>
                          void remove
                            .mutateAsync(row.id)
                            .then(() => toast.success(ar ? "حُذفت الحملة" : "Campaign deleted"))
                            .catch((error: unknown) =>
                              toast.error(error instanceof Error ? error.message : "ERROR"),
                            )
                        }
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AdminShell>
  );
}

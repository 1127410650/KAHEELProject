import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Eye, Loader2, MapPin, Pencil, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { geoName, loadCities, useAccountCountry } from "@/lib/mkt-geo";
import { useSession } from "@/lib/session";
import { useWorkspaces } from "@/hooks/use-workspace";
import { logAudit } from "@/lib/audit";
import { BUSINESS_COLUMNS, MKT_BUCKET, resolveMedia, type MktBusiness } from "@/lib/mkt";
import { loadCategories } from "@/lib/mkt-queries";
import {
  loadVerificationEvents,
  loadVerificationFiles,
  loadVerificationRequests,
} from "@/lib/mkt-admin";
import {
  loadEntityActivities,
  setEntityActivities,
} from "@/lib/mkt-activities";
import { ActivityPicker, type ActivityValue } from "@/components/marketplace/ActivityPicker";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { VerifiedBadge } from "@/components/marketplace/ListingCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/dashboard/business")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ملف المنشأة — سوق تحقّق" },
      {
        name: "description",
        content:
          "عدّل شعار منشأتك ونبذتها ومدينتها وبيانات التواصل والتصنيفات، وتابع حالة التوثيق.",
      },
      { property: "og:title", content: "ملف المنشأة — سوق تحقّق" },
      {
        property: "og:description",
        content: "إدارة ملف المنشأة العام وطلبات التوثيق في سوق تحقّق.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BusinessDashboardPage,
});

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function BusinessDashboardPage() {
  const { t, locale } = useI18n();
  const { session } = useSession();
  const workspaces = useWorkspaces();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [draft, setDraft] = useState<Partial<MktBusiness> | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const current = (workspaces.data ?? []).find((w) => w.is_current);
  const tenantId = current?.tenant_id;
  const canEdit = !!current && current.role !== "viewer";

  const profile = useQuery({
    queryKey: ["mkt", "my-business", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("mkt_business_profiles")
        .select(BUSINESS_COLUMNS)
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      return (data as MktBusiness | null) ?? null;
    },
  });

  const categories = useQuery({ queryKey: ["mkt", "categories"], queryFn: loadCategories });

  // Reference activities of this entity. Nothing is matched or changed
  // automatically: the picker starts from what is already linked, and staff
  // review is the only path for an activity that is not in the tree yet.
  const entityActivities = useQuery({
    queryKey: ["mkt", "entity-activities", tenantId],
    enabled: !!tenantId,
    queryFn: () => loadEntityActivities(tenantId!),
  });
  const [activityDraft, setActivityDraft] = useState<ActivityValue | null>(null);
  const linkedActivity = useMemo<ActivityValue>(() => {
    const rows = entityActivities.data ?? [];
    const main = rows.find((r) => r.is_primary) ?? null;
    return {
      main: main
        ? {
            id: main.activity_id,
            name_ar: main.name_ar,
            name_en: main.name_en,
            group_id: main.group_id,
          }
        : null,
      subs: rows
        .filter((r) => !r.is_primary)
        .map((r) => ({
          id: r.activity_id,
          name_ar: r.name_ar,
          name_en: r.name_en,
          group_id: r.group_id,
        })),
    };
  }, [entityActivities.data]);
  const activityValue = activityDraft ?? linkedActivity;
  const roots = (categories.data ?? []).filter((c) => !c.parent_id);

  const requests = useQuery({
    queryKey: ["mkt", "my-verifications", tenantId],
    enabled: !!tenantId,
    queryFn: () => loadVerificationRequests({ tenantId }),
  });
  const events = useQuery({
    queryKey: ["mkt", "my-verification-events", tenantId],
    enabled: !!tenantId,
    queryFn: () => loadVerificationEvents(tenantId!),
  });
  const files = useQuery({
    queryKey: ["mkt", "my-verification-files", (requests.data ?? []).map((r) => r.id).join(",")],
    enabled: (requests.data ?? []).length > 0,
    queryFn: () => loadVerificationFiles((requests.data ?? []).map((r) => r.id)),
  });

  const logo = useQuery({
    queryKey: ["mkt", "my-business-logo", profile.data?.logo_url],
    enabled: !!profile.data?.logo_url,
    queryFn: async () =>
      (await resolveMedia([profile.data!.logo_url]))[profile.data!.logo_url!] ?? null,
  });

  const view = useMemo<Partial<MktBusiness>>(
    () => ({ ...(profile.data ?? {}), ...(draft ?? {}) }),
    [profile.data, draft],
  );

  // The country belongs to the account (Settings → Account → Country); the
  // business profile only picks a city inside it.
  const accountCountry = useAccountCountry();
  const cities = useQuery({
    queryKey: ["mkt", "cities", accountCountry.data?.id],
    enabled: !!accountCountry.data?.id,
    queryFn: () => loadCities(accountCountry.data?.id ?? null),
  });


  function set<K extends keyof MktBusiness>(key: K, value: MktBusiness[K]) {
    setDraft((prev) => ({ ...(prev ?? {}), [key]: value }));
  }

  function toggleCategory(id: string) {
    const list = view.categories ?? [];
    set("categories", list.includes(id) ? list.filter((c) => c !== id) : [...list, id]);
  }

  async function uploadLogo(): Promise<string | null> {
    if (!logoFile || !tenantId) return null;
    const ext = logoFile.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `businesses/${tenantId}/logo-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(MKT_BUCKET).upload(path, logoFile, {
      contentType: logoFile.type || "image/png",
      upsert: false,
    });
    if (error) return null;
    return path;
  }

  async function save() {
    if (!tenantId || !canEdit) return;
    setBusy(true);
    try {
      const logoPath = await uploadLogo();
      const payload = {
        display_name_ar: String(view.display_name_ar ?? "").trim(),
        display_name_en: view.display_name_en ?? null,
        headline: view.headline ?? null,
        about: view.about ?? null,
        country_id: accountCountry.data?.id ?? view.country_id ?? null,
        city_id: view.city_id ?? null,
        city: (cities.data ?? []).find((c) => c.id === view.city_id)?.name_ar ?? null,
        region: view.region ?? null,
        categories: view.categories ?? [],
        ...(activityValue.main ? { main_activity: activityValue.main.name_ar } : {}),
        ...(activityValue.subs.length > 0
          ? { sub_activities: activityValue.subs.map((a) => a.name_ar) }
          : {}),
        public_phone: view.public_phone ?? null,
        public_whatsapp: view.public_whatsapp ?? null,
        public_email: view.public_email ?? null,
        public_website: view.public_website ?? null,
        show_phone: view.show_phone ?? false,
        show_whatsapp: view.show_whatsapp ?? false,
        show_email: view.show_email ?? false,
        is_published: view.is_published ?? false,
        ...(logoPath ? { logo_url: logoPath } : {}),
      };
      if (!payload.display_name_ar) {
        toast.error(t("market.biz.nameRequired"));
        return;
      }

      if (profile.data) {
        const { error } = await supabase
          .from("mkt_business_profiles")
          .update(payload)
          .eq("tenant_id", tenantId);
        if (error) throw error;
        await logAudit({
          entityType: "mkt_business_profile",
          entityId: tenantId,
          action: "update",
          oldValue: profile.data,
          newValue: payload,
        });
      } else {
        const slug = `biz-${tenantId.slice(0, 8)}`;
        const { error } = await supabase
          .from("mkt_business_profiles")
          .insert({ tenant_id: tenantId, slug, ...payload });
        if (error) throw error;
        await logAudit({
          entityType: "mkt_business_profile",
          entityId: tenantId,
          action: "create",
          newValue: payload,
        });
      }
      // The activity link goes through the guarded RPC, not a direct update.
      if (activityDraft?.main) {
        await setEntityActivities({
          tenantId,
          mainActivityId: activityDraft.main.id,
          subActivityIds: activityDraft.subs.map((a) => a.id),
        });
        setActivityDraft(null);
        await entityActivities.refetch();
      }

      setDraft(null);
      setLogoFile(null);
      toast.success(t("market.biz.saved"));
      await profile.refetch();
    } catch {
      toast.error(t("market.actions.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function submitVerification(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantId || !session) return;
    const form = event.currentTarget;
    const fd = new FormData(form);
    const note = String(fd.get("note") ?? "").trim();
    const docs = (fd.getAll("docs") as File[]).filter((f) => f.size > 0);
    if (docs.length === 0) {
      toast.error(t("market.biz.docsRequired"));
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("mkt_verification_requests")
        .insert({ tenant_id: tenantId, note: note || null, submitted_by: session.user.id })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("insert failed");

      for (const file of docs) {
        const path = `verification/${tenantId}/${data.id}/${crypto.randomUUID()}-${file.name}`;
        const up = await supabase.storage.from(MKT_BUCKET).upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (up.error) continue;
        await supabase.from("mkt_verification_files").insert({
          request_id: data.id,
          tenant_id: tenantId,
          file_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          uploaded_by: session.user.id,
        });
      }
      await logAudit({
        entityType: "mkt_business_verification",
        entityId: data.id,
        action: "create",
        newValue: { tenant_id: tenantId, files: docs.length },
      });
      form.reset();
      toast.success(t("market.biz.verificationSent"));
      await Promise.all([requests.refetch(), events.refetch(), profile.refetch()]);
    } catch {
      toast.error(t("market.actions.failed"));
    } finally {
      setBusy(false);
    }
  }

  if (workspaces.isLoading || profile.isLoading) {
    return (
      <DashboardShell title={t("market.dash.business")}>
        <Skeleton className="h-64 w-full rounded-xl" />
      </DashboardShell>
    );
  }

  if (!tenantId) {
    return (
      <DashboardShell title={t("market.dash.business")}>
        <p className="text-sm text-muted-foreground">{t("market.biz.noWorkspace")}</p>
      </DashboardShell>
    );
  }

  if (!canEdit) {
    return (
      <DashboardShell title={t("market.dash.business")}>
        <p className="text-sm text-muted-foreground">{t("market.biz.noPermission")}</p>
      </DashboardShell>
    );
  }

  const label = (o: { name_ar: string; name_en: string | null }) =>
    locale === "ar" ? o.name_ar : o.name_en || o.name_ar;
  const pending = (requests.data ?? []).some((r) => r.status === "pending");

  return (
    <DashboardShell title={t("market.dash.business")}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={preview ? "outline" : "secondary"}
          onClick={() => setPreview(false)}
        >
          <Pencil className="size-3.5" aria-hidden />
          {t("market.biz.editTab")}
        </Button>
        <Button
          size="sm"
          variant={preview ? "secondary" : "outline"}
          onClick={() => setPreview(true)}
        >
          <Eye className="size-3.5" aria-hidden />
          {t("market.biz.previewTab")}
        </Button>
        {profile.data?.slug && profile.data.is_published && (
          <Button asChild size="sm" variant="ghost">
            <Link to="/businesses/$slug" params={{ slug: profile.data.slug }}>
              {t("market.biz.openPublic")}
            </Link>
          </Button>
        )}
      </div>

      {preview ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <p className="mb-3 text-xs text-muted-foreground">{t("market.biz.previewNote")}</p>
          <div className="flex items-start gap-3">
            {logo.data && (
              <img
                src={logo.data}
                alt={String(view.display_name_ar ?? "")}
                className="size-14 rounded-lg object-cover"
                loading="lazy"
              />
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-foreground">
                {locale === "ar"
                  ? view.display_name_ar
                  : view.display_name_en || view.display_name_ar}
              </h2>
              {view.headline && <p className="text-sm text-muted-foreground">{view.headline}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <VerifiedBadge status={view.verification_status ?? "unverified"} />
                {view.city && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden />
                    {view.city}
                  </span>
                )}
              </div>
            </div>
          </div>
          {view.about && (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {view.about}
            </p>
          )}
          {(view.categories ?? []).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(view.categories ?? []).map((id) => {
                const cat = roots.find((c) => c.id === id);
                return cat ? (
                  <span
                    key={id}
                    className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
                  >
                    {label(cat)}
                  </span>
                ) : null;
              })}
            </div>
          )}
          <div className="mt-4 space-y-1 text-sm text-foreground" dir="ltr">
            {view.show_phone && view.public_phone && <p>{view.public_phone}</p>}
            {view.show_whatsapp && view.public_whatsapp && <p>{view.public_whatsapp}</p>}
            {view.show_email && view.public_email && <p>{view.public_email}</p>}
            {view.public_website && <p className="text-primary">{view.public_website}</p>}
          </div>
        </section>
      ) : (
        <section className="max-w-2xl space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name_ar">{t("market.biz.nameAr")}</Label>
              <Input
                id="name_ar"
                value={view.display_name_ar ?? ""}
                onChange={(e) => set("display_name_ar", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name_en">{t("market.biz.nameEn")}</Label>
              <Input
                id="name_en"
                value={view.display_name_en ?? ""}
                onChange={(e) => set("display_name_en", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="headline">{t("market.biz.headline")}</Label>
            <Input
              id="headline"
              value={view.headline ?? ""}
              onChange={(e) => set("headline", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="about">{t("market.biz.about")}</Label>
            <Textarea
              id="about"
              rows={5}
              value={view.about ?? ""}
              onChange={(e) => set("about", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="logo">{t("market.biz.logo")}</Label>
            <input
              id="logo"
              type="file"
              accept="image/*"
              className="block w-full text-xs"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-foreground">
                {t("market.geo.country")}
              </span>
              <p className="flex h-9 items-center text-sm text-muted-foreground">
                {accountCountry.data ? geoName(accountCountry.data, locale) : "—"}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city_id">{t("market.filters.city")}</Label>
              <select
                id="city_id"
                className={selectClass}
                value={view.city_id ?? ""}
                onChange={(e) => set("city_id", e.target.value)}
                disabled={!accountCountry.data}
              >
                <option value="">{t("market.geo.allCities")}</option>
                {(cities.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {geoName(c, locale)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="region">{t("market.dash.region")}</Label>
              <Input
                id="region"
                value={view.region ?? ""}
                onChange={(e) => set("region", e.target.value)}
              />
            </div>
          </div>

          <div className="min-w-0 space-y-1.5">
            <Label>{t("market.activity.current")}</Label>
            <ActivityPicker
              value={activityValue}
              tenantId={tenantId}
              onChange={setActivityDraft}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("market.business.services")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {roots.map((c) => {
                const on = (view.categories ?? []).includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCategory(c.id)}
                    className={
                      on
                        ? "rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                        : "rounded-full border border-border px-2.5 py-1 text-xs text-foreground hover:bg-accent"
                    }
                  >
                    {label(c)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["public_phone", "market.biz.phone", "show_phone"],
                ["public_whatsapp", "market.biz.whatsapp", "show_whatsapp"],
                ["public_email", "market.biz.email", "show_email"],
              ] as const
            ).map(([field, key, flag]) => (
              <div key={field} className="space-y-1.5">
                <Label htmlFor={field}>{t(key)}</Label>
                <Input
                  id={field}
                  dir="ltr"
                  value={(view[field] as string | null) ?? ""}
                  onChange={(e) => set(field, e.target.value)}
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    className="size-3.5"
                    checked={!!view[flag]}
                    onChange={(e) => set(flag, e.target.checked)}
                  />
                  {t("market.biz.showPublicly")}
                </label>
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="public_website">{t("market.biz.website")}</Label>
              <Input
                id="public_website"
                dir="ltr"
                value={view.public_website ?? ""}
                onChange={(e) => set("public_website", e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="size-4"
              checked={!!view.is_published}
              onChange={(e) => set("is_published", e.target.checked)}
            />
            {t("market.biz.publishProfile")}
          </label>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button size="sm" disabled={busy} onClick={() => void save()}>
              {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {t("common.save")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPreview(true)}>
              {t("market.biz.previewBeforeSave")}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t("market.biz.verificationLocked")}
            </span>
          </div>
        </section>
      )}

      <section className="mt-6 max-w-2xl rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <ShieldCheck className="size-4" aria-hidden />
          {t("market.biz.verification")}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <VerifiedBadge status={profile.data?.verification_status ?? "unverified"} />
          {profile.data?.verification_note && <span>{profile.data.verification_note}</span>}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("market.biz.verificationHint")}</p>

        {!pending && (
          <form className="mt-4 space-y-3" onSubmit={(e) => void submitVerification(e)}>
            <div className="space-y-1.5">
              <Label htmlFor="note">{t("market.biz.verificationNote")}</Label>
              <Textarea id="note" name="note" rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="docs">{t("market.biz.verificationDocs")}</Label>
              <input
                id="docs"
                name="docs"
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="block w-full text-xs"
              />
            </div>
            <Button type="submit" size="sm" disabled={busy}>
              <Upload className="size-3.5" aria-hidden />
              {t("market.biz.submitVerification")}
            </Button>
          </form>
        )}

        <h3 className="mt-5 text-xs font-bold text-foreground">{t("market.biz.timeline")}</h3>
        <ol className="mt-2 space-y-2">
          {(events.data ?? []).map((ev) => (
            <li key={ev.id} className="rounded-lg border border-border p-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">
                  {t(`market.biz.status.${ev.to_status}`)}
                </span>
                <span className="text-muted-foreground" dir="ltr">
                  {new Date(ev.created_at).toLocaleString("en-GB", {
                    timeZone: "Asia/Riyadh",
                    hour12: false,
                  })}
                </span>
              </div>
              {ev.reason && <p className="mt-1 text-muted-foreground">{ev.reason}</p>}
            </li>
          ))}
        </ol>
        {(events.data ?? []).length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">{t("market.biz.noTimeline")}</p>
        )}

        {(files.data ?? []).length > 0 && (
          <>
            <h3 className="mt-5 text-xs font-bold text-foreground">
              {t("market.biz.uploadedDocs")}
            </h3>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {(files.data ?? []).map((f) => (
                <li key={f.id}>{f.file_name}</li>
              ))}
            </ul>
          </>
        )}
      </section>
    </DashboardShell>
  );
}

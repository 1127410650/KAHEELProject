import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { MKT_BUCKET, resolveMedia } from "@/lib/mkt";
import {
  geoName,
  loadCities,
  loadCountries,
  loadMyContact,
  nationalPart,
  saveMyContact,
  toE164,
  useMarketPreference,
  type PhoneVisibility,
} from "@/lib/mkt-geo";
import {
  AVATAR_MAX_BYTES,
  isUsernameTaken,
  isValidEmail,
  looksLikePhone,
  sniffImageType,
} from "@/lib/mkt-username";
import { PhoneField, PhoneVisibilityField } from "@/components/marketplace/PhoneFields";
import { useMyUserProfile } from "@/lib/mkt-identity";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { VerifiedBadge } from "@/components/marketplace/ListingCard";
import { CallSettingsToggle } from "@/components/marketplace/CallSettingsToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/dashboard/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "حسابي الشخصي — كَحيل" },
      {
        name: "description",
        content: "حرّر ملفك العام كمعلن فرد في كَحيل: الاسم، النبذة، المدينة، وبيانات التواصل.",
      },
      { property: "og:title", content: "حسابي الشخصي — كَحيل" },
      { property: "og:description", content: "ملفك العام كمعلن فرد في كَحيل." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

const selectClass =
  "h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground disabled:opacity-50";

type Errors = Partial<
  Record<"display_name" | "city_id" | "phone" | "public_email" | "public_whatsapp", string>
>;

/** One editable draft of the personal profile; the business profile is never touched here. */
interface Draft {
  display_name: string;
  headline: string;
  about: string;
  country_id: string;
  city_id: string;
  region: string;
  public_email: string;
  public_whatsapp: string;
  show_email: boolean;
  show_whatsapp: boolean;
  is_published: boolean;
  personalize_suggestions: boolean;
}

const EMPTY: Draft = {
  display_name: "",
  headline: "",
  about: "",
  country_id: "",
  city_id: "",
  region: "",
  public_email: "",
  public_whatsapp: "",
  show_email: false,
  show_whatsapp: false,
  is_published: true,
  personalize_suggestions: true,
};

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-5 first:border-t-0 first:pt-0">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return <p className="text-[11px] font-medium text-destructive">{message}</p>;
}

function ProfilePage() {
  const { t, locale } = useI18n();
  const { session } = useSession();
  const me = useMyUserProfile();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Avatar: either the stored path, a newly picked file, or an explicit removal.
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarCleared, setAvatarCleared] = useState(false);

  const row = me.data;
  const countries = useQuery({ queryKey: ["mkt", "countries"], queryFn: loadCountries });
  const { preference } = useMarketPreference();
  const cities = useQuery({
    queryKey: ["mkt", "cities", draft.country_id],
    enabled: !!draft.country_id,
    queryFn: () => loadCities(draft.country_id),
  });
  const contact = useQuery({
    queryKey: ["mkt", "my-contact", session?.user.id],
    enabled: !!session,
    queryFn: () => loadMyContact(session!.user.id),
  });
  const storedAvatar = useQuery({
    queryKey: ["mkt", "my-avatar", row?.avatar_url],
    enabled: !!row?.avatar_url,
    queryFn: async () => (await resolveMedia([row!.avatar_url!]))[row!.avatar_url!] ?? null,
  });

  const [phone, setPhone] = useState("");
  const [visibility, setVisibility] = useState<PhoneVisibility>("hidden");

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  // Hydrate the draft once, so a failed save never loses what was typed.
  useEffect(() => {
    if (loaded || me.isLoading) return;
    const fallbackCountry = (countries.data ?? []).find((c) => c.iso2 === preference.countryIso2);
    if (!countries.data) return;
    setDraft({
      display_name: looksLikePhone(row?.display_name ?? "") ? "" : (row?.display_name ?? ""),
      headline: row?.headline ?? "",
      about: row?.about ?? "",
      country_id: row?.country_id ?? fallbackCountry?.id ?? "",
      city_id: row?.city_id ?? "",
      region: row?.region ?? "",
      public_email: row?.public_email ?? "",
      public_whatsapp: row?.public_whatsapp ?? "",
      show_email: row?.show_email ?? false,
      show_whatsapp: row?.show_whatsapp ?? false,
      is_published: row?.is_published ?? true,
      personalize_suggestions: row?.personalize_suggestions ?? true,
    });

    setLoaded(true);
  }, [loaded, me.isLoading, row, countries.data, preference.countryIso2]);

  useEffect(() => {
    const c = contact.data;
    if (!c) return;
    setPhone((prev) => prev || nationalPart(c.phone_e164));
    if (c.phone_visibility) setVisibility(c.phone_visibility);
  }, [contact.data]);

  // Warn before losing unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    if (!avatarFile) return;
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const iso2 = useMemo(
    () => (countries.data ?? []).find((c) => c.id === draft.country_id)?.iso2 ?? "",
    [countries.data, draft.country_id],
  );
  const shownAvatar = avatarCleared ? null : (avatarPreview ?? storedAvatar.data ?? null);

  function onCountryChange(next: string) {
    if (!next || next === draft.country_id) {
      set("country_id", next);
      return;
    }
    if (draft.country_id && !window.confirm(t("market.person.countryChangeConfirm"))) return;
    setDraft((prev) => ({ ...prev, country_id: next, city_id: "" }));
    setPhone("");
    setErrors({});
    setDirty(true);
  }

  async function onPickAvatar(file: File | null) {
    setErrors((prev) => ({ ...prev }));
    if (!file) return;
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error(t("market.person.avatarTooLarge"));
      return;
    }
    const sniffed = await sniffImageType(file);
    if (!sniffed) {
      toast.error(t("market.person.avatarInvalid"));
      return;
    }
    setAvatarFile(file);
    setAvatarCleared(false);
    setDirty(true);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || busy) return;

    const next: Errors = {};
    const displayName = draft.display_name.trim();
    if (!displayName) next.display_name = t("market.person.nameRequired");
    else if (looksLikePhone(displayName)) next.display_name = t("market.person.nameIsPhone");

    if (draft.public_email.trim() && !isValidEmail(draft.public_email))
      next.public_email = t("market.person.emailInvalid");

    const whatsapp = draft.public_whatsapp.trim();
    if (whatsapp && !toE164(iso2, whatsapp)) next.public_whatsapp = t("market.person.whatsappInvalid");

    // The city must belong to the account country; the database enforces it too.
    if (draft.city_id && !(cities.data ?? []).some((c) => c.id === draft.city_id))
      next.city_id = t("market.person.cityRequired");

    const e164 = toE164(iso2, phone);
    if (!e164) next.phone = t("market.phone.invalid");
    const username = e164?.replace(/\D/g, "") ?? "";

    if (!next.phone && (await isUsernameTaken(username, session.user.id))) {
      next.phone = t("market.person.usernameTaken");
    }

    setErrors(next);
    if (Object.keys(next).length > 0 || !e164) return;

    setBusy(true);
    try {
      let avatarPath = avatarCleared ? null : (row?.avatar_url ?? null);
      if (avatarFile) {
        const sniffed = (await sniffImageType(avatarFile)) ?? "image/jpeg";
        const ext = sniffed === "image/png" ? "png" : sniffed === "image/webp" ? "webp" : "jpg";
        const path = `avatars/${session.user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from(MKT_BUCKET)
          .upload(path, avatarFile, { contentType: sniffed });
        if (error) throw error;
        avatarPath = path;
      }

      const cityName = (cities.data ?? []).find((c) => c.id === draft.city_id);
      const { error } = await supabase.from("mkt_user_profiles").upsert(
        {
          user_id: session.user.id,
          username,
          display_name: displayName,
          headline: draft.headline.trim() || null,
          about: draft.about.trim() || null,
          country_id: draft.country_id || null,
          city_id: draft.city_id || null,
          city: cityName ? cityName.name_ar : null,
          region: draft.region.trim() || null,
          avatar_url: avatarPath,
          public_email: draft.public_email.trim() || null,
          public_whatsapp: whatsapp ? toE164(iso2, whatsapp) : null,
          show_email: draft.show_email,
          show_whatsapp: draft.show_whatsapp,
          is_published: draft.is_published,
          personalize_suggestions: draft.personalize_suggestions,
        },
        { onConflict: "user_id" },
      );
      if (error) {
        if (error.code === "23505" || /username/i.test(error.message)) {
          setErrors({ phone: t("market.person.usernameTaken") });
          return;
        }
        throw error;
      }

      await saveMyContact({
        userId: session.user.id,
        countryId: draft.country_id || null,
        phoneE164: e164,
        visibility,
      });

      await queryClient.invalidateQueries({ queryKey: ["mkt", "my-contact"] });
      await queryClient.invalidateQueries({ queryKey: ["mkt", "my-user-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["mkt", "account-country"] });
      setAvatarFile(null);
      setAvatarCleared(false);
      setDirty(false);
      toast.success(t("market.person.saved"));
    } catch {
      toast.error(t("market.actions.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell title={t("market.dash.profile")} narrow>
      {me.isLoading || !loaded ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <form className="space-y-6" onSubmit={(e) => void onSubmit(e)}>
          <Section title={t("market.person.sectionIdentity")} hint={t("market.person.nameHint")}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="size-16 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                {shownAvatar ? (
                  <img src={shownAvatar} alt="" className="size-full object-cover" />
                ) : null}
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="size-3.5" aria-hidden />
                    {shownAvatar
                      ? t("market.person.avatarReplace")
                      : t("market.person.avatarChoose")}
                  </Button>
                  {shownAvatar && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setAvatarFile(null);
                        setAvatarPreview(null);
                        setAvatarCleared(true);
                        setDirty(true);
                      }}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      {t("market.person.avatarRemove")}
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t("market.person.avatarRules")}
                </p>
              </div>
              <input
                ref={fileRef}
                id="avatar"
                type="file"
                className="sr-only"
                accept="image/jpeg,image/png,image/webp"
                aria-label={t("market.person.avatar")}
                onChange={(e) => void onPickAvatar(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="display_name">{t("market.person.displayName")}</Label>
              <Input
                id="display_name"
                value={draft.display_name}
                onChange={(e) => set("display_name", e.target.value)}
                placeholder={t("market.person.fallbackName")}
                aria-invalid={!!errors.display_name}
                required
              />
              <FieldError message={errors.display_name} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="headline">{t("market.person.headline")}</Label>
              <Input
                id="headline"
                maxLength={120}
                value={draft.headline}
                onChange={(e) => set("headline", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="about">{t("market.business.about")}</Label>
              <Textarea
                id="about"
                rows={4}
                maxLength={1200}
                value={draft.about}
                onChange={(e) => set("about", e.target.value)}
              />
            </div>
          </Section>

          <Section
            title={t("market.person.sectionLocation")}
            hint={t("market.geo.countryAccountHint")}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="country_id">{t("market.geo.country")}</Label>
                <select
                  id="country_id"
                  className={selectClass}
                  value={draft.country_id}
                  onChange={(e) => onCountryChange(e.target.value)}
                >
                  <option value="">{t("market.geo.pick")}</option>
                  {(countries.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {geoName(c, locale)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="city_id">{t("market.geo.city")}</Label>
                <select
                  id="city_id"
                  className={selectClass}
                  value={draft.city_id}
                  disabled={!draft.country_id}
                  onChange={(e) => set("city_id", e.target.value)}
                >
                  <option value="">{t("market.geo.pickCity")}</option>
                  {(cities.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {geoName(c, locale)}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.city_id} />
              </div>
              <div className="min-w-0 space-y-1.5 sm:col-span-2">
                <Label htmlFor="region">
                  {t("market.person.districtLabel")}{" "}
                  <span className="text-[11px] font-normal text-muted-foreground">
                    ({t("market.person.optional")})
                  </span>
                </Label>
                <Input
                  id="region"
                  value={draft.region}
                  onChange={(e) => set("region", e.target.value)}
                />
              </div>
            </div>
          </Section>

          <Section
            title={t("market.person.sectionContact")}
            hint={t("market.person.privacyHint")}
          >
            <PhoneField
              countryId={draft.country_id || null}
              value={phone}
              onChange={(v) => {
                setPhone(v);
                setDirty(true);
              }}
              status={contact.data?.phone_status}
              invalid={!!errors.phone}
            />
            <p className="text-[11px] text-muted-foreground">
              {locale === "ar"
                ? "رقم الجوال الدولي هو اسم المستخدم لحسابك."
                : "Your international mobile number is your account username."}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("market.person.phoneStatusHint")}
            </p>
            <FieldError message={errors.phone} />
            <PhoneVisibilityField
              value={visibility}
              onChange={(v) => {
                setVisibility(v);
                setDirty(true);
              }}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="public_whatsapp">
                  {t("market.form.whatsapp")}{" "}
                  <span className="text-[11px] font-normal text-muted-foreground">
                    ({t("market.person.optional")})
                  </span>
                </Label>
                <Input
                  id="public_whatsapp"
                  dir="ltr"
                  value={draft.public_whatsapp}
                  onChange={(e) => set("public_whatsapp", e.target.value)}
                  aria-invalid={!!errors.public_whatsapp}
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={draft.show_whatsapp}
                    onChange={(e) => set("show_whatsapp", e.target.checked)}
                  />
                  {t("market.person.showField")}
                </label>
                <FieldError message={errors.public_whatsapp} />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="public_email">
                  {t("market.form.email")}{" "}
                  <span className="text-[11px] font-normal text-muted-foreground">
                    ({t("market.person.optional")})
                  </span>
                </Label>
                <Input
                  id="public_email"
                  type="email"
                  dir="ltr"
                  value={draft.public_email}
                  onChange={(e) => set("public_email", e.target.value)}
                  aria-invalid={!!errors.public_email}
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={draft.show_email}
                    onChange={(e) => set("show_email", e.target.checked)}
                  />
                  {t("market.person.showField")}
                </label>
                <p className="text-[11px] text-muted-foreground">
                  {t("market.person.publicEmailHint")}
                </p>
                <FieldError message={errors.public_email} />
              </div>
            </div>
          </Section>

          <Section title={t("market.person.sectionVisibility")}>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={draft.is_published}
                onChange={(e) => set("is_published", e.target.checked)}
              />
              {t("market.person.publishProfile")}
            </label>
            <p className="text-[11px] text-muted-foreground">{t("market.person.publishHint")}</p>

            <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={draft.personalize_suggestions}
                onChange={(e) => set("personalize_suggestions", e.target.checked)}
              />
              {t("market.person.personalize")}
            </label>
            <p className="text-[11px] text-muted-foreground">
              {t("market.person.personalizeHint")}
            </p>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-muted-foreground">{t("market.person.badgeState")}</span>
              <VerifiedBadge status={row?.verification_status} size="xs" />
              <span className="text-muted-foreground">
                {t("market.person.notVerifiedHint")}
              </span>
              {row?.username && (
                <Link
                  to="/u/$username"
                  params={{ username: row.username }}
                  className="inline-flex items-center gap-1 font-medium text-primary"
                >
                  {t("market.person.viewPublic")}
                  <ExternalLink className="size-3.5" aria-hidden />
                </Link>
              )}
            </div>
          </Section>

          <Section title={t("market.call.title")}>
            <CallSettingsToggle />
          </Section>

          <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {busy ? t("market.person.saving") : t("market.person.saveChanges")}
            </Button>
            {dirty && !busy && (
              <span className="text-xs text-muted-foreground">{t("market.person.unsaved")}</span>
            )}
          </div>
        </form>
      )}
    </DashboardShell>
  );
}

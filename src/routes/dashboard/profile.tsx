import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { MKT_BUCKET } from "@/lib/mkt";
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
import { PhoneField, PhoneVisibilityField } from "@/components/marketplace/PhoneFields";
import { useMyUserProfile } from "@/lib/mkt-identity";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { VerifiedBadge } from "@/components/marketplace/ListingCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/dashboard/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "حسابي الشخصي — سوق تحقّق" },
      {
        name: "description",
        content: "حرّر ملفك العام كمعلن فرد في سوق تحقّق: الاسم، النبذة، المدينة، وبيانات التواصل.",
      },
      { property: "og:title", content: "حسابي الشخصي — سوق تحقّق" },
      { property: "og:description", content: "ملفك العام كمعلن فرد في سوق تحقّق." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function ProfilePage() {
  const { t, locale } = useI18n();
  const { session, profile } = useSession();
  const me = useMyUserProfile();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [avatar, setAvatar] = useState<File | null>(null);

  const row = me.data;

  const countries = useQuery({ queryKey: ["mkt", "countries"], queryFn: loadCountries });
  const { preference } = useMarketPreference();
  const [countryId, setCountryId] = useState<string>("");
  const cities = useQuery({
    queryKey: ["mkt", "cities", countryId],
    enabled: !!countryId,
    queryFn: () => loadCities(countryId),
  });
  // Private contact record: the phone number and who may see it.
  const contact = useQuery({
    queryKey: ["mkt", "my-contact", session?.user.id],
    enabled: !!session,
    queryFn: () => loadMyContact(session!.user.id),
  });
  const [phone, setPhone] = useState("");
  const [visibility, setVisibility] = useState<PhoneVisibility>("hidden");
  const [phoneInvalid, setPhoneInvalid] = useState(false);
  useEffect(() => {
    const row = contact.data;
    if (!row) return;
    setPhone((prev) => prev || nationalPart(row.phone_e164));
    if (row.phone_visibility) setVisibility(row.phone_visibility);
  }, [contact.data]);

  // Adopt the saved country once the profile arrives, otherwise the browsing one.
  useEffect(() => {
    if (countryId) return;
    if (row?.country_id) {
      setCountryId(row.country_id);
      return;
    }
    const fallback = (countries.data ?? []).find((c) => c.iso2 === preference.countryIso2);
    if (fallback) setCountryId(fallback.id);
  }, [countryId, row?.country_id, countries.data, preference.countryIso2]);


  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const fd = new FormData(event.currentTarget);
    const username = String(fd.get("username") ?? "")
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{2,31}$/.test(username)) {
      toast.error(t("market.person.usernameRule"));
      return;
    }
    setBusy(true);
    try {
      let avatarPath = row?.avatar_url ?? null;
      if (avatar) {
        const ext = avatar.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `avatars/${session.user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from(MKT_BUCKET)
          .upload(path, avatar, { contentType: avatar.type || "image/jpeg" });
        if (!error) avatarPath = path;
      }

      const payload = {
        user_id: session.user.id,
        username,
        display_name: String(fd.get("display_name") ?? "").trim() || username,
        headline: (fd.get("headline") as string) || null,
        about: (fd.get("about") as string) || null,
        country_id: countryId || null,
        city_id: (fd.get("city_id") as string) || null,
        city:
          (cities.data ?? []).find((c) => c.id === (fd.get("city_id") as string))?.name_ar ?? null,
        region: (fd.get("region") as string) || null,
        avatar_url: avatarPath,
        public_email: (fd.get("public_email") as string) || null,
        public_whatsapp: (fd.get("public_whatsapp") as string) || null,
        show_email: fd.get("show_email") === "on",
        show_whatsapp: fd.get("show_whatsapp") === "on",
        is_published: fd.get("is_published") === "on",
      };

      const { error } = await supabase
        .from("mkt_user_profiles")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;

      const iso2 = (countries.data ?? []).find((c) => c.id === countryId)?.iso2 ?? "";
      if (phone.trim()) {
        const e164 = toE164(iso2, phone);
        if (!e164) {
          setPhoneInvalid(true);
          setBusy(false);
          return;
        }
        setPhoneInvalid(false);
        await saveMyContact({
          userId: session.user.id,
          countryId: countryId || null,
          phoneE164: e164,
          visibility,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["mkt", "my-contact"] });
      await queryClient.invalidateQueries({ queryKey: ["mkt", "my-user-profile"] });
      // Every location form reads the account country from this key.
      await queryClient.invalidateQueries({ queryKey: ["mkt", "account-country"] });
      toast.success(t("market.person.saved"));
    } catch {
      toast.error(t("market.actions.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell title={t("market.dash.profile")}>
      {me.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <form className="max-w-2xl space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
            <span className="text-xs text-muted-foreground">{t("market.person.badgeState")}</span>
            <VerifiedBadge status={row?.verification_status} size="xs" />
            {row?.verification_status !== "verified" && (
              <span className="text-xs text-muted-foreground">
                {t("market.person.notVerifiedHint")}
              </span>
            )}
            {row?.username && (
              <Link
                to="/u/$username"
                params={{ username: row.username }}
                className="ms-auto inline-flex items-center gap-1 text-xs font-medium text-primary"
              >
                {t("market.person.viewPublic")}
                <ExternalLink className="size-3.5" aria-hidden />
              </Link>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="username">{t("market.person.username")}</Label>
              <Input
                id="username"
                name="username"
                defaultValue={row?.username ?? ""}
                dir="ltr"
                required
              />
              <p className="text-[11px] text-muted-foreground">{t("market.person.usernameRule")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="display_name">{t("market.person.displayName")}</Label>
              <Input
                id="display_name"
                name="display_name"
                defaultValue={row?.display_name ?? profile?.full_name ?? ""}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="headline">{t("market.person.headline")}</Label>
            <Input id="headline" name="headline" defaultValue={row?.headline ?? ""} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="about">{t("market.business.about")}</Label>
            <Textarea id="about" name="about" rows={4} defaultValue={row?.about ?? ""} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="country_id">{t("market.geo.country")}</Label>
              <select
                id="country_id"
                className={selectClass}
                value={countryId}
                onChange={(e) => setCountryId(e.target.value)}
              >
                <option value="">{t("market.geo.pick")}</option>
                {(countries.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {geoName(c, locale)}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                {t("market.geo.countryAccountHint")}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city_id">{t("market.filters.city")}</Label>
              <select
                id="city_id"
                name="city_id"
                className={selectClass}
                defaultValue={row?.city_id ?? ""}
                disabled={!countryId}
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
              <Label htmlFor="region">{t("market.form.region")}</Label>
              <Input id="region" name="region" defaultValue={row?.region ?? ""} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="avatar">{t("market.person.avatar")}</Label>
            <Input
              id="avatar"
              type="file"
              accept="image/*"
              onChange={(e) => setAvatar(e.target.files?.[0] ?? null)}
            />
          </div>

          <fieldset className="space-y-3 rounded-xl border border-border bg-card p-3">
            <legend className="px-1 text-sm font-semibold text-foreground">
              {t("market.business.contact")}
            </legend>
            <p className="text-xs text-muted-foreground">{t("market.person.privacyHint")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-3 sm:col-span-2">
                <PhoneField
                  countryId={countryId || null}
                  value={phone}
                  onChange={setPhone}
                  status={contact.data?.phone_status}
                  invalid={phoneInvalid}
                />
                <PhoneVisibilityField value={visibility} onChange={setVisibility} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="public_whatsapp">{t("market.form.whatsapp")}</Label>
                <Input
                  id="public_whatsapp"
                  name="public_whatsapp"
                  dir="ltr"
                  defaultValue={row?.public_whatsapp ?? ""}
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" name="show_whatsapp" defaultChecked={row?.show_whatsapp} />
                  {t("market.person.showField")}
                </label>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="public_email">{t("market.form.email")}</Label>
                <Input
                  id="public_email"
                  name="public_email"
                  type="email"
                  dir="ltr"
                  defaultValue={row?.public_email ?? ""}
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" name="show_email" defaultChecked={row?.show_email} />
                  {t("market.person.showField")}
                </label>
              </div>
            </div>
          </fieldset>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" name="is_published" defaultChecked={row?.is_published ?? true} />
            {t("market.person.publishProfile")}
          </label>

          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t("common.save")}
          </Button>
        </form>
      )}
    </DashboardShell>
  );
}

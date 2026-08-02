import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Store } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import {
  loadCountries,
  loadMyContact,
  nationalPart,
  saveMyContact,
  toE164,
  type PhoneVisibility,
} from "@/lib/mkt-geo";
import { CountryCitySelect } from "@/components/marketplace/GeoFields";
import { PhoneField, PhoneVisibilityField } from "@/components/marketplace/PhoneFields";
import { LanguageToggle } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const title = "إعداد حسابك في السوق — سوق تحقّق";
const description = "خطوة واحدة قصيرة: الدولة، المدينة، رقم الجوال، والاسم الظاهر، ثم متابعة إلى السوق.";

export const Route = createFileRoute("/market-setup")({
  ssr: false,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MarketSetupPage,
});

function MarketSetupPage() {
  const { t, dir } = useI18n();
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [countryId, setCountryId] = useState<string | null>(null);
  const [cityId, setCityId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [visibility, setVisibility] = useState<PhoneVisibility>("hidden");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [phoneInvalid, setPhoneInvalid] = useState(false);
  const [busy, setBusy] = useState(false);

  const countries = useQuery({ queryKey: ["mkt", "countries"], queryFn: loadCountries });

  const existing = useQuery({
    queryKey: ["mkt", "setup-existing", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("mkt_user_profiles")
        .select("username, display_name, country_id, city_id")
        .eq("user_id", session!.user.id)
        .maybeSingle();
      const contact = await loadMyContact(session!.user.id);
      return { profile, contact };
    },
  });

  // Prefill whatever is already known so nothing is asked twice.
  useEffect(() => {
    const row = existing.data;
    if (!row) return;
    setCountryId((prev) => prev ?? row.profile?.country_id ?? row.contact?.country_id ?? null);
    setCityId((prev) => prev ?? row.profile?.city_id ?? null);
    setDisplayName((prev) => prev || (row.profile?.display_name ?? ""));
    setUsername((prev) => prev || (row.profile?.username ?? ""));
    setPhone((prev) => prev || nationalPart(row.contact?.phone_e164));
    if (row.contact?.phone_visibility) setVisibility(row.contact.phone_visibility);
  }, [existing.data]);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  const iso2 = (countries.data ?? []).find((c) => c.id === countryId)?.iso2 ?? "";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!session || !countryId || !cityId) return;
    const e164 = toE164(iso2, phone);
    if (!e164) {
      setPhoneInvalid(true);
      return;
    }
    setPhoneInvalid(false);
    setBusy(true);
    try {
      // The stored handle must match the account rule: lowercase letters, digits
      // and hyphens, 3-32 chars, starting with a letter or digit.
      const cleaned = username.trim().toLowerCase().replace(/[_\s]+/g, "-").replace(/[^a-z0-9-]/g, "");
      const handle = /^[a-z0-9][a-z0-9-]{2,31}$/.test(cleaned)
        ? cleaned
        : `u-${session.user.id.slice(0, 8)}`;

      const { error } = await supabase.from("mkt_user_profiles").upsert(
        {
          user_id: session.user.id,
          username: handle,
          display_name: displayName.trim() || t("market.person.fallbackName"),
          country_id: countryId,
          city_id: cityId,
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      await saveMyContact({
        userId: session.user.id,
        countryId,
        phoneE164: e164,
        visibility,
      });
      await queryClient.invalidateQueries({ queryKey: ["mkt"] });
      void navigate({ to: "/marketplace", replace: true });
    } catch {
      toast.error(t("market.actions.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir={dir} className="flex min-h-screen items-start justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Store className="size-4" aria-hidden />
          </span>
          <span className="text-base font-bold text-foreground">{t("market.brand")}</span>
          <span className="ms-auto">
            <LanguageToggle compact />
          </span>
        </div>

        <h1 className="text-xl font-bold text-foreground">{t("market.setup.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("market.setup.subtitle")}</p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <CountryCitySelect
            countryId={countryId}
            cityId={cityId}
            required
            onChange={(next) => {
              setCountryId(next.countryId);
              setCityId(next.cityId);
            }}
          />

          <PhoneField
            countryId={countryId}
            value={phone}
            onChange={setPhone}
            status={existing.data?.contact?.phone_status}
            invalid={phoneInvalid}
          />
          <PhoneVisibilityField value={visibility} onChange={setVisibility} />

          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="display_name">{t("market.setup.displayName")}</Label>
            <Input
              id="display_name"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="username">{t("market.setup.username")}</Label>
            <Input
              id="username"
              dir="ltr"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full" disabled={busy || !countryId || !cityId}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t("market.setup.continue")}
          </Button>
        </form>
      </div>
    </div>
  );
}

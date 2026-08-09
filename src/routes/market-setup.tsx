import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Flag, Loader2, Store } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import {
  ACTIVE_MARKET_ISO2,
  loadCountries,
  loadMyContact,
  nationalPart,
  saveMyContact,
  toE164,
  type PhoneVisibility,
} from "@/lib/mkt-geo";
import { PhoneField, PhoneVisibilityField } from "@/components/marketplace/PhoneFields";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const title = "إعداد حسابك في سوريا — سوق گحيل";
const description = "خطوة واحدة قصيرة: رقم الجوال السوري والاسم الظاهر، ثم متابعة إلى السوق.";

export const Route = createFileRoute("/market-setup")({
  ssr: "data-only",
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
  const { t, dir, locale } = useI18n();
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [countryId, setCountryId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [visibility, setVisibility] = useState<PhoneVisibility>("hidden");
  const [displayName, setDisplayName] = useState("");
  const [phoneInvalid, setPhoneInvalid] = useState(false);
  const [busy, setBusy] = useState(false);

  const countries = useQuery({ queryKey: ["mkt", "countries", ACTIVE_MARKET_ISO2], queryFn: loadCountries });

  const existing = useQuery({
    queryKey: ["mkt", "setup-existing", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("mkt_user_profiles")
        .select("display_name")
        .eq("user_id", session!.user.id)
        .maybeSingle();
      const contact = await loadMyContact(session!.user.id);
      return { profile, contact };
    },
  });

  useEffect(() => {
    const syria = (countries.data ?? []).find((country) => country.iso2 === ACTIVE_MARKET_ISO2);
    setCountryId(syria?.id ?? null);
  }, [countries.data]);

  useEffect(() => {
    const row = existing.data;
    if (!row) return;
    setDisplayName((previous) => previous || (row.profile?.display_name ?? ""));
    setPhone((previous) => previous || nationalPart(row.contact?.phone_e164));
    if (row.contact?.phone_visibility) setVisibility(row.contact.phone_visibility);
  }, [existing.data]);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!session || !countryId) return;
    const e164 = toE164(ACTIVE_MARKET_ISO2, phone);
    if (!e164) {
      setPhoneInvalid(true);
      return;
    }
    setPhoneInvalid(false);
    setBusy(true);
    try {
      const handle = e164.replace(/\D/g, "");

      const { error } = await supabase.from("mkt_user_profiles").upsert(
        {
          user_id: session.user.id,
          username: handle,
          display_name: displayName.trim() || t("market.person.fallbackName"),
          country_id: countryId,
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
      void navigate({ to: "/", replace: true });
    } catch {
      toast.error(t("market.actions.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir={dir} className="market-surface flex min-h-screen items-start justify-center px-4 py-8">
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

        <h1 className="text-xl font-bold text-foreground">إعداد حسابك في سوريا</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          نسخة السعودية متوقفة مؤقتًا، وجميع الحسابات والإعلانات الجديدة في هذه النسخة سورية.
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label>{t("market.geo.country")}</Label>
            <div className="flex min-h-11 items-center gap-2 rounded-md border border-input bg-muted/35 px-3 text-sm font-bold text-foreground">
              <Flag className="size-4 text-primary" aria-hidden />
              <span>{locale === "en" ? "Syria" : "سوريا"}</span>
              <span className="ms-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                السوق النشط
              </span>
            </div>
          </div>

          <PhoneField
            countryId={countryId}
            value={phone}
            onChange={setPhone}
            status={existing.data?.contact?.phone_status}
            invalid={phoneInvalid}
          />
          <p className="text-[11px] text-muted-foreground">
            {locale === "ar"
              ? "أدخل رقمًا سوريًا. سيُحفظ دوليًا بصيغة +963 ويُستخدم كاسم المستخدم."
              : "Enter a Syrian number. It will be stored with +963 and used as your username."}
          </p>
          <PhoneVisibilityField value={visibility} onChange={setVisibility} />

          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="display_name">{t("market.setup.displayName")}</Label>
            <Input
              id="display_name"
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>

          <Button type="submit" className="w-full" disabled={busy || !countryId}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t("market.setup.continue")}
          </Button>
        </form>
      </div>
    </div>
  );
}

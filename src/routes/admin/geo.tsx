import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { geoName, loadCountries } from "@/lib/mkt-geo";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const title = "الدول والمدن — إدارة كحلي";
const description = "إدارة الدول والمدن المتاحة في السوق ومراجعة المدن المقترحة من المستخدمين.";

export const Route = createFileRoute("/admin/geo")({
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
  component: AdminGeoPage,
});

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function AdminGeoPage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [countryId, setCountryId] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [busy, setBusy] = useState(false);

  const countries = useQuery({ queryKey: ["mkt", "countries"], queryFn: loadCountries });

  // Admin view: inactive cities must stay visible so they can be re-enabled.
  const cities = useQuery({
    queryKey: ["mkt", "admin-cities", countryId],
    enabled: !!countryId,
    queryFn: async () => {
      const { data } = await supabase
        .from("mkt_cities")
        .select("id, country_id, name_ar, name_en, is_active")
        .eq("country_id", countryId)
        .order("name_ar");
      return data ?? [];
    },
  });

  const suggestions = useQuery({
    queryKey: ["mkt", "admin-city-suggestions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("mkt_city_suggestions")
        .select("id, country_id, suggested_name, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  async function addCity() {
    if (!countryId || !nameAr.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("mkt_cities").insert({
        country_id: countryId,
        name_ar: nameAr.trim(),
        name_en: nameEn.trim() || nameAr.trim(),
        is_active: true,
      });
      if (error) throw error;
      setNameAr("");
      setNameEn("");
      await queryClient.invalidateQueries({ queryKey: ["mkt"] });
      toast.success(t("common.saved"));
    } catch {
      toast.error(t("market.actions.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleCity(id: string, next: boolean) {
    const { error } = await supabase.from("mkt_cities").update({ is_active: next }).eq("id", id);
    if (error) {
      toast.error(t("market.actions.failed"));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["mkt"] });
  }

  async function reviewSuggestion(
    row: { id: string; country_id: string; suggested_name: string },
    approve: boolean,
  ) {
    try {
      if (approve) {
        const { error } = await supabase.from("mkt_cities").insert({
          country_id: row.country_id,
          name_ar: row.suggested_name,
          name_en: row.suggested_name,
          is_active: true,
        });
        if (error) throw error;
      }
      const { error } = await supabase
        .from("mkt_city_suggestions")
        .update({
          status: approve ? "approved" : "rejected",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["mkt"] });
    } catch {
      toast.error(t("market.actions.failed"));
    }
  }

  return (
    <AdminShell title={t("market.admin.geo")}>
      <div className="space-y-5">
        <section className="rounded-xl border border-border bg-card p-3">
          <Label htmlFor="admin-country">{t("market.geo.country")}</Label>
          <select
            id="admin-country"
            className={`${selectClass} mt-1.5`}
            value={countryId}
            onChange={(e) => setCountryId(e.target.value)}
          >
            <option value="">{t("market.geo.pick")}</option>
            {(countries.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {geoName(c, locale)} · {c.calling_code} · {c.currency_code}
              </option>
            ))}
          </select>
        </section>

        {countryId && (
          <section className="rounded-xl border border-border bg-card p-3">
            <h2 className="text-sm font-bold text-foreground">{t("market.admin.geoCities")}</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder="الاسم بالعربية"
                aria-label="الاسم بالعربية"
              />
              <Input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                dir="ltr"
                placeholder="English name"
                aria-label="English name"
              />
              <Button type="button" onClick={() => void addCity()} disabled={busy || !nameAr.trim()}>
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {t("market.admin.geoAddCity")}
              </Button>
            </div>

            {cities.isLoading ? (
              <Skeleton className="mt-3 h-32 w-full rounded-lg" />
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {cities.data?.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {locale === "ar" ? c.name_ar : c.name_en || c.name_ar}
                    </span>
                    {!c.is_active && (
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                        {t("market.admin.geoDisable")}
                      </span>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void toggleCity(c.id, !c.is_active)}
                    >
                      {c.is_active ? t("market.admin.geoDisable") : t("market.admin.geoEnable")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">{t("market.admin.geoInUse")}</p>
          </section>
        )}

        <section className="rounded-xl border border-border bg-card p-3">
          <h2 className="text-sm font-bold text-foreground">
            {t("market.admin.geoSuggestions")}
          </h2>
          {suggestions.isLoading ? (
            <Skeleton className="mt-3 h-24 w-full rounded-lg" />
          ) : suggestions.data?.length ? (
            <ul className="mt-2 divide-y divide-border">
              {suggestions.data.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{row.suggested_name}</span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void reviewSuggestion(row, true)}
                  >
                    {t("market.admin.geoApprove")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void reviewSuggestion(row, false)}
                  >
                    {t("market.admin.geoReject")}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">{t("market.admin.noResults")}</p>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

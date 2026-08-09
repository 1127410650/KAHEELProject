/**
 * بطاقة «نطاق الدول» في لوحة الإدارة.
 *
 * تفعيل دولة جديدة (لبنان) = ضغطة واحدة هنا: يفتح السوق فيها، وتظهر محافظاتها
 * في الفلاتر والعناوين، ويصير التسجيل بمفتاحها برقم الجوال فقط إن كان
 * «الدخول برقم الجوال» مفعّلًا. لا نشر ولا نسخة منفصلة.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { geoName, loadAllCountries } from "@/lib/mkt-geo";
import { resetMarketCache } from "@/lib/mkt-markets";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

export function MarketCountriesCard() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const countries = useQuery({ queryKey: ["mkt", "admin-countries"], queryFn: loadAllCountries });

  async function patch(id: string, values: Record<string, boolean>) {
    setBusyId(id);
    try {
      // الدولة الافتراضية واحدة فقط: نُفرغ البقية قبل التعيين.
      if (values.is_default_market) {
        await supabase
          .from("mkt_countries")
          .update({ is_default_market: false })
          .neq("id", id);
      }
      const { error } = await supabase.from("mkt_countries").update(values).eq("id", id);
      if (error) throw error;
      resetMarketCache();
      await queryClient.invalidateQueries({ queryKey: ["mkt"] });
      toast.success(locale === "en" ? "Saved" : "تم الحفظ");
    } catch {
      toast.error(locale === "en" ? "Could not save" : "تعذّر الحفظ");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">
            {locale === "en" ? "Market countries" : "نطاق الدول المفعّلة"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {locale === "en"
              ? "Enable a country to open the marketplace there: its governorates, addresses and listings follow automatically."
              : "تفعيل الدولة يفتح السوق فيها: محافظاتها وعناوينها وإعلاناتها تظهر تلقائيًا."}
          </p>
        </div>

        {countries.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <div className="space-y-2">
            {(countries.data ?? []).map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center gap-4 rounded-lg border border-border/60 p-3"
              >
                <div className="min-w-32 flex-1">
                  <p className="text-sm font-semibold">{geoName(row, locale)}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.iso2} · {row.calling_code} · {row.currency_code}
                  </p>
                </div>

                <label className="flex items-center gap-2 text-xs">
                  <Switch
                    checked={row.is_market_enabled}
                    disabled={busyId === row.id}
                    onCheckedChange={(next) =>
                      void patch(row.id, { is_market_enabled: next, is_active: next || row.is_active })
                    }
                  />
                  {locale === "en" ? "Market open" : "السوق مفعّل"}
                </label>

                <label className="flex items-center gap-2 text-xs">
                  <Switch
                    checked={row.phone_only_otp}
                    disabled={busyId === row.id}
                    onCheckedChange={(next) => void patch(row.id, { phone_only_otp: next })}
                  />
                  {locale === "en" ? "Phone-only code" : "كود بالجوال فقط"}
                </label>

                <Button
                  size="sm"
                  variant={row.is_default_market ? "secondary" : "outline"}
                  disabled={busyId === row.id || row.is_default_market || !row.is_market_enabled}
                  onClick={() => void patch(row.id, { is_default_market: true })}
                >
                  {busyId === row.id ? <Loader2 className="size-4 animate-spin" /> : null}
                  {row.is_default_market
                    ? locale === "en"
                      ? "Default"
                      : "الافتراضية"
                    : locale === "en"
                      ? "Make default"
                      : "اجعلها الافتراضية"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { geoName, loadCities, useAccountCountry } from "@/lib/mkt-geo";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new tenant id once the business exists. */
  onCreated: (tenantId: string) => void;
}

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

/**
 * Short "add a business" form opened from the ad form.
 *
 * It never creates a new login: the business is attached to the signed-in user
 * as its owner, and verification is not required to publish under it.
 */
export function BusinessQuickCreate({ open, onOpenChange, onCreated }: Props) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const country = useAccountCountry();
  const cities = useQuery({
    queryKey: ["mkt", "cities", country.data?.id],
    enabled: !!country.data?.id,
    queryFn: () => loadCities(country.data?.id ?? null),
  });

  const [name, setName] = useState("");
  const [activity, setActivity] = useState("");
  const [cityId, setCityId] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const displayName = name.trim();
    if (displayName.length < 2) {
      toast.error(t("market.biz.nameRequired"));
      return;
    }
    setBusy(true);
    try {
      const cityName = (cities.data ?? []).find((c) => c.id === cityId)?.name_ar;
      const { data: tenantId, error } = await supabase.rpc("create_workspace", {
        _tenant_type: "establishment",
        _name_ar: displayName,
        ...(cityName ? { _city: cityName } : {}),
        ...(activity.trim() ? { _activity: activity.trim() } : {}),
        _contact_info: {},
        _confirm_duplicate: false,
      });
      if (error || !tenantId) {
        const code = error?.message ?? "";
        toast.error(
          code.includes("WORKSPACE_LIMIT_REACHED")
            ? t("market.biz.limitReached")
            : t("market.actions.failed"),
        );
        return;
      }

      const tid = tenantId as unknown as string;
      await supabase.from("mkt_business_profiles").insert({
        tenant_id: tid,
        slug: `biz-${tid.slice(0, 8)}`,
        display_name_ar: displayName,
        country_id: country.data?.id ?? null,
        city_id: cityId || null,
        city: (cities.data ?? []).find((c) => c.id === cityId)?.name_ar ?? null,
        is_published: true,
      });

      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      await queryClient.invalidateQueries({ queryKey: ["mkt", "my-businesses"] });
      toast.success(t("market.biz.created"));
      onCreated(tid);
      onOpenChange(false);
      setName("");
      setActivity("");
      setCityId("");
    } catch {
      toast.error(t("market.actions.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("market.biz.quickCreate")}</DialogTitle>
          <DialogDescription>{t("market.biz.quickCreateHint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="qc_name">{t("market.biz.name")}</Label>
            <Input id="qc_name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc_activity">{t("market.biz.activity")}</Label>
            <Input
              id="qc_activity"
              value={activity}
              maxLength={120}
              onChange={(e) => setActivity(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc_city">{t("market.geo.city")}</Label>
            <select
              id="qc_city"
              className={selectClass}
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
            >
              <option value="">{t("market.geo.pickCity")}</option>
              {(cities.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {geoName(c, locale)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => void submit()} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t("market.biz.createBusiness")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

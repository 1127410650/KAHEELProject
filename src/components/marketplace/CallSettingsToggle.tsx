/**
 * Advertiser switch for receiving free in-platform voice calls. Saved on the
 * spot (independent of the profile form) because it is a live availability flag.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { getCallSettings, setCallsEnabled } from "@/lib/mkt-calls";

export function CallSettingsToggle() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const settings = useQuery({
    queryKey: ["mkt", "call-settings"],
    queryFn: getCallSettings,
  });
  const enabled = settings.data?.calls_enabled ?? false;

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      await setCallsEnabled(next);
      await queryClient.invalidateQueries({ queryKey: ["mkt", "call-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["mkt", "call-eligibility"] });
      toast.success(next ? t("market.call.enabled") : t("market.call.disabled"));
    } catch {
      toast.error(t("market.actions.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy || settings.isLoading}
          onChange={(e) => void toggle(e.target.checked)}
        />
        {t("market.call.enable")}
      </label>
      <p className="text-[11px] text-muted-foreground">{t("market.call.enableHint")}</p>
    </div>
  );
}

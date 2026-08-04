/**
 * Call availability for the account the user is currently working under.
 *
 * Three explicit modes — off, "request a call", or open to everyone. Messaging
 * is always available regardless of the mode, and no phone number is ever
 * exposed. Open call requests are answered from here.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, PhoneCall } from "lucide-react";

import { useI18n } from "@/i18n";
import { useActiveAccount } from "@/lib/mkt-account";
import { useCallCenter } from "@/lib/mkt-call-center";
import {
  closeCallRequest,
  getCallMode,
  listCallRequests,
  setCallMode,
  type CallMode,
} from "@/lib/mkt-calls";
import { Button } from "@/components/ui/button";

const MODES: CallMode[] = ["off", "request", "direct"];

export function CallSettingsToggle() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { account } = useActiveAccount();
  const { startFromRequest, starting } = useCallCenter();
  const tenantId = account?.tenant_id ?? null;
  const [busy, setBusy] = useState(false);

  const mode = useQuery({
    queryKey: ["mkt", "call-settings", tenantId],
    queryFn: () => getCallMode(tenantId),
  });
  const current: CallMode = mode.data ?? "off";

  const requests = useQuery({
    queryKey: ["mkt", "call-requests"],
    queryFn: listCallRequests,
    refetchInterval: 60_000,
  });

  async function change(next: CallMode) {
    if (next === current) return;
    setBusy(true);
    try {
      await setCallMode(tenantId, next);
      await queryClient.invalidateQueries({ queryKey: ["mkt", "call-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["mkt", "call-eligibility"] });
      toast.success(next === "off" ? t("market.call.disabled") : t("market.call.enabled"));
    } catch {
      toast.error(t("market.actions.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function answer(requestId: string) {
    try {
      await startFromRequest(requestId);
      await queryClient.invalidateQueries({ queryKey: ["mkt", "call-requests"] });
    } catch {
      /* the call center already surfaced the reason */
    }
  }

  async function dismissRequest(requestId: string) {
    try {
      await closeCallRequest(requestId);
      await queryClient.invalidateQueries({ queryKey: ["mkt", "call-requests"] });
    } catch {
      toast.error(t("market.actions.failed"));
    }
  }

  const disabled = busy || mode.isLoading;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">{t("market.call.availability")}</p>
        <p className="text-[11px] text-muted-foreground">{t("market.call.enableHint")}</p>
      </div>

      <div className="space-y-2">
        {MODES.map((value) => (
          <label
            key={value}
            className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm transition-colors ${
              current === value ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <input
              type="radio"
              name="call-mode"
              className="mt-1"
              value={value}
              checked={current === value}
              disabled={disabled}
              onChange={() => void change(value)}
            />
            <span className="space-y-0.5">
              <span className="block font-medium text-foreground">
                {t(`market.call.mode.${value}`)}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                {t(`market.call.modeHint.${value}`)}
              </span>
            </span>
          </label>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">{t("market.call.messagesAlways")}</p>

      {(requests.data?.length ?? 0) > 0 && (
        <div className="space-y-2 rounded-xl border border-border p-3">
          <p className="text-sm font-medium text-foreground">{t("market.call.requests")}</p>
          {requests.data?.map((request) => (
            <div key={request.id} className="flex flex-wrap items-center gap-2">
              <span className="flex-1 truncate text-xs text-muted-foreground">
                {t("market.call.requestPending")}
              </span>
              <Button
                type="button"
                size="sm"
                className="h-9"
                disabled={starting}
                onClick={() => void answer(request.id)}
              >
                {starting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <PhoneCall className="size-4" aria-hidden />
                )}
                {t("market.call.callBack")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9"
                onClick={() => void dismissRequest(request.id)}
              >
                {t("common.close")}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

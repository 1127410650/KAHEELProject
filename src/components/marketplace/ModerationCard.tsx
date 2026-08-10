import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ShieldAlert } from "lucide-react";

import { useI18n } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import { adminErrorMessage } from "@/lib/mkt-platform";
import {
  dismissScan,
  loadListingModerationSummary,
  loadListingScans,
  loadModerationThresholds,
  type ModerationScan,
  type ModerationSignal,
} from "@/lib/mkt-moderation";
import { AdminStatusBadge, type AdminTone } from "@/components/marketplace/AdminStatusBadge";
import { ReasonDialog } from "@/components/marketplace/ReasonDialog";
import { Panel } from "@/components/marketplace/AdminDetail";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";

const STATE_TONE: Record<string, AdminTone> = {
  unscanned: "idle",
  clean: "done",
  review: "pending",
  blocked_suspected: "critical",
  cleared: "done",
};

const DECISION_TONE: Record<string, AdminTone> = {
  clean: "done",
  review: "pending",
  block: "critical",
};

function SignalRow({ signal }: { signal: ModerationSignal }) {
  const { t } = useI18n();
  const category = signal.category ? t(`admin.moderation.category.${signal.category}`) : null;
  const severity = signal.severity ? t(`admin.moderation.severity.${signal.severity}`) : null;
  return (
    <div className="rounded-lg bg-background px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <AdminStatusBadge tone="idle" label={t(`admin.moderation.signalType.${signal.type}`)} />
        {category && <AdminStatusBadge tone="idle" label={category} />}
        {severity && <AdminStatusBadge tone={severity === "high" ? "critical" : severity === "medium" ? "urgent" : "idle"} label={severity} />}
        {typeof signal.weight === "number" && (
          <span className="text-desc tabular-nums text-muted-foreground">
            {t("admin.moderation.weight")}: {signal.weight}
          </span>
        )}
      </div>
      {(signal.field || signal.excerpt) && (
        <p className="mt-1.5 break-words text-desc text-muted-foreground">
          {signal.field && <span>{t("admin.moderation.field")}: {signal.field}</span>}
          {signal.field && signal.excerpt ? " · " : ""}
          {signal.excerpt && <span className="font-medium text-foreground">"{signal.excerpt}"</span>}
        </p>
      )}
    </div>
  );
}

function ScanBlock({
  scan,
  isLatest,
  onDismiss,
}: {
  scan: ModerationScan;
  isLatest: boolean;
  onDismiss?: (() => void) | undefined;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <AdminStatusBadge tone={DECISION_TONE[scan.decision] ?? "idle"} label={t(`admin.moderation.decision.${scan.decision}`)} />
          <span className="text-desc tabular-nums text-muted-foreground">
            {t("admin.moderation.score")}: {scan.score}
          </span>
          <span className="text-desc text-muted-foreground">
            {t(`admin.moderation.trigger.${scan.trigger_source}`)}
          </span>
        </div>
        <span className="text-desc tabular-nums text-muted-foreground">{formatDateTime(scan.created_at)}</span>
      </div>

      {scan.dismissed_at ? (
        <p className="mt-2 rounded-md bg-secondary px-2 py-1.5 text-desc text-muted-foreground">
          {t("admin.moderation.dismissedAt")}: {formatDateTime(scan.dismissed_at)}
          {scan.dismiss_reason ? ` — ${scan.dismiss_reason}` : ""}
        </p>
      ) : (
        isLatest &&
        onDismiss &&
        scan.decision !== "clean" && (
          <div className="mt-2">
            <Button variant="outline" size="sm" className="min-h-11" onClick={onDismiss}>
              {t("admin.moderation.dismiss")}
            </Button>
          </div>
        )
      )}

      {scan.signals.length > 0 && (
        <div className="mt-3 grid gap-1.5">
          {scan.signals.map((signal, index) => (
            <SignalRow key={index} signal={signal} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Informational moderation summary for a listing's admin file.
 *
 * Shows the current automated state, the latest scan's signals in plain
 * language, and the scan history. The only action available is dismissing a
 * flag with a reason — this card never suggests restricting the advertiser's
 * account, which stays a separate, deliberate decision elsewhere.
 */
export function ModerationCard({ listingId }: { listingId: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dismissTarget, setDismissTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const scans = useQuery({
    queryKey: ["mkt", "admin", "moderation-scans", listingId],
    queryFn: () => loadListingScans(listingId),
  });
  const summary = useQuery({
    queryKey: ["mkt", "admin", "moderation-summary", listingId],
    queryFn: () => loadListingModerationSummary(listingId),
  });
  const thresholdsQuery = useQuery({
    queryKey: ["mkt", "admin", "moderation-thresholds"],
    queryFn: loadModerationThresholds,
    staleTime: 60_000,
  });
  const moderationState = summary.data?.moderation_state ?? null;
  const moderationScore = summary.data?.moderation_score ?? null;
  const lastScanAt = summary.data?.last_scan_at ?? null;
  const thresholds = thresholdsQuery.data?.thresholds ?? undefined;

  const rows = scans.data ?? [];
  const latest = rows[0];
  const history = rows.slice(1);

  async function confirmDismiss(reason: string) {
    if (!dismissTarget) return;
    setBusy(true);
    try {
      await dismissScan(dismissTarget, reason);
      toast.success(t("admin.actionDone"));
      setDismissTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "moderation-scans", listingId] });
    } catch (error) {
      toast.error(adminErrorMessage(error, t("admin.actionFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title={t("admin.moderation.title")}
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          <AdminStatusBadge
            tone={STATE_TONE[moderationState ?? "unscanned"] ?? "idle"}
            label={t(`admin.moderation.state.${moderationState ?? "unscanned"}`)}
          />
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-3 text-desc text-muted-foreground">
        <span>
          {t("admin.moderation.score")}: <span className="tabular-nums text-foreground">{moderationScore ?? "—"}</span>
          {thresholds && (
            <span className="tabular-nums"> / {t("admin.moderation.thresholds")}: {thresholds.review} · {thresholds.block}</span>
          )}
        </span>
        <span>
          {t("admin.moderation.lastScan")}: {lastScanAt ? formatDateTime(lastScanAt) : t("common.noData")}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-desc text-muted-foreground">
        <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
        <span>{t("admin.moderation.hint")}</span>
      </div>

      <div className="mt-3">
        {scans.isLoading ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : !latest ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("admin.moderation.noScans")}</p>
        ) : (
          <div className="space-y-3">
            <ScanBlock scan={latest} isLatest onDismiss={() => setDismissTarget(latest.id)} />

            {history.length > 0 && (
              <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="min-h-11 gap-1.5">
                    <ChevronDown className={`size-4 transition-transform ${historyOpen ? "rotate-180" : ""}`} aria-hidden />
                    {t("admin.moderation.history")} ({history.length})
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {history.map((scan) => (
                    <ScanBlock key={scan.id} scan={scan} isLatest={false} />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}
      </div>

      <ReasonDialog
        open={!!dismissTarget}
        title={t("admin.moderation.dismissTitle")}
        description={t("admin.moderation.dismissDescription")}
        confirmLabel={t("admin.moderation.dismiss")}
        pending={busy}
        onCancel={() => setDismissTarget(null)}
        onConfirm={(reason) => void confirmDismiss(reason)}
      />
    </Panel>
  );
}

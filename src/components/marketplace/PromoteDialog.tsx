import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coins, Sparkles } from "lucide-react";

import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { LISTING_DURATIONS, type ListingDuration } from "@/lib/mkt-listing-ops";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PromotionOverview {
  wallet_id: string | null;
  balance: number;
  prices: Record<string, number>;
  active: { id: string; duration_days: number; points_spent: number; ends_at: string } | null;
}

/**
 * Boost dialog for a published ad. Shows the wallet balance, the point price
 * per duration and disables any duration the balance cannot afford. The op id
 * is generated once per dialog open and only replaced after a successful (or
 * abandoned) attempt, so retrying a failed click never double-charges.
 */
export function PromoteDialog({
  listingId,
  title,
  open,
  onOpenChange,
  onDone,
}: {
  listingId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [duration, setDuration] = useState<ListingDuration | null>(null);
  const [pending, setPending] = useState(false);
  const opIdRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    if (open) opIdRef.current = crypto.randomUUID();
  }, [open]);

  const overview = useQuery({
    queryKey: ["mkt", "promotion-overview", listingId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mkt_listing_promotion_overview", {
        _id: listingId,
      });
      if (error) throw new Error(error.message);
      return data as unknown as PromotionOverview;
    },
  });

  async function confirm() {
    if (!duration) return;
    setPending(true);
    try {
      const { data, error } = await supabase.rpc("mkt_listing_promote", {
        _id: listingId,
        _days: duration,
        _op_id: opIdRef.current,
      });
      if (error) throw new Error(error.message);
      const result = data as unknown as { status: "ok" | "duplicate" };
      toast.success(
        result.status === "duplicate" ? t("market.promote.alreadyDone") : t("market.promote.success"),
      );
      await queryClient.invalidateQueries({ queryKey: ["mkt", "my-ads"] });
      onDone?.();
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const key = message.includes("insufficient_points")
        ? "market.promote.insufficientPoints"
        : message.includes("already_promoted")
          ? "market.promote.alreadyPromoted"
          : message.includes("invalid_state")
            ? "market.promote.invalidState"
            : message.includes("invalid_duration")
              ? "market.promote.invalidDuration"
              : message.includes("price_unavailable")
                ? "market.promote.priceUnavailable"
                : message.includes("forbidden")
                  ? "market.ops.forbidden"
                  : message.includes("not_found")
                    ? "market.promote.notFound"
                    : "market.actions.failed";
      toast.error(t(key));
    } finally {
      setPending(false);
    }
  }

  const data = overview.data;
  const balance = data?.balance ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden />
            {t("market.promote.title")}
          </DialogTitle>
          <DialogDescription className="truncate">{title}</DialogDescription>
        </DialogHeader>

        {overview.isLoading ? (
          <div className="h-32 animate-pulse rounded-lg bg-muted" />
        ) : overview.isError ? (
          <p className="text-sm text-destructive">{t("market.actions.failed")}</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2">
              <span className="flex items-center gap-1.5 text-sm text-foreground">
                <Coins className="size-4 text-primary" aria-hidden />
                {t("market.points.balance")}
              </span>
              <span className="font-semibold text-foreground" dir="ltr">
                {balance}
              </span>
            </div>

            {data?.active && (
              <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
                {t("market.promote.alreadyActiveUntil", { date: formatDateTime(data.active.ends_at) })}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LISTING_DURATIONS.map((days) => {
                const price = data?.prices?.[String(days)];
                const affordable = typeof price === "number" && price <= balance;
                const selected = duration === days;
                return (
                  <button
                    key={days}
                    type="button"
                    disabled={!affordable || pending}
                    onClick={() => setDuration(days)}
                    className={`rounded-lg border px-2 py-2.5 text-center text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:bg-accent"
                    }`}
                  >
                    <span className="block font-semibold" dir="ltr">
                      {days}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground" dir="ltr">
                      {typeof price === "number" ? price : "—"}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="text-xs text-primary underline underline-offset-2"
              onClick={() => {
                onOpenChange(false);
                void navigate({ to: "/dashboard/points" });
              }}
            >
              {t("market.promote.viewPoints")}
            </button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void confirm()} disabled={!duration || pending || overview.isLoading}>
            {pending ? t("market.promote.processing") : t("market.promote.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

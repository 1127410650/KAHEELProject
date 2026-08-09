/**
 * Review queue for ad credit top-up claims.
 *
 * Approval is the only place a manual transfer becomes balance, so the reviewer
 * sees the transfer reference, the amount as sent (in its original currency),
 * and the receipt itself before deciding. The credits field is editable because
 * a claim can be filed for the wrong number; rejecting requires a reason, which
 * the provider then reads on their own screen.
 */
import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { formatDateTime, formatNumber } from "@/lib/format";
import {
  receiptSignedUrl,
  useAdminAdCreditTopups,
  useReviewAdCreditTopup,
  type TopupStatus,
} from "@/lib/mkt-ad-credit-topup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const FILTERS: (TopupStatus | "all")[] = ["pending", "approved", "rejected", "all"];

export function AdCreditTopupQueue() {
  const { t } = useI18n();
  const [filter, setFilter] = useState<TopupStatus | "all">("pending");
  const rows = useAdminAdCreditTopups(true, filter);
  const review = useReviewAdCreditTopup();

  const [credits, setCredits] = useState<Record<string, string>>({});
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  async function openReceipt(path: string) {
    const url = await receiptSignedUrl(path);
    if (!url) {
      toast.error(t("market.adCredit.topup.admin.receiptFailed"));
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function decide(id: string, approve: boolean) {
    const override = Number(credits[id]);
    if (!approve && (reasons[id] ?? "").trim().length < 3) {
      toast.error(t("market.adCredit.topup.admin.needReason"));
      return;
    }
    review.mutate(
      {
        topupId: id,
        approve,
        rejectReason: approve ? null : reasons[id]!.trim(),
        paymentRef: approve ? refs[id]?.trim() || null : null,
        creditsOverride: approve && Number.isInteger(override) && override > 0 ? override : null,
      },
      {
        onSuccess: () =>
          toast.success(
            approve
              ? t("market.adCredit.topup.admin.approved")
              : t("market.adCredit.topup.admin.rejected"),
          ),
        onError: () => toast.error(t("market.adCredit.topup.admin.failed")),
      },
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t("market.adCredit.topup.admin.title")}</h2>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                className={`rounded-full border px-3 py-1 text-xs ${
                  filter === value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                {value === "all"
                  ? t("market.adCredit.topup.admin.all")
                  : t(`market.adCredit.topup.status.${value}`)}
              </button>
            ))}
          </div>
        </div>

        {rows.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (rows.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("market.adCredit.topup.admin.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {(rows.data ?? []).map((row) => (
              <li key={row.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {t(`market.adCredit.topup.method.${row.method}`)}
                  </Badge>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatNumber(row.credits)}
                  </span>
                  {row.amount != null && (
                    <span className="text-xs text-muted-foreground tabular-nums" dir="ltr">
                      {formatNumber(Number(row.amount))} {row.currency}
                    </span>
                  )}
                  {row.transfer_ref && (
                    <span className="text-xs text-muted-foreground" dir="ltr">
                      {row.transfer_ref}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {formatDateTime(row.created_at)}
                  </span>
                  <span className="text-[11px] text-muted-foreground" dir="ltr">
                    {row.wallet_id}
                  </span>
                  <Badge variant={row.status === "approved" ? "default" : "outline"}>
                    {t(`market.adCredit.topup.status.${row.status}`)}
                  </Badge>
                  {row.receipt_path && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => void openReceipt(row.receipt_path!)}
                    >
                      <FileText className="size-3.5" aria-hidden />
                      {t("market.adCredit.topup.admin.receipt")}
                    </Button>
                  )}
                </div>

                {row.sender_note && (
                  <p className="mt-1 text-xs text-muted-foreground">{row.sender_note}</p>
                )}
                {row.status === "rejected" && row.reject_reason && (
                  <p className="mt-1 text-xs text-destructive">{row.reject_reason}</p>
                )}

                {row.status === "pending" && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Input
                      value={credits[row.id] ?? ""}
                      onChange={(e) =>
                        setCredits((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                      placeholder={t("market.adCredit.topup.admin.creditsOverride")}
                      className="h-9 w-40"
                      inputMode="numeric"
                      dir="ltr"
                    />
                    <Input
                      value={refs[row.id] ?? ""}
                      onChange={(e) => setRefs((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      placeholder={t("market.adCredit.admin.paymentRef")}
                      className="h-9 w-44"
                      dir="ltr"
                    />
                    <Button
                      size="sm"
                      className="h-9"
                      disabled={review.isPending}
                      onClick={() => decide(row.id, true)}
                    >
                      {review.isPending && (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      )}
                      {t("market.adCredit.topup.admin.approve")}
                    </Button>
                    <Input
                      value={reasons[row.id] ?? ""}
                      onChange={(e) =>
                        setReasons((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                      placeholder={t("market.adCredit.topup.admin.reason")}
                      className="h-9 w-56"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9"
                      disabled={review.isPending}
                      onClick={() => decide(row.id, false)}
                    >
                      {t("market.adCredit.topup.admin.reject")}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

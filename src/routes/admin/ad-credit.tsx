/**
 * Platform admin view of ad credit: every wallet, every movement, and the two
 * actions that actually move a balance — settling a provider's purchase request
 * (recording the payment reference) and granting or correcting credit directly.
 *
 * Both actions go through `mkt_ad_credit_admin_*` definer functions, which
 * re-check the admin/staff permission server-side; hiding this page would not
 * be a control on its own.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Coins, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { formatDateTime, formatNumber } from "@/lib/format";
import {
  useAdminGrantAdCredit,
  useAdminSettleAdCredit,
  useAllAdCreditEntries,
  useAllAdCreditWallets,
  type AdCreditKind,
} from "@/lib/mkt-ad-credit";
import { AdCreditTopupQueue } from "@/components/marketplace/AdCreditTopupQueue";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/ad-credit")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "رصيد الإعلانات — لوحة مدير النظام" },
      {
        name: "description",
        content: "محافظ رصيد الإعلانات وطلبات الشراء وإضافة الرصيد ومراجعة كل الحركات.",
      },
      { property: "og:title", content: "رصيد الإعلانات — لوحة مدير النظام" },
      { property: "og:description", content: "إدارة رصيد الإعلانات ومراجعة حركاته." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAdCreditPage,
});

function AdminAdCreditPage() {
  const { t } = useI18n();
  const wallets = useAllAdCreditWallets(true);
  const entries = useAllAdCreditEntries(true);
  const settle = useAdminSettleAdCredit();
  const grant = useAdminGrantAdCredit();

  const [walletId, setWalletId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [paymentRefs, setPaymentRefs] = useState<Record<string, string>>({});

  const pending = useMemo(
    () => (entries.data ?? []).filter((e) => e.kind === "purchase" && e.status === "pending"),
    [entries.data],
  );

  function submitGrant(kind: Extract<AdCreditKind, "admin_grant" | "adjustment">) {
    const parsed = Number(amount);
    if (!walletId || !Number.isFinite(parsed) || parsed === 0) {
      toast.error(t("market.adCredit.admin.invalid"));
      return;
    }
    grant.mutate(
      { walletId, amount: Math.trunc(parsed), kind, note: note || null },
      {
        onSuccess: () => {
          toast.success(t("market.adCredit.admin.granted"));
          setAmount("");
          setNote("");
        },
        onError: () => toast.error(t("market.adCredit.admin.grantFailed")),
      },
    );
  }

  return (
    <AdminShell title={t("market.adCredit.admin.title")}>
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">{t("market.adCredit.admin.pending")}</h2>
            {entries.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("market.adCredit.admin.noPending")}
              </p>
            ) : (
              pending.map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2"
                >
                  <span className="text-sm font-semibold tabular-nums">
                    {formatNumber(e.amount)}
                  </span>
                  {e.price_sar != null && (
                    <Badge variant="outline" dir="ltr">
                      {formatNumber(Number(e.price_sar))} SAR
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(e.created_at)}
                  </span>
                  <span className="text-[11px] text-muted-foreground" dir="ltr">
                    {e.wallet_id}
                  </span>
                  <Input
                    value={paymentRefs[e.id] ?? ""}
                    onChange={(ev) =>
                      setPaymentRefs((prev) => ({ ...prev, [e.id]: ev.target.value }))
                    }
                    placeholder={t("market.adCredit.admin.paymentRef")}
                    className="h-9 w-44"
                  />
                  <Button
                    size="sm"
                    className="h-9"
                    disabled={settle.isPending}
                    onClick={() =>
                      settle.mutate(
                        { entryId: e.id, paymentRef: paymentRefs[e.id] || null },
                        {
                          onSuccess: () => toast.success(t("market.adCredit.admin.settled")),
                          onError: () => toast.error(t("market.adCredit.admin.settleFailed")),
                        },
                      )
                    }
                  >
                    {settle.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                    {t("market.adCredit.admin.settle")}
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">{t("market.adCredit.admin.grantTitle")}</h2>
            <div className="flex flex-wrap gap-2">
              <Input
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                placeholder={t("market.adCredit.admin.walletId")}
                className="h-10 w-72"
                dir="ltr"
              />
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t("market.adCredit.admin.amount")}
                className="h-10 w-32"
                inputMode="numeric"
                dir="ltr"
              />
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("market.adCredit.admin.note")}
                className="h-10 w-64"
              />
              <Button
                className="h-10"
                disabled={grant.isPending}
                onClick={() => submitGrant("admin_grant")}
              >
                {t("market.adCredit.admin.grant")}
              </Button>
              <Button
                variant="outline"
                className="h-10"
                disabled={grant.isPending}
                onClick={() => submitGrant("adjustment")}
              >
                {t("market.adCredit.admin.adjust")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("market.adCredit.admin.grantHint")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("market.adCredit.admin.wallets")}</h2>
            {wallets.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <ul className="divide-y divide-border">
                {(wallets.data ?? []).map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground underline"
                      dir="ltr"
                      onClick={() => setWalletId(w.id)}
                    >
                      {w.id}
                    </button>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatNumber(w.balance)}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {formatNumber(w.total_purchased)} / {formatNumber(w.total_consumed)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("market.adCredit.admin.allEntries")}</h2>
            {entries.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <ul className="divide-y divide-border">
                {(entries.data ?? []).map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="text-sm">
                      {t(`market.adCredit.kind.${e.kind}`)}
                      {e.payment_ref ? (
                        <span className="text-muted-foreground" dir="ltr">
                          {" "}
                          — {e.payment_ref}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateTime(e.created_at)}
                    </span>
                    <span className="text-sm tabular-nums" dir="ltr">
                      {e.amount > 0 ? "+" : ""}
                      {formatNumber(e.amount)}
                    </span>
                    <Badge variant="outline">{t(`market.adCredit.status.${e.status}`)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}

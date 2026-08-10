/**
 * Provider-facing ad credit wallet: balance, buying credit, and the full
 * movement log.
 *
 * The buy button records a *request* only — the balance moves when the platform
 * confirms the payment. That is stated plainly on the screen instead of
 * pretending the credit is instant, because no payment gateway is connected
 * yet.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { useActiveAccount } from "@/lib/mkt-account";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import {
  AD_CREDIT_PACKS,
  useAdCreditEntries,
  useAdCreditWallet,
  useCancelAdCreditRequest,
  useRequestAdCredit,
  type AdCreditEntry,
} from "@/lib/mkt-ad-credit";
import { AdCreditTopupCard } from "@/components/marketplace/AdCreditTopupCard";
import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/my/ad-credit")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "رصيد الإعلانات — كَحيل" },
      {
        name: "description",
        content: "رصيد الإعلانات في محفظتك: الشراء والإضافة والاستهلاك والرصيد المتبقي.",
      },
      { property: "og:title", content: "رصيد الإعلانات — كَحيل" },
      { property: "og:description", content: "إدارة رصيد إبراز إعلاناتك ومتجرك في كَحيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdCreditPage,
});

function AdCreditPage() {
  const { t, locale } = useI18n();
  const { account } = useActiveAccount();

  const accountKey = account ? `${account.kind}:${account.tenant_id ?? "self"}` : null;
  const tenantId = account?.kind === "business" ? account.tenant_id : null;

  const wallet = useAdCreditWallet(accountKey, tenantId);
  const entries = useAdCreditEntries(wallet.data?.id ?? null);
  const requestPurchase = useRequestAdCredit(tenantId);
  const cancelRequest = useCancelAdCreditRequest();
  const [selected, setSelected] = useState<number>(AD_CREDIT_PACKS[0]!.credits);

  const pack = AD_CREDIT_PACKS.find((p) => p.credits === selected) ?? AD_CREDIT_PACKS[0]!;
  const pending = (entries.data ?? []).filter(
    (e) => e.kind === "purchase" && e.status === "pending",
  );

  function buy() {
    requestPurchase.mutate(
      { credits: pack.credits, priceSar: pack.priceSar },
      {
        onSuccess: () => toast.success(t("market.adCredit.requested")),
        onError: () => toast.error(t("market.adCredit.requestFailed")),
      },
    );
  }

  return (
    <DashboardShell title={t("market.adCredit.title")}>
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4">
            {wallet.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">{t("market.adCredit.balance")}</p>
                  <p className="text-3xl font-semibold tabular-nums">
                    {formatNumber(wallet.data?.balance ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("market.adCredit.purchased")}</p>
                  <p className="text-lg tabular-nums">
                    {formatNumber(wallet.data?.total_purchased ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("market.adCredit.consumed")}</p>
                  <p className="text-lg tabular-nums">
                    {formatNumber(wallet.data?.total_consumed ?? 0)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-muted-foreground" aria-hidden />
              <h2 className="text-sm font-semibold">{t("market.adCredit.buyTitle")}</h2>
            </div>
            <p className="text-xs text-muted-foreground">{t("market.adCredit.manualNotice")}</p>

            <div className="flex flex-wrap gap-2">
              {AD_CREDIT_PACKS.map((p) => (
                <button
                  key={p.credits}
                  type="button"
                  onClick={() => setSelected(p.credits)}
                  aria-pressed={p.credits === selected}
                  className={`rounded-xl border px-3 py-2 text-start ${
                    p.credits === selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <span className="block text-sm font-semibold tabular-nums">
                    {formatNumber(p.credits)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatMoney(p.priceSar, locale)}
                  </span>
                </button>
              ))}
            </div>

            <Button onClick={buy} disabled={requestPurchase.isPending} className="h-10">
              {requestPurchase.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {t("market.adCredit.buyAction")}
            </Button>
          </CardContent>
        </Card>

        <AdCreditTopupCard walletId={wallet.data?.id ?? null} tenantId={tenantId} />



        {pending.length > 0 && (
          <Card>
            <CardContent className="space-y-2 p-4">
              <h2 className="text-sm font-semibold">{t("market.adCredit.pendingTitle")}</h2>
              {pending.map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2"
                >
                  <span className="text-sm tabular-nums">{formatNumber(e.amount)}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    disabled={cancelRequest.isPending}
                    onClick={() =>
                      cancelRequest.mutate(e.id, {
                        onSuccess: () => toast.success(t("market.adCredit.cancelled")),
                        onError: () => toast.error(t("market.adCredit.cancelFailed")),
                      })
                    }
                  >
                    {t("market.adCredit.cancel")}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("market.adCredit.ledger")}</h2>
            {entries.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (entries.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("market.adCredit.ledgerEmpty")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {(entries.data ?? []).map((e) => (
                  <EntryRow key={e.id} entry={e} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

function EntryRow({ entry }: { entry: AdCreditEntry }) {
  const { t } = useI18n();
  const positive = entry.amount > 0;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <p className="text-sm">
          {t(`market.adCredit.kind.${entry.kind}`)}
          {entry.note ? <span className="text-muted-foreground"> — {entry.note}</span> : null}
        </p>
        <p className="text-[11px] text-muted-foreground">{formatDateTime(entry.created_at)}</p>
      </div>
      <div className="flex items-center gap-2">
        {entry.status !== "settled" && (
          <Badge variant="outline">{t(`market.adCredit.status.${entry.status}`)}</Badge>
        )}
        <span
          className={`text-sm font-semibold tabular-nums ${
            positive ? "text-success" : "text-foreground"
          }`}
          dir="ltr"
        >
          {positive ? "+" : ""}
          {formatNumber(entry.amount)}
        </span>
        {entry.balance_after != null && (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {formatNumber(entry.balance_after)}
          </span>
        )}
      </div>
    </li>
  );
}

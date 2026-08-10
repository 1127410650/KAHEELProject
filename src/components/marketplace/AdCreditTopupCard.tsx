/**
 * Provider-facing top-up: transfer first, then file the claim here.
 *
 * The platform wallet details come from platform settings, not from a constant,
 * so the finance team can change the Sham Cash wallet without a release. The
 * card option only appears when the gateway is switched on in those same
 * settings — while it is off, showing it would promise a payment the backend
 * refuses.
 */
import { useEffect, useState } from "react";
import { CreditCard, Copy, Loader2, Upload, Wallet } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { formatDateTime, formatNumber } from "@/lib/format";
import {
  TOPUP_CURRENCIES,
  useCancelAdCreditTopup,
  useMyAdCreditTopups,
  useStartCardCheckout,
  useSubmitAdCreditTopup,
  useTopupMethods,
  type TopupCurrency,
} from "@/lib/mkt-ad-credit-topup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type ManualMethod = "sham_cash" | "bank_transfer";
type ChosenMethod = ManualMethod | "card_gateway";

export function AdCreditTopupCard({
  walletId,
  tenantId,
}: {
  walletId: string | null;
  tenantId: string | null;
}) {
  const { t, locale } = useI18n();
  const methods = useTopupMethods();
  const topups = useMyAdCreditTopups(walletId);
  const submit = useSubmitAdCreditTopup(tenantId);
  const cancel = useCancelAdCreditTopup();
  const card = useStartCardCheckout(tenantId);

  const [method, setMethod] = useState<ChosenMethod>("sham_cash");
  const [pack, setPack] = useState<number | null>(null);
  const [credits, setCredits] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<TopupCurrency>("SYP");
  const [transferRef, setTransferRef] = useState("");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);

  const sham = methods.data?.shamCash;
  const gateway = methods.data?.cardGateway;
  const cardPacks = gateway?.enabled ? (gateway.packs ?? []) : [];
  const instructions = locale === "en" ? sham?.instructionsEn : sham?.instructionsAr;
  const pending = (topups.data ?? []).filter((row) => row.status === "pending");

  // The provider redirects back here; the wallet is credited by the webhook, so
  // this only tells the provider what to expect.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("checkout");
    if (outcome !== "success" && outcome !== "cancel") return;
    if (outcome === "success") toast.success(t("market.adCredit.topup.card.returned"));
    else toast.info(t("market.adCredit.topup.card.cancelled"));
    params.delete("checkout");
    const query = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );
  }, [t]);

  function payByCard() {
    const chosen = pack ?? cardPacks[0]?.credits ?? null;
    if (!chosen) {
      toast.error(t("market.adCredit.topup.card.noPacks"));
      return;
    }
    card.mutate(chosen, {
      onError: (error: unknown) => {
        const code = error instanceof Error ? error.message : String(error);
        const known: Record<string, string> = {
          not_configured: t("market.adCredit.topup.card.errNotConfigured"),
          gateway_disabled: t("market.adCredit.topup.card.errNotConfigured"),
          pending_topup_exists: t("market.adCredit.topup.errPending"),
          unknown_pack: t("market.adCredit.topup.card.errPack"),
        };
        const match = Object.keys(known).find((key) => code.includes(key));
        toast.error(match ? known[match]! : t("market.adCredit.topup.card.errFailed"));
      },
    });
  }

  function reset() {
    setCredits("");
    setAmount("");
    setTransferRef("");
    setNote("");
    setReceipt(null);
  }

  function send() {
    const parsedCredits = Number(credits);
    const parsedAmount = Number(amount);
    if (!Number.isInteger(parsedCredits) || parsedCredits <= 0) {
      toast.error(t("market.adCredit.topup.errCredits"));
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error(t("market.adCredit.topup.errAmount"));
      return;
    }
    if (transferRef.trim().length < 3) {
      toast.error(t("market.adCredit.topup.errRef"));
      return;
    }

    submit.mutate(
      {
        method: method as ManualMethod,
        credits: parsedCredits,
        amount: parsedAmount,
        currency,
        transferRef: transferRef.trim(),
        senderNote: note.trim() || null,
        receipt,
      },
      {
        onSuccess: () => {
          toast.success(t("market.adCredit.topup.sent"));
          reset();
        },
        onError: (error: unknown) => {
          const code = error instanceof Error ? error.message : String(error);
          const known: Record<string, string> = {
            pending_topup_exists: t("market.adCredit.topup.errPending"),
            receipt_too_large: t("market.adCredit.topup.errReceiptSize"),
            receipt_invalid: t("market.adCredit.topup.errReceiptType"),
          };
          toast.error(
            Object.keys(known).find((key) => code.includes(key))
              ? known[Object.keys(known).find((key) => code.includes(key))!]!
              : t("market.adCredit.topup.errFailed"),
          );
        },
      },
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-section font-semibold">{t("market.adCredit.topup.title")}</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              "sham_cash",
              "bank_transfer",
              ...(cardPacks.length > 0 ? (["card_gateway"] as const) : []),
            ] as ChosenMethod[]
          ).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMethod(value)}
              aria-pressed={method === value}
              className={`rounded-xl border px-3 py-2 text-sm ${
                method === value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
              }`}
            >
              {t(`market.adCredit.topup.method.${value}`)}
            </button>
          ))}
        </div>

        {method === "sham_cash" && (
          <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
            {methods.isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : sham?.walletId ? (
              <>
                <p className="text-desc text-muted-foreground">
                  {t("market.adCredit.topup.platformWallet")}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-semibold tabular-nums" dir="ltr">
                    {sham.walletId}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => {
                      void navigator.clipboard?.writeText(sham.walletId);
                      toast.success(t("market.adCredit.topup.copied"));
                    }}
                  >
                    <Copy className="size-3.5" aria-hidden />
                    {t("market.adCredit.topup.copy")}
                  </Button>
                  {sham.walletName && <Badge variant="outline">{sham.walletName}</Badge>}
                </div>
                {instructions && (
                  <p className="mt-2 whitespace-pre-line text-desc text-muted-foreground">
                    {instructions}
                  </p>
                )}
              </>
            ) : (
              <p className="text-desc text-muted-foreground">
                {t("market.adCredit.topup.walletMissing")}
              </p>
            )}
          </div>
        )}

        {method === "bank_transfer" && (
          <p className="text-desc text-muted-foreground">{t("market.adCredit.topup.bankNotice")}</p>
        )}

        {method === "card_gateway" && (
          <div className="space-y-3">
            <p className="text-desc text-muted-foreground">
              {t("market.adCredit.topup.card.notice")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {cardPacks.map((option) => {
                const selected = (pack ?? cardPacks[0]?.credits) === option.credits;
                return (
                  <button
                    key={option.credits}
                    type="button"
                    onClick={() => setPack(option.credits)}
                    aria-pressed={selected}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${
                      selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <span className="font-semibold">{formatNumber(option.credits)}</span>
                    <span className="text-muted-foreground tabular-nums" dir="ltr">
                      {formatNumber(option.amount)} {gateway?.currency ?? "SAR"}
                    </span>
                  </button>
                );
              })}
            </div>
            <Button onClick={payByCard} disabled={card.isPending} className="h-10">
              {card.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <CreditCard className="size-4" aria-hidden />
              )}
              {t("market.adCredit.topup.card.pay")}
            </Button>
          </div>
        )}

        {method !== "card_gateway" && (
          <>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="adc-credits">{t("market.adCredit.topup.credits")}</Label>
            <Input
              id="adc-credits"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              inputMode="numeric"
              dir="ltr"
              className="h-10"
            />
          </div>
          <div>
            <Label htmlFor="adc-amount">{t("market.adCredit.topup.amount")}</Label>
            <div className="flex gap-2">
              <Input
                id="adc-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                dir="ltr"
                className="h-10"
              />
              <select
                aria-label={t("market.adCredit.topup.currency")}
                value={currency}
                onChange={(e) => setCurrency(e.target.value as TopupCurrency)}
                className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                dir="ltr"
              >
                {TOPUP_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="adc-ref">{t("market.adCredit.topup.transferRef")}</Label>
            <Input
              id="adc-ref"
              value={transferRef}
              onChange={(e) => setTransferRef(e.target.value)}
              dir="ltr"
              className="h-10"
            />
          </div>
          <div>
            <Label htmlFor="adc-receipt">{t("market.adCredit.topup.receipt")}</Label>
            <Input
              id="adc-receipt"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
              className="h-10"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="adc-note">{t("market.adCredit.topup.note")}</Label>
          <Textarea
            id="adc-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
          />
        </div>

        <p className="text-desc text-muted-foreground">{t("market.adCredit.topup.reviewNotice")}</p>

        <Button onClick={send} disabled={submit.isPending} className="h-10">
          {submit.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="size-4" aria-hidden />
          )}
          {t("market.adCredit.topup.submit")}
        </Button>
          </>
        )}

        {pending.length > 0 && (
          <p className="text-desc text-gold-dark">
            {t("market.adCredit.topup.hasPending")}
          </p>
        )}

        {(topups.data ?? []).length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{t("market.adCredit.topup.myRequests")}</h3>
            <ul className="divide-y divide-border">
              {(topups.data ?? []).map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="text-sm">
                      {t(`market.adCredit.topup.method.${row.method}`)}
                      <span className="text-muted-foreground">
                        {" · "}
                        {formatNumber(row.credits)}
                      </span>
                      {row.transfer_ref && (
                        <span className="text-muted-foreground" dir="ltr">
                          {" · "}
                          {row.transfer_ref}
                        </span>
                      )}
                    </p>
                    <p className="text-desc text-muted-foreground">
                      {formatDateTime(row.created_at)}
                      {row.status === "rejected" && row.reject_reason
                        ? ` — ${row.reject_reason}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={row.status === "approved" ? "default" : "outline"}>
                      {t(`market.adCredit.topup.status.${row.status}`)}
                    </Badge>
                    {row.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={cancel.isPending}
                        onClick={() =>
                          cancel.mutate(row.id, {
                            onSuccess: () => toast.success(t("market.adCredit.cancelled")),
                            onError: () => toast.error(t("market.adCredit.cancelFailed")),
                          })
                        }
                      >
                        {t("market.adCredit.cancel")}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

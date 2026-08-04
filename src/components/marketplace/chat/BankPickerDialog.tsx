import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Landmark } from "lucide-react";

import { useI18n } from "@/i18n";
import { bankAccountsFor, chatErrorKey, shareBank } from "@/lib/mkt-chat";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  conversationId: string;
  accountKey: string | null;
  /** The bank request this share answers, when the peer asked first. */
  requestMessageId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShared: () => void;
}

/** Only verified accounts of the account the user is acting as can be shared. */
export function BankPickerDialog({
  conversationId,
  accountKey,
  requestMessageId,
  open,
  onOpenChange,
  onShared,
}: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  const accounts = useQuery({
    queryKey: ["mkt", "bank-accounts", accountKey],
    enabled: open && !!accountKey,
    queryFn: () => bankAccountsFor(accountKey!),
  });

  async function share(id: string) {
    setBusy(true);
    try {
      await shareBank(conversationId, id, accountKey!, requestMessageId ?? null);
      onOpenChange(false);
      onShared();
    } catch (error) {
      toast.error(t(chatErrorKey(error)));
    } finally {
      setBusy(false);
    }
  }

  const list = accounts.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("market.chat.bank.chooseAccount")}</DialogTitle>
          <DialogDescription>{t("market.chat.bank.notice")}</DialogDescription>
        </DialogHeader>

        {accounts.isLoading ? (
          <div className="h-16 animate-pulse rounded-lg bg-muted" />
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("market.chat.bank.none")}</p>
        ) : (
          <ul className="space-y-2">
            {list.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void share(a.id)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-start hover:bg-accent"
                >
                  <Landmark className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.bank_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {a.beneficiary_name} · <span dir="ltr">****{a.last4}</span>
                    </span>
                  </span>
                  <BadgeCheck className="size-4 shrink-0 text-primary" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

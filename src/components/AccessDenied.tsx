import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";

export type AccessDenialReason =
  /** Signed in, but not allowed here. */
  | "forbidden"
  /** Session gone or expired. */
  | "session"
  /** Signed in, but no valid active account (or membership ended). */
  | "account"
  /** The item belongs to another account the user may enter. */
  | "other-account"
  /** Feature not available for this account. */
  | "unavailable";

/**
 * One neutral screen for every blocked case. It deliberately never names the
 * owning entity, the item, the table, or the policy that blocked the request —
 * only what the user can do next.
 */
export function AccessDenied({
  reason = "forbidden",
  action,
}: {
  reason?: AccessDenialReason;
  action?: { label: string; onClick: () => void } | undefined;
}) {
  const { t } = useI18n();

  const message = t(`market.access.${reason}`);

  return (
    <div className="surface mx-auto max-w-md p-6 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-xl bg-secondary text-muted-foreground">
        <ShieldAlert className="size-5" aria-hidden />
      </span>
      <h2 className="text-section mt-3 font-bold text-foreground">{t("market.access.title")}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{message}</p>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {action && (
          <Button size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
        {reason === "session" ? (
          <Button size="sm" variant="outline" asChild>
            <Link to="/auth">{t("market.signIn")}</Link>
          </Button>
        ) : reason === "account" || reason === "other-account" ? (
          <Button size="sm" variant="outline" asChild>
            <Link to="/choose-account">{t("market.entry.change")}</Link>
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" asChild>
          <Link to="/">{t("market.access.home")}</Link>
        </Button>
      </div>
    </div>
  );
}

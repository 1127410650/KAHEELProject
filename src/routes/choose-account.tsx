import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Building2, Check, Loader2, LogOut, Plus, User } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { isSigningOut, useSignOut } from "@/lib/auth-signout";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { useActiveAccount, type MktAccount } from "@/lib/mkt-account";
import { VerifiedBadge } from "@/components/marketplace/ListingCard";
import { isSafeInternalPath, safeInternalPath } from "@/lib/safe-next";
import { Button } from "@/components/ui/button";

interface ChooseSearch {
  next?: string | undefined;
  /** Tenant id of a business just created, highlighted once and never auto-selected. */
  created?: string | undefined;
}

/**
 * Active-account selection for the public marketplace.
 *
 * Canonical marketplace route. `/select-account` is a different screen: it picks
 * the administrative workspace (tenant) of the internal ERP. Here the choice is
 * "personal account or one of my businesses", and it is always re-verified
 * server-side (`mkt_account_context`) before it becomes active — localStorage
 * only remembers the last key.
 */
export const Route = createFileRoute("/choose-account")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): ChooseSearch => {
    const raw = search["next"];
    const created = search["created"];
    // Only internal, non protocol-relative paths survive: no open redirect.
    return {
      ...(typeof raw === "string" && isSafeInternalPath(raw) ? { next: raw } : {}),
      ...(typeof created === "string" && /^[0-9a-f-]{36}$/i.test(created) ? { created } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "اختر الحساب — سوق تحقّق" },
      {
        name: "description",
        content:
          "اختر الحساب الذي تريد استخدامه في سوق تحقّق: حسابك الشخصي أو إحدى منشآتك، وتعمل المنصة تحت هذا الحساب فقط.",
      },
      { property: "og:title", content: "اختر الحساب — سوق تحقّق" },
      { property: "og:description", content: "الدخول إلى السوق تحت حساب واحد بعزل كامل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChooseAccountPage,
});

function AccountAvatar({ account }: { account: MktAccount }) {
  const Icon = account.kind === "business" ? Building2 : User;
  if (account.avatar_url) {
    return (
      <img
        src={account.avatar_url}
        alt=""
        className="size-10 shrink-0 rounded-full object-cover sm:size-11"
        loading="lazy"
      />
    );
  }
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground sm:size-11">
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

/**
 * One selectable account. A real <button> so Enter/Space work and focus is
 * visible; the whole card is the touch target (≥44px on phones).
 */
function AccountCard({
  account,
  current,
  highlight,
  pending,
  disabled,
  onSelect,
}: {
  account: MktAccount;
  current: boolean;
  highlight?: boolean;
  pending: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const name = account.name || t("market.account.fallbackName");
  const meta = [
    t(`market.entry.kind.${account.kind}`),
    account.activity ?? null,
    account.city ?? null,
    account.kind === "business" && account.role ? t(`team.roles.${account.role}`) : null,
  ].filter(Boolean) as string[];

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={t("market.entry.selectAria").replace("{name}", name)}
      aria-current={current ? "true" : undefined}
      onClick={onSelect}
      className={`flex h-full w-full min-w-0 items-start gap-3 rounded-xl border bg-card ${highlight ? "border-primary ring-2 ring-primary/30" : "border-border"} p-3 text-start transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60 sm:p-3.5`}
    >
      <AccountAvatar account={account} />
      <span className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
        <span className="wrap-anywhere block text-sm font-semibold leading-snug text-foreground">
          {name}
        </span>
        <VerifiedBadge status={account.verification_status} size="xs" />
        <span className="wrap-anywhere mt-0.5 block text-[11px] leading-snug text-muted-foreground sm:text-xs">
          {meta.join(" · ")}
        </span>
        {highlight && !current && (
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
            <Check className="size-3.5" aria-hidden />
            {t("market.entry.justCreated")}
          </span>
        )}
        {current && (
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
            <Check className="size-3.5" aria-hidden />
            {t("market.entry.current")}
          </span>
        )}
      </span>
      {pending ? (
        <Loader2 className="mt-1 size-4 shrink-0 animate-spin text-primary" aria-hidden />
      ) : null}
    </button>
  );
}

function ChooseAccountPage() {
  const { t } = useI18n();
  const { session, loading: sessionLoading } = useSession();
  const { next: rawNext, created } = Route.useSearch();
  // Re-sanitised here as well: never navigate to a value straight from the URL.
  const next = isSafeInternalPath(rawNext) ? rawNext : undefined;
  const safeNext = safeInternalPath(next);
  // A `next` that points back at the picker would keep the user trapped here.
  const target = safeNext.startsWith("/choose-account") ? "/" : safeNext;

  const navigate = useNavigate();
  const { accounts, account: activeAccount, loading, unavailable, select } = useActiveAccount();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionLoading && !session && !isSigningOut()) {
      // Keep the intended destination so signing in lands back here.
      const back = `/choose-account${next ? `?next=${encodeURIComponent(next)}` : ""}`;
      void navigate({ href: `/auth?next=${encodeURIComponent(back)}`, replace: true });
    }
  }, [sessionLoading, session, navigate, next]);


  const personal = useMemo(() => accounts.filter((a) => a.kind === "individual"), [accounts]);
  const businesses = useMemo(() => accounts.filter((a) => a.kind === "business"), [accounts]);

  /** Leaves the picker for good: never stay on /choose-account after success. */
  function leave() {
    void navigate({ href: target, replace: true }).catch(() => {
      if (typeof window !== "undefined") window.location.replace(target);
    });
  }

  async function enter(account: MktAccount) {
    if (pending) return; // rapid double clicks pick one account only
    // The current account needs no server round-trip and no new session.
    if (activeAccount?.account_key === account.account_key) {
      leave();
      return;
    }
    setPending(account.account_key);
    let ok = false;
    try {
      ok = await select(account.account_key);
    } catch {
      ok = false;
    }
    setPending(null);
    if (!ok) {
      // Stay here with the card re-enabled; the session and the current account
      // are untouched, and language/theme are never cleared.
      toast.error(t("market.entry.switchFailed"));
      return;
    }
    leave();
  }


  const signOut = useSignOut();

  const grid =
    "mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3";

  return (
    <div className="mx-auto w-full max-w-xl px-3 py-6 sm:py-10 lg:max-w-4xl xl:max-w-5xl">
      <div className="mb-5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="wrap-anywhere text-lg font-bold leading-tight sm:text-2xl">
            {t("market.entry.title")}
          </h1>
          <p className="wrap-anywhere mt-1 text-xs leading-snug text-muted-foreground sm:text-sm">
            {t("market.entry.subtitle")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void signOut()}
          className="shrink-0 gap-1.5"
        >
          <LogOut className="size-4" aria-hidden />
          <span className="hidden sm:inline">{t("nav.signOut")}</span>
        </Button>
      </div>

      {loading ? (
        <div className="grid place-items-center rounded-xl border border-border bg-card p-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden />
        </div>
      ) : (
        <div className="space-y-5">
          <section aria-labelledby="acc-personal">
            <h2
              id="acc-personal"
              className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs"
            >
              {t("market.entry.personalSection")}
            </h2>
            <ul className={grid}>
              {personal.map((account) => (
                <li key={account.account_key} className="min-w-0">
                  <AccountCard
                    account={account}
                    current={activeAccount?.account_key === account.account_key}
                    pending={pending === account.account_key}
                    disabled={!!pending}
                    onSelect={() => void enter(account)}
                  />
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="acc-business">
            <h2
              id="acc-business"
              className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs"
            >
              {t("market.entry.businessSection")}
            </h2>
            {businesses.length === 0 ? (
              <p className="mt-2 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
                {t("market.entry.noBusinesses")}
              </p>
            ) : (
              <ul className={grid}>
                {businesses.map((account) => (
                  <li key={account.account_key} className="min-w-0">
                    <AccountCard
                      account={account}
                      current={activeAccount?.account_key === account.account_key}
                      highlight={!!created && account.tenant_id === created}
                      pending={pending === account.account_key}
                      disabled={!!pending}
                      onSelect={() => void enter(account)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="space-y-1">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/business/new" search={{ ...(next ? { next } : {}) }}>
                <Plus className="size-4" aria-hidden />
                {t("market.entry.newBusiness")}
              </Link>
            </Button>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {t("market.entry.newBusinessHint")}
            </p>
          </div>
        </div>
      )}

      {/*
        A signed-in user always works under one account, so there is no
        "browse without an account" escape hatch here: with a valid active
        account the only secondary action is cancelling back to it; with no
        active account yet, a choice must be made (personal is always there).
      */}
      {!loading && activeAccount ? (
        <p className="mt-5 text-center">
          <Button
            variant="ghost"
            size="sm"
            disabled={!!pending}
            onClick={() => void navigate({ href: target, replace: true })}
          >
            {t("market.entry.cancelToCurrent")}
          </Button>
        </p>
      ) : null}

    </div>
  );
}

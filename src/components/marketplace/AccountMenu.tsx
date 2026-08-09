import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  Check,
  ChevronDown,
  LogOut,
  ShieldCheck,
  Store,
  User,
} from "lucide-react";

import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { useActiveAccount, type MktAccount } from "@/lib/mkt-account";
import { hasUnsavedChanges } from "@/lib/unsaved-changes";
import { isPlatformAdmin } from "@/lib/mkt-admin";
import { useSignOut } from "@/lib/auth-signout";
import { useIsMobile } from "@/hooks/use-mobile";
import { VerifiedBadge } from "@/components/marketplace/ListingCard";
import { ACTIVITY_LINKS, MANAGE_LINKS, visibleLinks } from "@/lib/more-menu";
import { useOperationalAccess } from "@/lib/mkt-provider-onboarding";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Round avatar / logo, falling back to the identity-kind icon. */
function IdentityAvatar({ identity, size = "md" }: { identity: MktAccount; size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-7" : "size-9";
  const Icon =
    identity.classification === "system_admin"
      ? ShieldCheck
      : identity.classification === "service_provider"
        ? BriefcaseBusiness
        : identity.classification === "store"
          ? Store
          : User;
  if (identity.avatar_url) {
    return (
      <img
        src={identity.avatar_url}
        alt=""
        className={`${box} shrink-0 rounded-full object-cover`}
        loading="lazy"
      />
    );
  }
  return (
    <span
      className={`${box} grid shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground`}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

/** A stored value that is only a phone number is never shown as a name. */
function looksLikePhone(value: string): boolean {
  const compact = value.replace(/[\s\-()]/g, "");
  return /^\+?\d{6,}$/.test(compact);
}

/**
 * The header identity slot.
 *
 * Mobile (<768px) has NO account overlay any more: the slot is a plain link to
 * the accounts section of `/more`, which is the single account hub. Desktop
 * keeps a short dropdown (active account, switching, create a business, the
 * essential links, sign out) — it never becomes a full-page sheet.
 */
export function AccountMenu() {
  const { t } = useI18n();
  const { session } = useSession();
  const { account: active, accounts, can, select, loading: accountLoading } = useActiveAccount();
  const isMobile = useIsMobile();
  const centralSignOut = useSignOut();
  const navigate = useNavigate();
  // Guards against a double tap while the server re-checks the membership.
  const [switching, setSwitching] = useState<string | null>(null);
  const operational = useOperationalAccess(active?.account_key ?? null);

  const admin = useQuery({
    queryKey: ["mkt", "is-platform-admin", session?.user.id ?? null],
    enabled: !!session,
    staleTime: 5 * 60_000,
    queryFn: isPlatformAdmin,
  });

  // A signed-in visitor must NEVER see a header without an identity slot: that is
  // the forbidden hybrid state (bell + add, no account, no visitor buttons). While
  // the account is loading the slot is a skeleton; if it is missing or could not be
  // read (offline), the slot links to the account hub instead of vanishing.
  if (!session) return null;
  if (!active) {
    if (accountLoading) {
      return <Skeleton aria-hidden className="h-8 w-24 shrink-0 rounded-md sm:w-36" />;
    }
    return (
      <Button asChild size="sm" variant="outline" className="shrink-0">
        <Link
          to="/more"
          search={{ section: "accounts" }}
          aria-label={t("market.account.manageAccounts")}
          title={t("market.account.manageAccounts")}
        >
          <User className="size-4" aria-hidden />
          <span className="hidden sm:inline">{t("market.account.fallbackName")}</span>
        </Link>
      </Button>
    );
  }

  const rawName = (active.name ?? "").trim();
  const displayName =
    rawName && !looksLikePhone(rawName) ? rawName : t("market.account.fallbackName");

  const viewer = {
    signedIn: true,
    accountKind: active.kind,
    can,
    isPlatformAdmin: admin.data === true,
    providerApproved: active.kind === "business" && operational.data?.allowed === true,
    providerCapabilities: operational.data?.capabilities ?? [],
  };

  async function signOut() {
    if (!window.confirm(t("market.account.signOutConfirm"))) return;
    await centralSignOut();
  }

  /**
   * Switching is re-verified server-side, then `/me` resolves the right centre:
   * provider bookings, seller store, business profile or personal profile.
   */
  async function switchAccount(accountKey: string) {
    if (accountKey === active?.account_key || switching) return;
    if (hasUnsavedChanges() && !window.confirm(t("market.account.unsavedWarning"))) return;
    setSwitching(accountKey);
    try {
      const ok = await select(accountKey);
      if (!ok) toast.error(t("market.entry.switchFailed"));
      else void navigate({ to: "/me" });
    } finally {
      setSwitching(null);
    }
  }

  // Personal account first, then the businesses the user is authorised for.
  const switchList = [...accounts].sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "individual" ? -1 : 1,
  );

  // Short desktop list: the two most-used activity rows plus account management.
  const desktopLinks = [
    ...visibleLinks(ACTIVITY_LINKS, viewer).slice(0, 2),
    ...visibleLinks(MANAGE_LINKS, viewer),
  ];

  const identityBlock = (
    <span className="flex min-w-0 items-center gap-2">
      <IdentityAvatar identity={active} size="sm" />
      <span className="truncate text-xs">{displayName}</span>
    </span>
  );

  if (isMobile) {
    // No sheet, no dialog: straight to the accounts section of the hub page.
    return (
      <Button
        asChild
        variant="outline"
        size="sm"
        className="h-9 max-w-[120px] shrink-0 justify-start gap-1.5 ps-1.5"
      >
        <Link
          to="/more"
          search={{ section: "accounts" }}
          aria-label={t("market.account.manageAccounts")}
          title={displayName}
        >
          {identityBlock}
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={t("market.account.menu")}
          className="h-9 max-w-[190px] justify-between gap-1.5 ps-1.5"
        >
          {identityBlock}
          <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="flex items-center gap-2 px-2 py-2">
          <IdentityAvatar identity={active} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground">
              {displayName}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {t(`market.entry.classification.${active.classification}`)}
              {active.verification_status === "approved" ? (
                <VerifiedBadge status={active.verification_status} size="xs" />
              ) : null}
            </span>
          </span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t("market.account.switchTitle")}
        </DropdownMenuLabel>
        {switchList.map((item) => (
          <DropdownMenuItem
            key={item.account_key}
            disabled={!!switching}
            onSelect={(e) => {
              e.preventDefault();
              void switchAccount(item.account_key);
            }}
            className="gap-2 text-xs"
          >
            <IdentityAvatar identity={item} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{item.name}</span>
              <span className="block text-[10px] text-muted-foreground">
                {t(`market.entry.classification.${item.classification}`)}
              </span>
            </span>
            {item.account_key === active.account_key ? (
              <Check className="size-4 shrink-0 text-primary" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
        {active.classification === "customer" ? (
          <DropdownMenuItem asChild className="gap-2 text-xs">
            <Link to="/join" search={{ kind: "seller" }}>
              <Store className="size-4 text-muted-foreground" aria-hidden />
              {t("market.more.links.joinSeller")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        {desktopLinks.map((link) => (
          <DropdownMenuItem key={link.key} asChild>
            <Link to={link.to} className="gap-2 text-xs">
              <link.icon className="size-4 text-muted-foreground" aria-hidden />
              <span className="min-w-0 truncate">{t(link.labelKey)}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()} className="gap-2 text-xs">
          <LogOut className="size-4 text-muted-foreground" aria-hidden />
          {t("nav.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

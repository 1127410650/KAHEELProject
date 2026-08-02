import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Building2,
  ChevronDown,
  Flag,
  Heart,
  LayoutList,
  LogOut,
  MessageSquare,
  Repeat,
  Settings,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
  X,
} from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { useActiveAccount, type MktAccount } from "@/lib/mkt-account";
import { useUnreadAlerts, useUnreadMessages } from "@/lib/mkt-unread";
import { hasUnsavedChanges } from "@/lib/unsaved-changes";
import { canSeeLink } from "@/lib/routes-map";
import { isPlatformAdmin } from "@/lib/mkt-admin";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { VerifiedBadge } from "@/components/marketplace/ListingCard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** Round avatar / logo, falling back to the identity-kind icon. */
function IdentityAvatar({
  identity,
  size = "md",
}: {
  identity: MktAccount;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "size-7" : "size-9";
  const Icon = identity.kind === "business" ? Building2 : User;
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

type MenuLink = {
  to: string;
  label: string;
  icon: typeof User;
  badge?: number;
};

/**
 * The one and only account menu: a dropdown on desktop and a bottom sheet on
 * mobile, both rendered from the same data. It shows the active account, links
 * to the approved account-selection screen, groups activity and management
 * links, and signs out. Nothing here grants access — every path stays guarded.
 */
export function AccountMenu() {
  const { t } = useI18n();
  const { session } = useSession();
  const { account: active, accounts, clear, can } = useActiveAccount();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const unreadMessages = useUnreadMessages(active);
  const unreadAlerts = useUnreadAlerts();
  const admin = useQuery({
    queryKey: ["mkt", "is-platform-admin", session?.user.id ?? null],
    enabled: !!session,
    staleTime: 5 * 60_000,
    queryFn: isPlatformAdmin,
  });

  if (!session || !active) return null;

  const rawName = (active.name ?? "").trim();
  const displayName =
    rawName && !looksLikePhone(rawName) ? rawName : t("market.account.fallbackName");

  const viewer = {
    signedIn: true,
    accountKind: active.kind,
    can,
    isPlatformAdmin: admin.data === true,
  };
  const allowed = (links: MenuLink[]) => links.filter((l) => canSeeLink(l.to, viewer));

  async function signOut() {
    clear();
    await supabase.auth.signOut();
    void navigate({ to: "/" });
  }

  function changeAccount(event: { preventDefault: () => void }) {
    if (
      hasUnsavedChanges() &&
      !window.confirm(t("market.account.unsavedWarning"))
    ) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    clear();
    void navigate({ to: "/choose-account" });
  }

  const messagesBadge = unreadMessages.data ?? 0;
  const alertsBadge = unreadAlerts.data ?? 0;

  const activityLinks = allowed([
    { to: "/dashboard/my-ads", label: t("market.dash.myAds"), icon: LayoutList },
    {
      to: "/dashboard/messages",
      label: t("market.dash.messages"),
      icon: MessageSquare,
      badge: messagesBadge,
    },
    {
      to: "/dashboard/notifications",
      label: t("market.dash.notifications"),
      icon: Bell,
      badge: alertsBadge,
    },
    { to: "/dashboard/favorites", label: t("market.dash.favorites"), icon: Heart },
    { to: "/dashboard/reports", label: t("market.dash.reports"), icon: Flag },
    { to: "/dashboard/violations", label: t("market.dash.violations"), icon: ShieldAlert },
  ]);

  const manageLinks = allowed(
    active.kind === "business"
      ? [
          {
            to: "/dashboard/business",
            label: t("market.identity.manageBusiness"),
            icon: Building2,
          },
          { to: "/team", label: t("market.account.members"), icon: Users },
          { to: "/dashboard/profile", label: t("market.identity.managePersonal"), icon: User },
          { to: "/settings", label: t("market.more.settings"), icon: Settings },
        ]
      : [
          { to: "/dashboard/profile", label: t("market.identity.managePersonal"), icon: User },
          { to: "/settings", label: t("market.more.settings"), icon: Settings },
          { to: "/choose-account", label: t("market.biz.addBusiness"), icon: Building2 },
        ],
  ).concat(
    viewer.isPlatformAdmin
      ? [{ to: "/admin", label: t("market.account.adminPanel"), icon: ShieldCheck }]
      : [],
  );

  const trigger = (
    <Button
      variant="outline"
      size="sm"
      aria-label={t("market.account.menu")}
      className="h-9 max-w-[120px] justify-between gap-1.5 ps-1.5 sm:max-w-[190px]"
    >
      <IdentityAvatar identity={active} size="sm" />
      <span className="truncate text-xs">{displayName}</span>
      <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
    </Button>
  );

  const currentBlock = (
    <div className="flex items-center gap-2 px-2 py-2">
      <IdentityAvatar identity={active} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">
          {displayName}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {t(`market.entry.kind.${active.kind}`)}
          {active.verification_status === "approved" ? (
            <VerifiedBadge status={active.verification_status} size="xs" />
          ) : null}
        </span>
      </span>
    </div>
  );

  const Badge = ({ value }: { value?: number | undefined }) =>
    value && value > 0 ? (
      <span className="ms-auto min-w-5 rounded-full bg-primary px-1.5 text-center text-[10px] font-semibold leading-5 text-primary-foreground">
        {value > 99 ? "99+" : value}
      </span>
    ) : null;

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          hideClose
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <SheetTitle className="text-base">{t("market.account.menu")}</SheetTitle>
            <SheetClose className="rounded-sm p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="size-4" aria-hidden />
              <span className="sr-only">{t("common.close")}</span>
            </SheetClose>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-card">{currentBlock}</div>

          <div className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={changeAccount}
              className="flex w-full items-center gap-2.5 px-3 py-3 text-start text-sm text-foreground hover:bg-accent"
            >
              <Repeat className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              {t("market.entry.change")}
            </button>
          </div>

          <p className="mt-4 px-1 text-xs font-semibold text-muted-foreground">
            {t("market.account.activityTitle")}
          </p>
          <div className="mt-1.5 overflow-hidden rounded-xl border border-border bg-card">
            {activityLinks.map((link) => (
              <SheetClose asChild key={link.to}>
                <Link
                  to={link.to}
                  className="flex items-center gap-2.5 border-b border-border px-3 py-3 text-sm text-foreground last:border-b-0 hover:bg-accent"
                >
                  <link.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 truncate">{link.label}</span>
                  <Badge value={link.badge} />
                </Link>
              </SheetClose>
            ))}
          </div>

          <p className="mt-4 px-1 text-xs font-semibold text-muted-foreground">
            {t("market.account.manageTitle")}
          </p>
          <div className="mt-1.5 overflow-hidden rounded-xl border border-border bg-card">
            {manageLinks.map((link) => (
              <SheetClose asChild key={link.to}>
                <Link
                  to={link.to}
                  className="flex items-center gap-2.5 border-b border-border px-3 py-3 text-sm text-foreground last:border-b-0 hover:bg-accent"
                >
                  <link.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 truncate">{link.label}</span>
                </Link>
              </SheetClose>
            ))}
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center gap-2.5 border-t border-border px-3 py-3 text-sm text-foreground hover:bg-accent"
            >
              <LogOut className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              {t("nav.signOut")}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {currentBlock}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(e) => changeAccount(e)} className="gap-2 text-xs">
          <Repeat className="size-4 text-muted-foreground" aria-hidden />
          {t("market.entry.change")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t("market.account.activityTitle")}
        </DropdownMenuLabel>
        {activityLinks.map((link) => (
          <DropdownMenuItem key={link.to} asChild>
            <Link to={link.to} className="gap-2 text-xs">
              <link.icon className="size-4 text-muted-foreground" aria-hidden />
              <span className="min-w-0 truncate">{link.label}</span>
              <Badge value={link.badge} />
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t("market.account.manageTitle")}
        </DropdownMenuLabel>
        {manageLinks.map((link) => (
          <DropdownMenuItem key={link.to} asChild>
            <Link to={link.to} className="gap-2 text-xs">
              <link.icon className="size-4 text-muted-foreground" aria-hidden />
              <span className="min-w-0 truncate">{link.label}</span>
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

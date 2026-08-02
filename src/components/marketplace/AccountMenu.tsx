import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  Flag,
  Heart,
  LayoutList,
  LogOut,
  MessageSquare,
  ReceiptText,
  Repeat,
  Settings,
  ShieldAlert,
  User,
  X,
} from "lucide-react";


import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { useActiveAccount, type MktAccount } from "@/lib/mkt-account";
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

/**
 * The only place in the marketplace where the account appears: it shows the
 * active identity, switches between the personal account and the businesses the
 * user may represent, and links to account management and sign-out. Switching is
 * a display choice only — every write is still authorised server-side.
 */
export function AccountMenu() {
  const { t } = useI18n();
  const { session } = useSession();
  const { account: active } = useActiveAccount();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  if (!session || !active) return null;

  const displayName = active.name || t("market.account.fallbackName");

  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/marketplace" });
  }

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
        <span className="block truncate text-sm font-semibold text-foreground">{displayName}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {t(`market.entry.kind.${active.kind}`)}
          <VerifiedBadge status={active.verification_status} size="xs" />
        </span>
      </span>
      <Check className="size-4 shrink-0 text-primary" aria-hidden />
    </div>
  );

  type MenuLink = { to: string; label: string; icon: typeof User };

  // Everything that used to sit in per-page tab bars now lives here, in two
  // groups: what the user does in the market, and what they manage.
  const activityLinks: MenuLink[] = [
    { to: "/dashboard/my-ads", label: t("market.dash.myAds"), icon: LayoutList },
    { to: "/dashboard/requests", label: t("market.dash.requests"), icon: ReceiptText },
    { to: "/dashboard/messages", label: t("market.dash.messages"), icon: MessageSquare },
    { to: "/dashboard/favorites", label: t("market.dash.favorites"), icon: Heart },
    { to: "/dashboard/notifications", label: t("market.dash.notifications"), icon: Bell },
    { to: "/dashboard/reports", label: t("market.dash.reports"), icon: Flag },
    { to: "/dashboard/violations", label: t("market.dash.violations"), icon: ShieldAlert },
  ];

  const manageLinks: MenuLink[] = [
    { to: "/dashboard/profile", label: t("market.identity.managePersonal"), icon: User },
    ...(active.kind === "business"
      ? [
          {
            to: "/dashboard/business",
            label: t("market.identity.manageBusiness"),
            icon: Building2,
          },
        ]
      : []),
    { to: "/choose-account", label: t("market.biz.addBusiness"), icon: Building2 },
    { to: "/more", label: t("market.more.settings"), icon: Settings },
  ];


  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          hideClose
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl"
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
            <Link
              to="/choose-account"
              className="flex items-center gap-2.5 px-3 py-3 text-sm text-foreground hover:bg-accent"
            >
              <Repeat className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              {t("market.entry.change")}
            </Link>
          </div>

          <p className="mt-4 px-1 text-xs font-semibold text-muted-foreground">
            {t("market.account.activityTitle")}
          </p>
          <div className="mt-1.5 overflow-hidden rounded-xl border border-border bg-card">
            {activityLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center gap-2.5 border-b border-border px-3 py-3 text-sm text-foreground last:border-b-0 hover:bg-accent"
              >
                <link.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {link.label}
              </Link>
            ))}
          </div>

          <p className="mt-4 px-1 text-xs font-semibold text-muted-foreground">
            {t("market.account.manageTitle")}
          </p>
          <div className="mt-1.5 overflow-hidden rounded-xl border border-border bg-card">
            {manageLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center gap-2.5 border-b border-border px-3 py-3 text-sm text-foreground last:border-b-0 hover:bg-accent"
              >
                <link.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {link.label}
              </Link>
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
        <DropdownMenuItem asChild>
          <Link to="/choose-account" className="gap-2 text-xs">
            <Repeat className="size-4 text-muted-foreground" aria-hidden />
            {t("market.entry.change")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t("market.account.activityTitle")}
        </DropdownMenuLabel>
        {activityLinks.map((link) => (
          <DropdownMenuItem key={link.to} asChild>
            <Link to={link.to} className="gap-2 text-xs">
              <link.icon className="size-4 text-muted-foreground" aria-hidden />
              {link.label}
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
              {link.label}
            </Link>
          </DropdownMenuItem>
        ))}

        <DropdownMenuItem onSelect={() => void signOut()} className="gap-2 text-xs">
          <LogOut className="size-4 text-muted-foreground" aria-hidden />
          {t("nav.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

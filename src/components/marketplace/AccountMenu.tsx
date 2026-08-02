import { Link, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Check,
  ChevronDown,
  LogOut,
  Settings,
  User,
} from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { useActiveIdentity, type MktIdentity } from "@/lib/mkt-identity";
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
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** Round avatar / logo, falling back to the identity-kind icon. */
function IdentityAvatar({
  identity,
  size = "md",
}: {
  identity: MktIdentity;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "size-7" : "size-9";
  const Icon = identity.kind === "business" ? Building2 : User;
  if (identity.avatarUrl) {
    return (
      <img
        src={identity.avatarUrl}
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
  const { identities, active, select } = useActiveIdentity();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  if (!session || !active) return null;

  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/marketplace" });
  }

  const trigger = (
    <Button
      variant="outline"
      size="sm"
      aria-label={t("market.account.menu")}
      className="h-9 max-w-[190px] justify-between gap-1.5 ps-1.5"
    >
      <IdentityAvatar identity={active} size="sm" />
      <span className="hidden truncate text-xs sm:inline">{active.name}</span>
      <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
    </Button>
  );

  const currentBlock = (
    <div className="flex items-center gap-2 px-2 py-2">
      <IdentityAvatar identity={active} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{active.name}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {t(`market.identity.${active.kind}`)}
          <VerifiedBadge status={active.verificationStatus} size="xs" />
        </span>
      </span>
      <Check className="size-4 shrink-0 text-primary" aria-hidden />
    </div>
  );

  const manageLinks: { to: string; label: string; icon: typeof User }[] = [
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
    { to: "/more", label: t("market.more.settings"), icon: Settings },
  ];

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetTitle className="text-sm">{t("market.account.menu")}</SheetTitle>
          <div className="mt-2 rounded-xl border border-border bg-card">{currentBlock}</div>

          <p className="mt-4 px-1 text-xs font-semibold text-muted-foreground">
            {t("market.account.switchTitle")}
          </p>
          <div className="mt-1.5 overflow-hidden rounded-xl border border-border bg-card">
            {identities.map((identity) => (
              <button
                key={identity.key}
                type="button"
                onClick={() => select(identity.key)}
                className="flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-start last:border-b-0 hover:bg-accent"
              >
                <IdentityAvatar identity={identity} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{identity.name}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {t(`market.identity.${identity.kind}`)}
                  </span>
                </span>
                {identity.key === active.key && (
                  <Check className="size-4 shrink-0 text-primary" aria-hidden />
                )}
              </button>
            ))}
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
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
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t("market.account.switchTitle")}
        </DropdownMenuLabel>
        {identities.map((identity) => (
          <DropdownMenuItem
            key={identity.key}
            onSelect={() => select(identity.key)}
            className="gap-2"
          >
            <IdentityAvatar identity={identity} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{identity.name}</span>
              <span className="block text-[11px] text-muted-foreground">
                {t(`market.identity.${identity.kind}`)}
              </span>
            </span>
            {identity.key === active.key && (
              <Check className="size-4 shrink-0 text-primary" aria-hidden />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
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

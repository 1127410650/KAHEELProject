import { Link } from "@tanstack/react-router";
import { Building2, Check, ChevronDown, User } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { useActiveIdentity } from "@/lib/mkt-identity";
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

/**
 * Lets a signed-in user pick whether they act as themselves or on behalf of one
 * of their businesses. The choice is local and only decides which name new ads
 * carry — every write is still checked server-side.
 */
export function IdentitySwitcher({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const { session } = useSession();
  const { identities, active, select } = useActiveIdentity();

  if (!session || !active) return null;

  const Icon = active.kind === "business" ? Building2 : User;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={compact ? "w-full justify-between" : "max-w-[190px] justify-between"}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <Icon className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate text-xs">{active.name}</span>
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs">{t("market.identity.actingAs")}</DropdownMenuLabel>
        {identities.map((identity) => (
          <DropdownMenuItem
            key={identity.key}
            onSelect={() => select(identity.key)}
            className="gap-2"
          >
            {identity.kind === "business" ? (
              <Building2 className="size-4 shrink-0" aria-hidden />
            ) : (
              <User className="size-4 shrink-0" aria-hidden />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{identity.name}</span>
              <span className="block text-[11px] text-muted-foreground">
                {t(`market.identity.${identity.kind}`)}
              </span>
            </span>
            <VerifiedBadge status={identity.verificationStatus} size="xs" />
            {identity.key === active.key && <Check className="size-4 text-primary" aria-hidden />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/dashboard/profile" className="text-xs">
            {t("market.identity.managePersonal")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/dashboard/business" className="text-xs">
            {t("market.identity.manageBusiness")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

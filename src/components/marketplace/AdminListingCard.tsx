/**
 * Administrative listing card.
 *
 * The review queue shows ads as a comfortable card grid instead of long
 * full-width rows. A card carries only what a reviewer needs to triage: cover,
 * status, identity, price, place, dates, engagement counters and a compact
 * "advertiser safety" summary. Internal notes and any sensitive document data
 * stay out of the card — they live behind the file's own permissions.
 *
 * Actions call the exact same secure RPC as before (`mkt_review_listing` via
 * `reviewListing`); the card only chooses the wording that matches the current
 * status, and hides everything the status does not allow.
 */
import { Link } from "@tanstack/react-router";
import {
  Eye,
  Flag,
  ImageOff,
  Loader2,
  MessageSquareQuote,
  MoreHorizontal,
  ShieldQuestion,
} from "lucide-react";

import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";
import type { MktListing } from "@/lib/mkt";
import { priceLabel } from "@/lib/mkt";
import type { ListingReviewAction } from "@/lib/mkt-admin";
import { RISK_TONE, type AdvertiserSafety } from "@/lib/mkt-admin-safety";
import { AdminStatusBadge } from "@/components/marketplace/AdminStatusBadge";
import { AdminBusinessLink, AdminUserLink } from "@/components/marketplace/AdminEntityLink";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type QuickAction = {
  action: ListingReviewAction;
  labelKey: string;
  danger?: boolean;
};

/** Which review actions make sense for a status, in priority order. */
export function actionsForStatus(status: string): QuickAction[] {
  switch (status) {
    case "pending":
    case "needs_changes":
      return [
        { action: "approve", labelKey: "market.admin.approve" },
        { action: "return", labelKey: "market.admin.returnToOwner" },
        { action: "reject", labelKey: "market.admin.reject", danger: true },
        { action: "suspend", labelKey: "market.admin.suspend", danger: true },
      ];
    case "published":
    case "featured":
      return [
        { action: "suspend", labelKey: "market.admin.suspend", danger: true },
        { action: "return", labelKey: "market.admin.returnToOwner" },
        { action: "reject", labelKey: "market.admin.reject", danger: true },
      ];
    case "suspended":
      return [
        { action: "approve", labelKey: "market.admin.unsuspend" },
        { action: "return", labelKey: "market.admin.returnToOwner" },
      ];
    case "rejected":
    case "expired":
    case "archived":
    case "paused":
      return [
        { action: "approve", labelKey: "market.admin.republish" },
        { action: "return", labelKey: "market.admin.returnToOwner" },
        { action: "suspend", labelKey: "market.admin.suspend", danger: true },
      ];
    default:
      return [
        { action: "approve", labelKey: "market.admin.approve" },
        { action: "return", labelKey: "market.admin.returnToOwner" },
        { action: "reject", labelKey: "market.admin.reject", danger: true },
      ];
  }
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Eye;
  label: string;
  value: number;
  tone?: "critical" | undefined;
}) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 tabular-nums " +
        (tone === "critical" ? "text-admin-critical font-semibold" : "text-muted-foreground")
      }
      title={label}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="sr-only">{label}: </span>
      {value}
    </span>
  );
}

function SafetyStrip({
  safety,
  loading,
  href,
}: {
  safety: AdvertiserSafety | undefined;
  loading: boolean;
  href: React.ReactNode;
}) {
  const { t } = useI18n();
  if (loading) return <Skeleton className="h-12 w-full rounded-lg" />;
  if (!safety) return null;

  const tone = RISK_TONE[safety.risk_level];
  const frame =
    tone === "critical"
      ? "border-admin-critical/40 bg-admin-critical-soft"
      : tone === "urgent"
        ? "border-admin-urgent/40 bg-admin-urgent-soft"
        : tone === "pending"
          ? "border-admin-pending/40 bg-admin-pending-soft"
          : "border-admin-done/40 bg-admin-done-soft";

  return (
    <div className={"rounded-lg border p-2 " + frame}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1 text-[11px] font-bold text-foreground">
          <ShieldQuestion className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{t("admin.safety.title")}</span>
        </span>
        <AdminStatusBadge tone={tone} label={t(`admin.state.${safety.risk_level}`)} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <AdminStatusBadge
          tone={safety.verified ? "done" : "idle"}
          label={t(safety.verified ? "admin.safety.verified" : "admin.verification.unverified")}
        />
        {safety.reports_confirmed > 0 && (
          <AdminStatusBadge
            tone="critical"
            label={`${t("admin.safety.confirmedReports")}: ${safety.reports_confirmed}`}
          />
        )}
        {safety.banned && <AdminStatusBadge tone="critical" label={t("admin.safety.banned")} />}
        {safety.active_restrictions > 0 && (
          <AdminStatusBadge
            tone="urgent"
            label={`${t("admin.safety.restrictions")}: ${safety.active_restrictions}`}
          />
        )}
        {safety.violations > 0 && (
          <AdminStatusBadge
            tone="urgent"
            label={`${t("admin.safety.violations")}: ${safety.violations}`}
          />
        )}
        {safety.risk_level === "low" &&
          !safety.banned &&
          safety.violations === 0 &&
          safety.active_restrictions === 0 &&
          safety.reports_confirmed === 0 && (
            <AdminStatusBadge tone="done" label={t("admin.safety.clean")} />
          )}
      </div>
      <div className="mt-1.5 truncate text-[11px]">{href}</div>
    </div>
  );
}

export function AdminListingCard({
  listing,
  coverUrl,
  advertiserName,
  categoryName,
  safety,
  safetyLoading,
  canReview,
  busyAction,
  onAction,
}: {
  listing: MktListing;
  coverUrl: string | undefined;
  advertiserName: string;
  categoryName: string;
  safety: AdvertiserSafety | undefined;
  safetyLoading: boolean;
  canReview: boolean;
  busyAction: ListingReviewAction | null;
  onAction: (action: ListingReviewAction) => void;
}) {
  const { t, locale } = useI18n();
  const actions = canReview ? actionsForStatus(listing.status) : [];
  const primary = actions[0];
  const secondary = actions[1];
  const overflow = actions.slice(2);

  const expiresAt = listing.expires_at ?? null;
  const expiryDays = expiresAt
    ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
    : null;

  const advertiserLink =
    listing.tenant_id ? (
      <AdminBusinessLink id={listing.tenant_id} name={advertiserName} className="text-[11px]" />
    ) : (
      <AdminUserLink
        id={listing.owner_user_id}
        name={t("market.ad.individualAdvertiser")}
        className="text-[11px]"
      />
    );

  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <Link
        to="/admin/listings/$id"
        params={{ id: listing.id }}
        className="relative block aspect-[16/10] w-full overflow-hidden bg-muted"
        aria-label={listing.title}
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={listing.title}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImageOff className="size-6" aria-hidden />
            <span className="text-[11px]">{t("market.admin.noImage")}</span>
          </span>
        )}
        <span className="absolute top-2 start-2 max-w-[calc(100%-1rem)]">
          <AdminStatusBadge
            status={listing.status}
            label={t(`market.dash.status.${listing.status}`)}
          />
        </span>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <Link
          to="/admin/listings/$id"
          params={{ id: listing.id }}
          className="line-clamp-2 text-sm font-semibold text-foreground underline-offset-4 hover:underline"
        >
          {listing.title}
        </Link>

        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          {listing.ref_no ? (
            <span className="tabular-nums" dir="ltr">
              #{listing.ref_no}
            </span>
          ) : null}
          <span className="truncate">{categoryName}</span>
          <span className="truncate">{listing.city ?? "—"}</span>
        </div>

        <p className="truncate text-sm font-bold tabular-nums text-foreground">
          {priceLabel(listing, "—", locale === "ar" ? "ar" : "en")}
        </p>

        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground tabular-nums">
          <span className="truncate">
            {t("market.admin.createdAt")}: {formatDate(listing.published_at ?? listing.created_at)}
          </span>
          {expiresAt && (
            <span className="truncate">
              {t("market.admin.expiresAt")}: {formatDate(expiresAt)}
              {expiryDays !== null && expiryDays >= 0 ? ` (${expiryDays}${t("market.admin.daysShort")})` : ""}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Metric
            icon={Flag}
            label={t("market.admin.reports")}
            value={Number(listing.reports_count ?? 0)}
            tone={Number(listing.reports_count ?? 0) > 0 ? "critical" : undefined}
          />
          <Metric icon={Eye} label={t("market.sort.views")} value={Number(listing.views_count ?? 0)} />
          <Metric
            icon={MessageSquareQuote}
            label={t("market.admin.contactRequests")}
            value={
              Number(listing.quote_requests_count ?? 0) +
              Number(listing.contact_requests_count ?? 0)
            }
          />
        </div>

        <SafetyStrip safety={safety} loading={safetyLoading} href={advertiserLink} />

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <Button asChild size="sm" variant="outline" className="min-h-9">
            <Link to="/admin/listings/$id" params={{ id: listing.id }}>
              {t("market.admin.fullView")}
            </Link>
          </Button>

          {primary && (
            <Button
              size="sm"
              className="min-h-9"
              variant={primary.danger ? "destructive" : "default"}
              disabled={!!busyAction}
              onClick={() => onAction(primary.action)}
            >
              {busyAction === primary.action && (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              )}
              {t(primary.labelKey)}
            </Button>
          )}
          {secondary && (
            <Button
              size="sm"
              className="min-h-9"
              variant={secondary.danger ? "destructive" : "secondary"}
              disabled={!!busyAction}
              onClick={() => onAction(secondary.action)}
            >
              {busyAction === secondary.action && (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              )}
              {t(secondary.labelKey)}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="min-h-9 px-2"
                aria-label={t("market.admin.moreActions")}
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {overflow.map((item) => (
                <DropdownMenuItem
                  key={item.action}
                  disabled={!!busyAction}
                  className={item.danger ? "text-destructive" : undefined}
                  onSelect={() => onAction(item.action)}
                >
                  {t(item.labelKey)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem asChild>
                <Link
                  to="/admin/listings/$id"
                  params={{ id: listing.id }}
                  search={{ tab: "reports" }}
                >
                  {t("market.admin.openReports")}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  );
}

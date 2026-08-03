/**
 * Unified administrative entity links.
 *
 * Every place in the admin console that shows a person, a business, a listing
 * or a report renders one of these. They always navigate inside the current
 * tab and stay inside `AdminShell` — never `target="_blank"`, never
 * `window.open`, never a public marketplace page.
 *
 * Permissions: the link degrades to plain text when the signed-in admin lacks
 * the matching view ability. This is cosmetic only — the detail routes and
 * their RPCs re-authorise on the server, so hiding a link never grants access
 * and showing one never bypasses a check.
 */
import { Link } from "@tanstack/react-router";
import { usePlatformIdentity } from "@/lib/mkt-platform";
import { adminCan, type AdminAbility } from "@/lib/mkt-admin-perms";
import { cn } from "@/lib/utils";

function initials(name: string | null | undefined): string {
  const clean = (name ?? "").trim();
  if (!clean) return "؟";
  const parts = clean.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => Array.from(p)[0] ?? "").join("") || "؟";
}

type BaseProps = {
  /** Visible label. Falls back to a neutral placeholder when empty. */
  name?: string | null;
  fallback?: string;
  className?: string;
  /** Renders the label as a block that truncates inside table cells. */
  truncate?: boolean;
  children?: React.ReactNode;
};

function LinkBody({
  name,
  fallback,
  children,
}: Pick<BaseProps, "name" | "fallback" | "children">) {
  if (children) return <>{children}</>;
  const label = (name ?? "").trim();
  return <>{label || fallback || "—"}</>;
}

function useAllowed(ability: AdminAbility): boolean {
  const { identity } = usePlatformIdentity();
  return adminCan(identity, ability);
}

const LINK_CLASS =
  "text-start font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm";

type EntityKind = "user" | "business" | "listing" | "report";

const ABILITY: Record<EntityKind, AdminAbility> = {
  user: "users.view",
  business: "businesses.view",
  listing: "listings.view",
  report: "reports.view",
};

type EntityLinkProps = BaseProps & {
  kind: EntityKind;
  id: string | null | undefined;
};

/** Generic internal admin link for any subject the console can open. */
export function AdminEntityLink({
  kind,
  id,
  name,
  fallback,
  className,
  truncate,
  children,
}: EntityLinkProps) {
  const allowed = useAllowed(ABILITY[kind]);
  const body = <LinkBody name={name} fallback={fallback} children={children} />;
  const shared = cn(truncate && "block truncate", className);

  if (!id || !allowed) {
    return (
      <span className={cn(shared, "text-foreground")} title={undefined}>
        {body}
      </span>
    );
  }

  const to =
    kind === "user"
      ? "/admin/users/$id"
      : kind === "business"
        ? "/admin/businesses/$id"
        : kind === "listing"
          ? "/admin/listings/$id"
          : "/admin/reports/$id";

  return (
    <Link to={to} params={{ id }} className={cn(LINK_CLASS, shared)}>
      {body}
    </Link>
  );
}

/** Person link — the most common case across the console. */
export function AdminUserLink(props: Omit<EntityLinkProps, "kind">) {
  return <AdminEntityLink kind="user" {...props} />;
}

export function AdminBusinessLink(props: Omit<EntityLinkProps, "kind">) {
  return <AdminEntityLink kind="business" {...props} />;
}

export function AdminListingLink(props: Omit<EntityLinkProps, "kind">) {
  return <AdminEntityLink kind="listing" {...props} />;
}

export function AdminReportLink(props: Omit<EntityLinkProps, "kind">) {
  return <AdminEntityLink kind="report" {...props} />;
}

type AccountCardProps = {
  userId: string | null | undefined;
  name?: string | null;
  /** Sensitive contact fields — pass null when the admin may not see them. */
  email?: string | null;
  phone?: string | null;
  accountType?: string | null;
  status?: string | null;
  avatarUrl?: string | null;
  fallback?: string;
  className?: string;
};

/**
 * Compact account card: avatar/initials, name, contact lines, type and status.
 * The whole block is one 44px-tall touch target on mobile.
 */
export function AdminAccountCard({
  userId,
  name,
  email,
  phone,
  accountType,
  status,
  avatarUrl,
  fallback,
  className,
}: AccountCardProps) {
  const allowed = useAllowed("users.view");
  const canOpen = allowed && !!userId;

  const inner = (
    <>
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-muted-foreground"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          initials(name)
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">
          {(name ?? "").trim() || fallback || "—"}
        </span>
        {email ? (
          <span className="block truncate text-xs text-muted-foreground" dir="ltr">
            {email}
          </span>
        ) : null}
        {phone ? (
          <span className="block truncate text-xs text-muted-foreground" dir="ltr">
            {phone}
          </span>
        ) : null}
        {accountType || status ? (
          <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
            {accountType ? <span>{accountType}</span> : null}
            {accountType && status ? <span aria-hidden>·</span> : null}
            {status ? <span>{status}</span> : null}
          </span>
        ) : null}
      </span>
    </>
  );

  const shell = cn("flex min-h-11 w-full items-center gap-3 text-start", className);

  if (!canOpen) return <span className={shell}>{inner}</span>;

  return (
    <Link
      to="/admin/users/$id"
      params={{ id: userId! }}
      className={cn(
        shell,
        "rounded-md transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {inner}
    </Link>
  );
}

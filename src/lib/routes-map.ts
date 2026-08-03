/**
 * Central route map — the single source of truth for what every URL is, who may
 * open it, and which URL is canonical.
 *
 * Guards read this file instead of repeating rules page by page:
 *  - `MarketShell` / `MarketHome`  → which links to render
 *  - `DashboardShell`              → login + active account + permission
 *  - `AdminShell` / `/admin` gate  → platform-admin or staff permission
 *  - `AppLayout` / `_authenticated`→ operational pages (login + entity)
 *
 * It never grants anything: the database (RLS + `mkt_my_accounts` /
 * `mkt_account_context` + `has_perm`) remains the only authority. This map only
 * decides what the UI shows and where a blocked visitor is sent.
 */

export type RouteType =
  /** Open to everyone, indexable. */
  | "public"
  /** Signed-in user, no entity scope needed. */
  | "authenticated"
  /** Signed-in user working under one chosen account (personal or business). */
  | "account"
  /** Internal operations, scoped to the active entity (tenant). */
  | "operational"
  /** Marketplace back office. */
  | "admin"
  /** Superseded by a canonical route; kept only to redirect. */
  | "legacy";

export type IdentityType = "guest" | "individual" | "business";

export interface RouteRule {
  path: string;
  route_type: RouteType;
  requires_auth: boolean;
  requires_active_account: boolean;
  allowed_identity_types: IdentityType[];
  required_permission: string | null;
  layout: "market" | "dashboard" | "admin" | "app" | "bare";
  /** Where this path should send the user instead of rendering. */
  legacy_redirect: string | null;
  is_public: boolean;
}

const PUBLIC_IDENTITIES: IdentityType[] = ["guest", "individual", "business"];
const ACCOUNT_IDENTITIES: IdentityType[] = ["individual", "business"];

function rule(
  path: string,
  route_type: RouteType,
  layout: RouteRule["layout"],
  extra: Partial<RouteRule> = {},
): RouteRule {
  const isPublic = route_type === "public";
  return {
    path,
    route_type,
    layout,
    is_public: isPublic,
    requires_auth: !isPublic && route_type !== "legacy",
    requires_active_account: route_type === "account" || route_type === "operational",
    allowed_identity_types: isPublic ? PUBLIC_IDENTITIES : ACCOUNT_IDENTITIES,
    required_permission: null,
    legacy_redirect: null,
    ...extra,
  };
}

/**
 * Every registered route. Dynamic segments keep their `$param` form so a rule can
 * be matched against a router path or a concrete URL (see `routeRuleFor`).
 */
export const ROUTE_MAP: RouteRule[] = [
  // ── أ. Public ───────────────────────────────────────────────────────────────
  rule("/", "public", "market"),
  rule("/search", "public", "market"),
  rule("/categories/$slug", "public", "market"),
  rule("/ads/$slug", "public", "market"),
  rule("/u/$username", "public", "market"),
  rule("/businesses/$slug", "public", "market"),
  rule("/auth", "public", "bare"),
  rule("/register", "public", "bare"),
  rule("/invite/$token", "public", "bare"),
  // Public utility: anonymous checking only — saving requires sign-in + account.
  rule("/verify-invoice", "public", "bare"),

  // ── ب. Signed in ────────────────────────────────────────────────────────────
  rule("/choose-account", "authenticated", "bare"),
  // Standalone business creation: signed in, no active account required, and
  // deliberately outside any shell so the picker never hosts it in a modal.
  rule("/business/new", "authenticated", "bare"),

  rule("/market-setup", "authenticated", "market"),
  rule("/more", "public", "market"),
  rule("/dashboard/profile", "account", "dashboard"),
  rule("/dashboard/notifications", "account", "dashboard"),
  rule("/dashboard/messages", "account", "dashboard"),
  rule("/dashboard/favorites", "account", "dashboard"),
  rule("/dashboard/my-ads", "account", "dashboard"),
  rule("/dashboard/ads/new", "account", "dashboard"),
  rule("/dashboard/ads/$id/edit", "account", "dashboard"),
  rule("/dashboard/requests", "account", "dashboard"),
  rule("/dashboard/reports", "account", "dashboard"),
  rule("/dashboard/reports/$id", "account", "dashboard"),
  rule("/dashboard/violations", "account", "dashboard"),
  rule("/dashboard/business", "account", "dashboard", {
    allowed_identity_types: ["business"],
  }),

  // ── ج. Active entity (internal operations) ─────────────────────────────────
  rule("/select-account", "authenticated", "app"),
  rule("/me", "authenticated", "app"),
  rule("/settings", "authenticated", "app"),
  rule("/onboarding", "authenticated", "app"),
  rule("/notifications", "authenticated", "app"),
  rule("/portal", "operational", "app"),
  rule("/dashboard", "operational", "app"),
  rule("/projects", "operational", "app", { required_permission: "projects.view" }),
  rule("/projects/$id", "operational", "app", { required_permission: "projects.view" }),
  rule("/projects_/$id/requests", "operational", "app", {
    required_permission: "requests.view",
  }),
  rule("/requests", "operational", "app", { required_permission: "requests.view" }),
  rule("/requests/$id", "operational", "app", { required_permission: "requests.view" }),
  rule("/suppliers", "operational", "app", { required_permission: "suppliers.view" }),
  rule("/products", "operational", "app", { required_permission: "suppliers.view" }),
  rule("/invoices", "operational", "app", { required_permission: "invoices.view" }),
  rule("/invoices_/$id/lines", "operational", "app", {
    required_permission: "invoices.view",
  }),
  rule("/invoices_/verified/new", "operational", "app"),
  rule("/custody", "operational", "app", { required_permission: "custody.view" }),
  rule("/my-custody", "operational", "app", { required_permission: "custody.view_own" }),
  rule("/my-documents", "operational", "app"),
  rule("/supervisors", "operational", "app", { required_permission: "supervisors.view" }),
  rule("/supervisors/$id", "operational", "app", {
    required_permission: "supervisors.view",
  }),
  rule("/team", "operational", "app", { required_permission: "team.view" }),
  rule("/users", "operational", "app", { required_permission: "users.manage" }),
  rule("/invitations", "operational", "app", { required_permission: "users.manage" }),
  rule("/reports", "operational", "app", { required_permission: "reports.view" }),
  rule("/audit", "operational", "app", { required_permission: "audit.view" }),
  rule("/trash", "operational", "app", { required_permission: "records.restore" }),

  // ── د. Marketplace back office ─────────────────────────────────────────────
  rule("/admin", "admin", "admin"),
  rule("/admin/listings", "admin", "admin"),
  rule("/admin/verifications", "admin", "admin"),
  rule("/admin/geo", "admin", "admin"),
  rule("/admin/reports", "admin", "admin"),
  rule("/admin/reports/$id", "admin", "admin"),

  // ── هـ. Legacy / duplicated ────────────────────────────────────────────────
  // These paths no longer have a route file of their own: the central splat
  // handler (`src/routes/$.tsx`) resolves them, keeping query string and hash.
  // `/marketplace` rendered the exact same home page as `/`.
  rule("/marketplace", "legacy", "market", { legacy_redirect: "/", is_public: true }),
  rule("/login", "legacy", "bare", { legacy_redirect: "/auth", is_public: true }),
  rule("/signin", "legacy", "bare", { legacy_redirect: "/auth", is_public: true }),
  rule("/sign-in", "legacy", "bare", { legacy_redirect: "/auth", is_public: true }),
  rule("/signup", "legacy", "bare", { legacy_redirect: "/register", is_public: true }),
  rule("/sign-up", "legacy", "bare", { legacy_redirect: "/register", is_public: true }),
  rule("/home", "legacy", "market", { legacy_redirect: "/", is_public: true }),
  rule("/market", "legacy", "market", { legacy_redirect: "/", is_public: true }),
];

const BY_PATH = new Map(ROUTE_MAP.map((r) => [r.path, r]));

/**
 * Legacy path → canonical path, for the single central redirect handler.
 * A redirected path never gains access: it lands on the canonical route and that
 * route's own guard (login / active account / permission) still runs.
 */
export function resolveLegacyTarget(pathname: string): string | null {
  const clean = pathname.split("?")[0]!.split("#")[0]!.replace(/\/+$/, "") || "/";
  const found = BY_PATH.get(clean);
  return found?.route_type === "legacy" ? (found.legacy_redirect ?? null) : null;
}


/** Turns a concrete URL path into its registered pattern (`/ads/x` → `/ads/$slug`). */
export function normalizePath(pathname: string): string {
  const clean = pathname.split("?")[0]!.split("#")[0]!.replace(/\/+$/, "") || "/";
  if (BY_PATH.has(clean)) return clean;
  const segments = clean.split("/");
  for (const candidate of ROUTE_MAP) {
    const parts = candidate.path.split("/");
    if (parts.length !== segments.length) continue;
    if (parts.every((p, i) => p.startsWith("$") || p === segments[i])) return candidate.path;
  }
  return clean;
}

export function routeRuleFor(pathname: string): RouteRule | null {
  return BY_PATH.get(normalizePath(pathname)) ?? null;
}

export function isPublicPath(pathname: string): boolean {
  return routeRuleFor(pathname)?.is_public ?? false;
}

export function requiresActiveAccount(pathname: string): boolean {
  return routeRuleFor(pathname)?.requires_active_account ?? false;
}

/** Canonical target for a legacy path, preserving query string and hash. */
export function canonicalHref(href: string): string | null {
  const [pathname = "/", rest = ""] = [href.split(/[?#]/)[0], href.slice((href.split(/[?#]/)[0] ?? "").length)];
  const found = routeRuleFor(pathname);
  if (!found?.legacy_redirect) return null;
  return `${found.legacy_redirect}${rest}`;
}

/**
 * Records that a legacy URL was opened, so it can be retired safely once the
 * counter stops moving. Local only — no schema change, no personal data.
 */
export function logLegacyRoute(pathname: string) {
  if (typeof window === "undefined") return;
  try {
    const key = "tahqaq.legacyRoutes";
    const raw = window.localStorage.getItem(key);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    map[pathname] = (map[pathname] ?? 0) + 1;
    window.localStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* logging must never break navigation */
  }
  if (import.meta.env.DEV) console.info("[legacy route]", pathname);
}

/** Nav helper: may this link be shown, given the current viewer state? */
export function canSeeLink(
  pathname: string,
  viewer: {
    signedIn: boolean;
    accountKind: IdentityType | null;
    can: (permission: string) => boolean;
    isPlatformAdmin?: boolean;
  },
): boolean {
  const found = routeRuleFor(pathname);
  if (!found || found.route_type === "legacy") return found?.is_public ?? false;
  if (found.is_public) return true;
  if (!viewer.signedIn) return false;
  if (found.route_type === "admin") return viewer.isPlatformAdmin === true;
  if (found.requires_active_account && !viewer.accountKind) return false;
  if (
    viewer.accountKind &&
    !found.allowed_identity_types.includes(viewer.accountKind)
  )
    return false;
  if (found.required_permission && !viewer.can(found.required_permission)) return false;
  return true;
}

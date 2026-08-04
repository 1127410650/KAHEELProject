/**
 * Central route map — the single source of truth for what every URL is, who may
 * open it, and which URL is canonical.
 *
 * Guards read this file instead of repeating rules page by page:
 *  - `MarketShell` / `MarketHome`  → which links to render
 *  - `DashboardShell`              → login + active account + permission
 *  - `AdminShell` / `/admin` gate  → platform-admin or staff permission
 *  (the old internal operations shell `AppLayout` / `_authenticated` is gone)
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
  // Public marketplace content pages: no session, no internal data.
  rule("/about", "public", "market"),
  rule("/help", "public", "market"),
  rule("/terms", "public", "market"),
  rule("/privacy", "public", "market"),
  rule("/contact", "public", "market"),
  rule("/dashboard/profile", "account", "dashboard"),
  rule("/dashboard/notifications", "account", "dashboard"),
  rule("/dashboard/messages", "account", "dashboard"),
  rule("/dashboard/favorites", "account", "dashboard"),
  rule("/dashboard/my-ads", "account", "dashboard"),
  rule("/dashboard/points", "account", "dashboard"),
  rule("/dashboard/ads/new", "account", "dashboard"),
  rule("/dashboard/ads/$id/edit", "account", "dashboard"),
  rule("/dashboard/requests", "account", "dashboard"),
  rule("/dashboard/reports", "account", "dashboard"),
  rule("/dashboard/reports/$id", "account", "dashboard"),
  rule("/dashboard/violations", "account", "dashboard"),
  rule("/dashboard/store", "account", "dashboard"),
  rule("/dashboard/store/new", "account", "dashboard"),
  rule("/dashboard/store/catalog", "account", "dashboard"),
  rule("/dashboard/business", "account", "dashboard", {
    allowed_identity_types: ["business"],
  }),

  // ── ج. Retired internal operations console ─────────────────────────────────
  // The old internal system (`AppLayout` + `_authenticated/*`: لوحة التحكم /
  // المشرفون / المشاريع / العهد / الطلبات / الموردون / الفواتير / المنتجات /
  // التقارير / المستخدمون / الأعضاء والدعوات / المحذوفات / سجل العمليات) no longer
  // has any UI. Its database tables and history are untouched; the screens,
  // sidebar and shell are deleted. Old bookmarks resolve here through the central
  // splat handler, so nothing 404s and no old shell can be reopened.
  // Retired / guessed "add a listing" paths — the only real one is
  // `/dashboard/ads/new` (see `src/lib/add-listing.ts`).
  rule("/listings/new", "legacy", "bare", { legacy_redirect: "/dashboard/ads/new" }),
  rule("/new-listing", "legacy", "bare", { legacy_redirect: "/dashboard/ads/new" }),
  rule("/dashboard/new-listing", "legacy", "bare", { legacy_redirect: "/dashboard/ads/new" }),
  rule("/dashboard/listings/new", "legacy", "bare", { legacy_redirect: "/dashboard/ads/new" }),
  rule("/market/listings/new", "legacy", "bare", { legacy_redirect: "/dashboard/ads/new" }),
  rule("/select-account", "legacy", "bare", { legacy_redirect: "/choose-account" }),
  rule("/settings", "legacy", "bare", { legacy_redirect: "/dashboard/profile" }),
  rule("/onboarding", "legacy", "bare", { legacy_redirect: "/me" }),
  rule("/notifications", "legacy", "bare", { legacy_redirect: "/dashboard/notifications" }),
  rule("/portal", "legacy", "bare", { legacy_redirect: "/me" }),
  rule("/dashboard", "legacy", "bare", { legacy_redirect: "/me" }),
  rule("/projects", "legacy", "bare", { legacy_redirect: "/me" }),
  rule("/projects/$id", "legacy", "bare", { legacy_redirect: "/me" }),
  rule("/projects_/$id/requests", "legacy", "bare", { legacy_redirect: "/me" }),
  rule("/requests", "legacy", "bare", { legacy_redirect: "/me" }),
  rule("/requests/$id", "legacy", "bare", { legacy_redirect: "/me" }),
  rule("/suppliers", "legacy", "bare", { legacy_redirect: "/me" }),
  rule("/products", "legacy", "bare", { legacy_redirect: "/me" }),
  rule("/invoices", "legacy", "bare", { legacy_redirect: "/me" }),
  rule("/invoices_/$id/lines", "legacy", "bare", { legacy_redirect: "/me" }),
  rule("/invoices_/verified/new", "legacy", "bare", { legacy_redirect: "/verify-invoice" }),
  rule("/custody", "legacy", "bare", { legacy_redirect: "/me" }),
  rule("/my-custody", "legacy", "bare", { legacy_redirect: "/me" }),
  rule("/my-documents", "legacy", "bare", { legacy_redirect: "/me" }),
  rule("/supervisors", "legacy", "bare", { legacy_redirect: "/me" }),
  rule("/supervisors/$id", "legacy", "bare", { legacy_redirect: "/me" }),
  rule("/team", "legacy", "bare", { legacy_redirect: "/me" }),
  rule("/users", "legacy", "bare", { legacy_redirect: "/me" }),
  rule("/invitations", "legacy", "bare", { legacy_redirect: "/me" }),
  rule("/reports", "legacy", "bare", { legacy_redirect: "/me" }),
  rule("/trash", "legacy", "bare", { legacy_redirect: "/me" }),
  // `src/routes/audit.tsx` owns `/audit` so the destination can depend on the
  // caller (admin → the operations log); this entry records the fallback.
  rule("/audit", "legacy", "bare", { legacy_redirect: "/admin/audit-log" }),

  // ── د. Marketplace back office ─────────────────────────────────────────────
  rule("/admin", "admin", "admin"),
  rule("/admin/listings", "admin", "admin"),
  rule("/admin/listing-events", "admin", "admin"),
  rule("/admin/listing-reports", "admin", "admin"),
  rule("/admin/verifications", "admin", "admin"),
  rule("/admin/geo", "admin", "admin"),
  rule("/admin/reports", "admin", "admin"),
  rule("/admin/reports/$id", "admin", "admin"),
  rule("/admin/activities", "admin", "admin"),
  rule("/admin/users", "admin", "admin"),
  rule("/admin/businesses", "admin", "admin"),
  rule("/admin/roles", "admin", "admin"),
  rule("/admin/audit-log", "admin", "admin"),
  rule("/admin/settings", "admin", "admin"),

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
  // The old personal dashboard. `src/routes/me.tsx` still owns the path so the
  // destination can depend on who is asking (admin console / business dashboard /
  // personal dashboard); this entry records the canonical fallback.
  rule("/me", "legacy", "bare", { legacy_redirect: "/dashboard/profile" }),
];

const BY_PATH = new Map(ROUTE_MAP.map((r) => [r.path, r]));

/**
 * Legacy path → canonical path, for the single central redirect handler.
 * A redirected path never gains access: it lands on the canonical route and that
 * route's own guard (login / active account / permission) still runs.
 */
export function resolveLegacyTarget(pathname: string): string | null {
  // Pattern-aware: `/projects/17` resolves through its `/projects/$id` rule.
  const found = routeRuleFor(pathname);
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

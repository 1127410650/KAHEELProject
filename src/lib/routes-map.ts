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
  // عالم القسم المولّد من قالب واحد لكل قسم رئيسي.
  rule("/c/$slug", "public", "market"),
  rule("/ads/$slug", "public", "market"),
  rule("/profiles/$username", "public", "market"),
  rule("/businesses/$slug", "public", "market"),
  rule("/stores/$slug", "public", "market"),
  rule("/services", "public", "market"),
  rule("/errands", "public", "market"),
  rule("/services/$slug/$itemId/book", "public", "market"),
  rule("/demo", "public", "market"),
  rule("/demo-stores/$worldId", "public", "market"),
  rule("/guides/syria", "public", "market"),
  rule("/guides/students", "public", "market"),
  // Detail page of a guide entry. Its file uses the `_` escape
  // (`guides/syria_.$slug.tsx`) so it does not nest under the list page; the URL
  // it serves — and the rule below — is the plain one.
  rule("/guides/syria/$slug", "public", "market"),

  // Renamed public pages. `/u/x` said nothing about what it shows, and the two
  // guides sat at the root as if they were sections of the platform. They now
  // live under self-describing prefixes; the old URLs are indexed, so they keep
  // working through a permanent redirect that carries the username along.
  rule("/u/$username", "legacy", "bare", {
    legacy_redirect: "/profiles/$username",
    is_public: true,
  }),
  rule("/syria-guide", "legacy", "bare", { legacy_redirect: "/guides/syria", is_public: true }),
  rule("/student-tools", "legacy", "bare", {
    legacy_redirect: "/guides/students",
    is_public: true,
  }),

  rule("/auth", "public", "bare"),
  rule("/register", "legacy", "bare", { legacy_redirect: "/auth?tab=register", is_public: true }),
  rule("/forgot-password", "public", "bare"),
  rule("/reset-password", "public", "bare"),
  rule("/invite/$token", "public", "bare"),
  // `/welcome` was a second landing page that duplicated `/` (same hero, same
  // sections, same listings) while drifting behind it — it still carried the
  // pre-rebrand name and was linked from nowhere in the app. One home page, one
  // canonical URL: the old address keeps its search signals through a 301.
  rule("/welcome", "legacy", "market", { legacy_redirect: "/", is_public: true }),
  rule("/appointments", "legacy", "bare", { legacy_redirect: "/services" }),
  // A shared booking link is `/services/$slug/$itemId/book`, so a visitor who
  // trims it lands on `/services/$slug` — a page that never existed. The provider
  // slug IS the storefront slug, so its public store page is the honest parent.
  rule("/services/$slug", "legacy", "market", {
    legacy_redirect: "/stores/$slug",
    is_public: true,
  }),


  // The single "where do I belong?" resolver. Replaces the retired `/me` and
  // `/audit` shells; it is client-side and never indexed (see `routes/go.tsx`).
  rule("/go", "authenticated", "bare"),


  // ── ب. Signed in ────────────────────────────────────────────────────────────
  rule("/choose-account", "authenticated", "bare"),
  rule("/join", "authenticated", "bare"),
  // Retained for old bookmarks; every new seller/provider starts through the
  // reviewed join flow instead of creating an immediately active store.
  rule("/business/new", "legacy", "bare", { legacy_redirect: "/join?kind=seller" }),

  rule("/market-setup", "authenticated", "market"),
  rule("/more", "public", "market"),
  // Public marketplace content pages: no session, no internal data.
  rule("/about", "public", "market"),
  rule("/help", "public", "market"),
  // The policy and contact texts live inside `/about` and `/help`; these three
  // paths only forward to the right section, so they are legacy, not public
  // destinations of their own (otherwise navigation and search treat them as
  // separate pages that immediately bounce).
  rule("/terms", "legacy", "market", { legacy_redirect: "/about#terms", is_public: true }),
  rule("/privacy", "legacy", "market", { legacy_redirect: "/about#privacy", is_public: true }),
  rule("/contact", "legacy", "market", { legacy_redirect: "/help#contact", is_public: true }),

  rule("/my/profile", "account", "dashboard"),
  rule("/my/notifications", "account", "dashboard"),
  rule("/my/messages", "account", "dashboard"),
  rule("/my/favorites", "account", "dashboard"),
  rule("/my/bookings", "account", "dashboard"),
  rule("/my/orders", "account", "dashboard"),
  rule("/my/ads", "account", "dashboard"),
  rule("/my/wallet", "account", "dashboard"),
  rule("/my/stats", "account", "dashboard"),
  rule("/my/ad-credit", "account", "dashboard"),
  rule("/my/errands", "account", "dashboard"),
  rule("/my/errands/$id", "account", "dashboard"),
  rule("/my/captain", "account", "dashboard"),
  rule("/my/ads/new", "account", "dashboard"),
  rule("/my/ads/$id/edit", "account", "dashboard"),
  rule("/my/quotes", "account", "dashboard"),
  rule("/my/reports", "account", "dashboard"),
  rule("/my/reports/$id", "account", "dashboard"),
  rule("/my/violations", "account", "dashboard"),
  rule("/business", "operational", "dashboard", {
    allowed_identity_types: ["business"],
  }),
  rule("/business/orders", "operational", "dashboard", {
    allowed_identity_types: ["business"],
  }),
  rule("/business/store", "operational", "dashboard", {
    allowed_identity_types: ["business"],
  }),
  rule("/business/store/new", "operational", "dashboard", {
    allowed_identity_types: ["business"],
  }),
  rule("/business/store/catalog", "operational", "dashboard", {
    allowed_identity_types: ["business"],
  }),
  rule("/business/store/offers", "operational", "dashboard", {
    allowed_identity_types: ["business"],
  }),
  rule("/business/partners", "operational", "dashboard", {
    allowed_identity_types: ["business"],
  }),
  rule("/business/services", "operational", "dashboard", {
    allowed_identity_types: ["business"],
  }),
  rule("/business/services/settings", "operational", "dashboard", {
    allowed_identity_types: ["business"],
  }),
  rule("/business/profile", "account", "dashboard", {
    allowed_identity_types: ["business"],
  }),

  // The account area used to live under one flat `/dashboard/*` branch, which
  // said nothing about who a page belongs to and mixed personal screens with
  // work-account operations. It is now split in two self-describing branches:
  // `/my/*` (the person) and `/business/*` (the work account). Every old URL
  // keeps working through a permanent server redirect (`src/server.ts`), so
  // bookmarks, saved `next=` links and anything already shared stay valid.
  rule("/dashboard/profile", "legacy", "bare", { legacy_redirect: "/my/profile" }),
  rule("/dashboard/notifications", "legacy", "bare", {
    legacy_redirect: "/my/notifications",
  }),
  rule("/dashboard/messages", "legacy", "bare", { legacy_redirect: "/my/messages" }),
  rule("/dashboard/favorites", "legacy", "bare", { legacy_redirect: "/my/favorites" }),
  rule("/dashboard/bookings", "legacy", "bare", { legacy_redirect: "/my/bookings" }),
  rule("/dashboard/my-ads", "legacy", "bare", { legacy_redirect: "/my/ads" }),
  rule("/dashboard/points", "legacy", "bare", { legacy_redirect: "/my/wallet" }),
  rule("/dashboard/ads/new", "legacy", "bare", { legacy_redirect: "/my/ads/new" }),
  rule("/dashboard/ads/$id/edit", "legacy", "bare", { legacy_redirect: "/my/ads/$id/edit" }),
  rule("/dashboard/requests", "legacy", "bare", { legacy_redirect: "/my/quotes" }),
  rule("/dashboard/reports", "legacy", "bare", { legacy_redirect: "/my/reports" }),
  rule("/dashboard/reports/$id", "legacy", "bare", { legacy_redirect: "/my/reports/$id" }),
  rule("/dashboard/violations", "legacy", "bare", { legacy_redirect: "/my/violations" }),
  rule("/dashboard/operations", "legacy", "bare", { legacy_redirect: "/business" }),
  rule("/dashboard/orders", "legacy", "bare", { legacy_redirect: "/business/orders" }),
  rule("/dashboard/store", "legacy", "bare", { legacy_redirect: "/business/store" }),
  rule("/dashboard/store/new", "legacy", "bare", { legacy_redirect: "/business/store/new" }),
  rule("/dashboard/store/catalog", "legacy", "bare", {
    legacy_redirect: "/business/store/catalog",
  }),
  rule("/dashboard/network", "legacy", "bare", { legacy_redirect: "/business/partners" }),
  rule("/dashboard/service", "legacy", "bare", { legacy_redirect: "/business/services" }),
  rule("/dashboard/service/settings", "legacy", "bare", {
    legacy_redirect: "/business/services/settings",
  }),
  rule("/dashboard/business", "legacy", "bare", { legacy_redirect: "/business/profile" }),

  // ── ج. Retired internal operations console ─────────────────────────────────
  // The old internal system (`AppLayout` + `_authenticated/*`: لوحة التحكم /
  // المشرفون / المشاريع / العهد / الطلبات / الموردون / الفواتير / المنتجات /
  // التقارير / المستخدمون / الأعضاء والدعوات / المحذوفات / سجل العمليات) no longer
  // has any UI. Its database tables and history are untouched; the screens,
  // sidebar and shell are deleted. Old bookmarks resolve here through the central
  // splat handler, so nothing 404s and no old shell can be reopened.
  // Retired / guessed "add a listing" paths — the only real one is
  // `/my/ads/new` (see `src/lib/add-listing.ts`).
  rule("/listings/new", "legacy", "bare", { legacy_redirect: "/my/ads/new" }),
  rule("/new-listing", "legacy", "bare", { legacy_redirect: "/my/ads/new" }),
  rule("/dashboard/new-listing", "legacy", "bare", { legacy_redirect: "/my/ads/new" }),
  rule("/dashboard/listings/new", "legacy", "bare", { legacy_redirect: "/my/ads/new" }),
  rule("/market/listings/new", "legacy", "bare", { legacy_redirect: "/my/ads/new" }),
  rule("/select-account", "legacy", "bare", { legacy_redirect: "/choose-account" }),
  rule("/settings", "legacy", "bare", { legacy_redirect: "/my/profile" }),
  rule("/onboarding", "legacy", "bare", { legacy_redirect: "/go" }),
  rule("/notifications", "legacy", "bare", { legacy_redirect: "/my/notifications" }),
  rule("/portal", "legacy", "bare", { legacy_redirect: "/go" }),
  rule("/dashboard", "legacy", "bare", { legacy_redirect: "/go" }),
  rule("/projects", "legacy", "bare", { legacy_redirect: "/go" }),
  rule("/projects/$id", "legacy", "bare", { legacy_redirect: "/go" }),
  rule("/projects_/$id/requests", "legacy", "bare", { legacy_redirect: "/go" }),
  rule("/requests", "legacy", "bare", { legacy_redirect: "/go" }),
  rule("/requests/$id", "legacy", "bare", { legacy_redirect: "/go" }),
  rule("/suppliers", "legacy", "bare", { legacy_redirect: "/go" }),
  rule("/products", "legacy", "bare", { legacy_redirect: "/go" }),
  rule("/invoices", "legacy", "bare", { legacy_redirect: "/go" }),
  rule("/invoices_/$id/lines", "legacy", "bare", { legacy_redirect: "/go" }),
  // The retired tax-invoice verifier was a browser utility and never owned the
  // historical invoice tables. Old bookmarks return to the marketplace; no
  // database row, function or migration is deleted by retiring this UI route.
  rule("/verify-invoice", "legacy", "bare", { legacy_redirect: "/" }),
  rule("/invoices_/verified/new", "legacy", "bare", { legacy_redirect: "/" }),
  rule("/custody", "legacy", "bare", { legacy_redirect: "/go" }),
  rule("/my-custody", "legacy", "bare", { legacy_redirect: "/go" }),
  rule("/my-documents", "legacy", "bare", { legacy_redirect: "/go" }),
  rule("/supervisors", "legacy", "bare", { legacy_redirect: "/go" }),
  rule("/supervisors/$id", "legacy", "bare", { legacy_redirect: "/go" }),
  rule("/team", "legacy", "bare", { legacy_redirect: "/go" }),
  rule("/users", "legacy", "bare", { legacy_redirect: "/go" }),
  rule("/invitations", "legacy", "bare", { legacy_redirect: "/go" }),
  rule("/reports", "legacy", "bare", { legacy_redirect: "/go" }),
  rule("/trash", "legacy", "bare", { legacy_redirect: "/go" }),
  // The retired internal operations console. It now goes through `/go`, which
  // resolves the caller and sends an admin on to the single operations log.
  rule("/audit", "legacy", "bare", { legacy_redirect: "/go?next=audit-log" }),

  // ── د. Marketplace back office ─────────────────────────────────────────────
  rule("/admin", "admin", "admin"),
  rule("/admin/listings", "admin", "admin"),
  rule("/admin/listing-events", "admin", "admin"),
  rule("/admin/listing-reports", "admin", "admin"),
  rule("/admin/verifications", "admin", "admin"),
  rule("/admin/applications", "admin", "admin"),
  rule("/admin/locations", "admin", "admin"),
  rule("/admin/reports", "admin", "admin"),
  rule("/admin/reports/$id", "admin", "admin"),
  rule("/admin/ad-credit", "admin", "admin"),
  rule("/admin/campaigns", "admin", "admin"),
  rule("/admin/mascots", "admin", "admin"),
  rule("/admin/stores", "admin", "admin"),
  rule("/admin/guide-queue", "admin", "admin"),
  rule("/admin/errands", "admin", "admin"),

  rule("/admin/taxonomy", "admin", "admin"),
  rule("/admin/categories", "admin", "admin"),
  rule("/admin/users", "admin", "admin"),
  rule("/admin/businesses", "admin", "admin"),
  rule("/admin/roles", "admin", "admin"),
  rule("/admin/access-control", "admin", "admin"),
  rule("/admin/audit-log", "admin", "admin"),
  rule("/admin/settings", "admin", "admin"),
  // Back-office pages that existed as route files without a rule: without an
  // entry here the shells could not decide whether to show their links, and the
  // path fell through as "unknown" instead of "admin only".
  rule("/admin/dashboard", "admin", "admin"),
  rule("/admin/my-work", "admin", "admin"),
  rule("/admin/search", "admin", "admin"),
  rule("/admin/moderation", "admin", "admin"),
  rule("/admin/staff/attendance", "admin", "admin"),
  rule("/admin/staff/workload", "admin", "admin"),
  // Detail screens. The route files use the `_` escape (`listings_.$id.tsx`) so
  // they do not nest under the list page; the URL they serve is the plain one.
  rule("/admin/listings/$id", "admin", "admin"),
  rule("/admin/businesses/$id", "admin", "admin"),
  rule("/admin/users/$id", "admin", "admin"),
  rule("/admin/verifications/$id", "admin", "admin"),

  // Renamed console screens. The old names described the table behind the page
  // ("activities", "geo") or an action ("join-applications"); the new ones say
  // what the reviewer manages. Redirects keep saved links and open tabs working.
  rule("/admin/activities", "legacy", "bare", { legacy_redirect: "/admin/taxonomy" }),
  rule("/admin/geo", "legacy", "bare", { legacy_redirect: "/admin/locations" }),
  rule("/admin/content-rules", "legacy", "bare", { legacy_redirect: "/admin/moderation" }),
  rule("/admin/join-applications", "legacy", "bare", { legacy_redirect: "/admin/applications" }),
  rule("/admin/attendance", "legacy", "bare", { legacy_redirect: "/admin/staff/attendance" }),
  rule("/admin/workforce", "legacy", "bare", { legacy_redirect: "/admin/staff/workload" }),


  // ── هـ. Legacy / duplicated ────────────────────────────────────────────────
  // These paths no longer have a route file of their own: the central splat
  // handler (`src/routes/$.tsx`) resolves them, keeping query string and hash.
  // `/marketplace` rendered the exact same home page as `/`.
  rule("/marketplace", "legacy", "market", { legacy_redirect: "/", is_public: true }),
  rule("/login", "legacy", "bare", { legacy_redirect: "/auth", is_public: true }),
  rule("/signin", "legacy", "bare", { legacy_redirect: "/auth", is_public: true }),
  rule("/sign-in", "legacy", "bare", { legacy_redirect: "/auth", is_public: true }),
  rule("/signup", "legacy", "bare", { legacy_redirect: "/auth?tab=register", is_public: true }),
  rule("/sign-up", "legacy", "bare", { legacy_redirect: "/auth?tab=register", is_public: true }),
  rule("/home", "legacy", "market", { legacy_redirect: "/", is_public: true }),
  rule("/market", "legacy", "market", { legacy_redirect: "/", is_public: true }),
  // The old personal dashboard. Its own route file is gone: `/go` is now the one
  // place that decides where a caller belongs, so this is a plain 301.
  rule("/me", "legacy", "bare", { legacy_redirect: "/go" }),
];

const BY_PATH = new Map(ROUTE_MAP.map((r) => [r.path, r]));

/**
 * Legacy path → canonical path, for the single central redirect handler.
 * A redirected path never gains access: it lands on the canonical route and that
 * route's own guard (login / active account / permission) still runs.
 */
export function resolveLegacyTarget(pathname: string): string | null {
  // Pattern-aware: `/projects/17` resolves through its `/projects/$id` rule, and
  // a renamed detail URL keeps its id (`/dashboard/ads/17/edit`).
  const found = routeRuleFor(pathname);
  if (found?.route_type !== "legacy" || !found.legacy_redirect) return null;
  const { path } = splitLocalePrefix(pathname.split("?")[0]!.split("#")[0]!);
  return applyParams(found.legacy_redirect, found.path, path);
}

/**
 * Locale/region prefix support (`/sa-ar/ads/x`, `/sy-en/search`).
 *
 * The platform is single-locale today, so nothing produces these prefixes yet.
 * Matching them here means the whole route layer (rules, guards, redirects) is
 * already prefix-agnostic: turning localisation on later adds a prefix, it does
 * not require rewriting every rule.
 */
export const LOCALE_PREFIX_PATTERN = /^[a-z]{2}-[a-z]{2}$/;

/** `/sa-ar/ads/x` → `{ locale: "sa-ar", path: "/ads/x" }`; otherwise `locale: null`. */
export function splitLocalePrefix(pathname: string): { locale: string | null; path: string } {
  const clean = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const first = clean.split("/")[1] ?? "";
  if (!LOCALE_PREFIX_PATTERN.test(first)) return { locale: null, path: clean };
  return { locale: first, path: clean.slice(first.length + 1) || "/" };
}

/** Re-applies a locale prefix to an internal target path. */
export function withLocalePrefix(target: string, locale: string | null): string {
  if (!locale) return target;
  return target === "/" ? `/${locale}` : `/${locale}${target}`;
}

/** Turns a concrete URL path into its registered pattern (`/ads/x` → `/ads/$slug`). */
export function normalizePath(pathname: string): string {
  const raw = pathname.split("?")[0]!.split("#")[0]!;
  const { path } = splitLocalePrefix(raw);
  const clean = path.replace(/\/+$/, "") || "/";
  if (BY_PATH.has(clean)) return clean;
  const segments = clean.split("/");
  for (const candidate of ROUTE_MAP) {
    const parts = candidate.path.split("/");
    if (parts.length !== segments.length) continue;
    if (parts.every((p, i) => p.startsWith("$") || p === segments[i])) return candidate.path;
  }
  return clean;
}

/**
 * Carries the dynamic segments of a concrete path into a redirect target, so a
 * renamed detail URL keeps its id: `/dashboard/ads/17/edit` with the rule
 * `/dashboard/ads/$id/edit → /my/ads/$id/edit` resolves to `/my/ads/17/edit`.
 *
 * Without this the literal `$id` would be served as a path segment.
 */
function applyParams(target: string, rulePath: string, concretePath: string): string {
  if (!target.includes("$")) return target;
  const ruleParts = rulePath.split("/");
  const actualParts = concretePath.replace(/\/+$/, "").split("/");
  const params = new Map<string, string>();
  ruleParts.forEach((part, i) => {
    if (part.startsWith("$") && actualParts[i]) params.set(part, actualParts[i]!);
  });
  return target
    .split("/")
    .map((part) => (part.startsWith("$") ? (params.get(part) ?? part) : part))
    .join("/");
}


/**
 * Redirect target for a retired URL, resolved on the server before the
 * app renders — so an indexed or bookmarked link keeps its search signals
 * instead of being moved by a client-side redirect the crawler never follows.
 *
 * Every legacy target here is identity-independent, which is what makes a
 * cacheable 301 safe: the one destination that depends on who is asking is
 * `/go`, and that page resolves the caller client-side instead of being a
 * redirect rule. `/me` and `/audit` therefore point at `/go` and stop there, and
 * `src/server.ts` answers those two with an uncacheable 302 rather than a 301 so
 * no browser or proxy can remember a personal destination.
 *
 * Returns `null` when the path is current or unknown.
 */
export function serverRedirectFor(pathname: string): string | null {
  const { locale, path } = splitLocalePrefix(pathname.split("?")[0]!.split("#")[0]!);
  const found = routeRuleFor(path);
  if (!found || found.route_type !== "legacy" || !found.legacy_redirect) return null;
  return withLocalePrefix(applyParams(found.legacy_redirect, found.path, path), locale);
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
  const [pathname = "/", rest = ""] = [
    href.split(/[?#]/)[0],
    href.slice((href.split(/[?#]/)[0] ?? "").length),
  ];
  const found = routeRuleFor(pathname);
  if (!found?.legacy_redirect) return null;
  return `${applyParams(found.legacy_redirect, found.path, pathname)}${rest}`;
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
  if (viewer.accountKind && !found.allowed_identity_types.includes(viewer.accountKind))
    return false;
  if (found.required_permission && !viewer.can(found.required_permission)) return false;
  return true;
}

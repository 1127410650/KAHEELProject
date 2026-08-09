/**
 * Single source of truth for the marketplace account links.
 *
 * `/more` (mobile hub) and the desktop account dropdown both render from these
 * definitions, so a link can never exist in one surface and be missing — or
 * point somewhere else — in the other. Nothing here grants access: every entry
 * is filtered through `canSeeLink` with the viewer's real permissions, and the
 * counters come from live queries, never from constants.
 */
import {
  CalendarCheck2,
  CalendarClock,
  Coins,
  Flag,
  Gauge,
  Heart,
  LayoutList,
  Network,
  PackageCheck,
  ShieldAlert,
  ShieldCheck,
  Store,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

import { canSeeLink } from "@/lib/routes-map";

export type AccountKind = "individual" | "business";

/** Where a row's counter comes from; `undefined` means the row has no counter. */
export type MoreBadgeSource = "messages" | "alerts";

export interface MoreLinkDef {
  /** Stable key (also the React key). */
  key: string;
  /** Real in-app path — never hand-written twice. */
  to: string;
  /** i18n key; Arabic and English both resolve from the central catalogue. */
  labelKey: string;
  icon: LucideIcon;
  /** Which active-account kinds may see the row (default: both). */
  kinds?: AccountKind[];
  /** Live counter source, when the row has one. */
  badge?: MoreBadgeSource;
  /** Extra gate beyond the route rules (e.g. platform admin). */
  requires?: "platformAdmin" | "approvedProvider";
  /** At least one capability must be granted by the approved provider category. */
  capabilities?: string[];
}

/** «نشاطي» — activity of the ACTIVE account. Messages/alerts live in the bottom bar. */
export const ACTIVITY_LINKS: MoreLinkDef[] = [
  {
    key: "bookings",
    to: "/my/bookings",
    labelKey: "market.services.myBookings",
    icon: CalendarCheck2,
    kinds: ["individual"],
  },
  { key: "my-ads", to: "/my/ads", labelKey: "market.dash.myAds", icon: LayoutList },
  // Quote requests had a route and a 301 from the old `/dashboard/requests`, but
  // no entry here — so the only screen for them was unreachable from the UI.
  { key: "quotes", to: "/my/quotes", labelKey: "market.dash.requests", icon: FileText },

  { key: "points", to: "/my/wallet", labelKey: "market.points.title", icon: Coins },
  { key: "favorites", to: "/my/favorites", labelKey: "market.dash.favorites", icon: Heart },
  { key: "reports", to: "/my/reports", labelKey: "market.dash.reports", icon: Flag },
  {
    key: "violations",
    to: "/my/violations",
    labelKey: "market.dash.violations",
    icon: ShieldAlert,
  },
];

/** «إدارة الحساب» — only routes that really exist today. */
export const MANAGE_LINKS: MoreLinkDef[] = [
  {
    key: "operations",
    to: "/business",
    labelKey: "market.operations.title",
    icon: Gauge,
    kinds: ["business"],
    requires: "approvedProvider",
  },
  {
    key: "orders",
    to: "/business/orders",
    labelKey: "market.operations.orders",
    icon: PackageCheck,
    kinds: ["business"],
    requires: "approvedProvider",
    capabilities: ["orders.receive"],
  },
  {
    key: "store",
    to: "/business/store",
    labelKey: "market.store.hubTitle",
    icon: Store,
    kinds: ["business"],
    requires: "approvedProvider",
    capabilities: ["catalog.products", "catalog.services"],
  },
  {
    key: "provider-network",
    to: "/business/partners",
    labelKey: "market.account.providerNetwork",
    icon: Network,
    kinds: ["business"],
    requires: "approvedProvider",
    capabilities: ["relationships.manage", "integrations.manage"],
  },
  {
    key: "service-provider",
    to: "/business/services",
    labelKey: "market.services.providerCenter",
    icon: CalendarClock,
    kinds: ["business"],
    requires: "approvedProvider",
    capabilities: ["bookings.receive"],
  },
  {
    key: "business",
    to: "/business/profile",
    labelKey: "market.identity.manageBusiness",
    icon: Store,
    kinds: ["business"],
  },
  {
    key: "members",
    to: "/go",
    labelKey: "market.account.members",
    icon: Users,
    kinds: ["business"],
  },
  {
    key: "profile",
    to: "/my/profile",
    labelKey: "market.identity.managePersonal",
    icon: User,
    kinds: ["individual"],
  },
  {
    key: "admin",
    to: "/admin",
    labelKey: "market.account.adminPanel",
    icon: ShieldCheck,
    requires: "platformAdmin",
  },
];

export interface MoreViewer {
  signedIn: boolean;
  accountKind: AccountKind | null;
  can: (permission: string) => boolean;
  isPlatformAdmin?: boolean;
  providerApproved?: boolean;
  providerCapabilities?: string[];
}

/** Filter a definition list for one viewer — the only allowed visibility logic. */
export function visibleLinks(defs: MoreLinkDef[], viewer: MoreViewer): MoreLinkDef[] {
  return defs.filter((def) => {
    if (def.requires === "platformAdmin" && viewer.isPlatformAdmin !== true) return false;
    if (def.requires === "approvedProvider" && viewer.providerApproved !== true) return false;
    if (
      def.capabilities?.length &&
      !def.capabilities.some((capability) => viewer.providerCapabilities?.includes(capability))
    )
      return false;
    if (def.kinds && (!viewer.accountKind || !def.kinds.includes(viewer.accountKind))) return false;
    return canSeeLink(def.to, viewer);
  });
}

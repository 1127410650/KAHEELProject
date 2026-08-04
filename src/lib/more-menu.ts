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
  Building2,
  Coins,
  Flag,
  Heart,
  LayoutList,
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
  requires?: "platformAdmin";
}

/** «نشاطي» — activity of the ACTIVE account. Messages/alerts live in the bottom bar. */
export const ACTIVITY_LINKS: MoreLinkDef[] = [
  { key: "my-ads", to: "/dashboard/my-ads", labelKey: "market.dash.myAds", icon: LayoutList },
  { key: "points", to: "/dashboard/points", labelKey: "market.points.title", icon: Coins },
  { key: "favorites", to: "/dashboard/favorites", labelKey: "market.dash.favorites", icon: Heart },
  { key: "reports", to: "/dashboard/reports", labelKey: "market.dash.reports", icon: Flag },
  {
    key: "violations",
    to: "/dashboard/violations",
    labelKey: "market.dash.violations",
    icon: ShieldAlert,
  },
];

/** «إدارة الحساب» — only routes that really exist today. */
export const MANAGE_LINKS: MoreLinkDef[] = [
  // Both account kinds may own exactly one storefront; the hub decides between
  // "create" and "manage" from the live query, never from a constant.
  { key: "store", to: "/dashboard/store", labelKey: "market.store.hubTitle", icon: Store },
  {
    key: "business",
    to: "/dashboard/business",
    labelKey: "market.identity.manageBusiness",
    icon: Building2,
    kinds: ["business"],
  },
  {
    key: "members",
    to: "/me",
    labelKey: "market.account.members",
    icon: Users,
    kinds: ["business"],
  },
  {
    key: "profile",
    to: "/dashboard/profile",
    labelKey: "market.identity.managePersonal",
    icon: User,
  },
  {
    key: "admin",
    to: "/admin",
    labelKey: "market.account.adminPanel",
    icon: ShieldCheck,
    requires: "platformAdmin",
  },
];

/** The one approved path (and the one approved label) for creating a business. */
export const CREATE_BUSINESS_PATH = "/business/new";
export const CREATE_BUSINESS_LABEL_KEY = "market.entry.newBusiness";

export interface MoreViewer {
  signedIn: boolean;
  accountKind: AccountKind | null;
  can: (permission: string) => boolean;
  isPlatformAdmin?: boolean;
}

/** Filter a definition list for one viewer — the only allowed visibility logic. */
export function visibleLinks(defs: MoreLinkDef[], viewer: MoreViewer): MoreLinkDef[] {
  return defs.filter((def) => {
    if (def.requires === "platformAdmin" && viewer.isPlatformAdmin !== true) return false;
    if (def.kinds && (!viewer.accountKind || !def.kinds.includes(viewer.accountKind)))
      return false;
    return canSeeLink(def.to, viewer);
  });
}

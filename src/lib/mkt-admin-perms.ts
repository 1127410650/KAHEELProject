/**
 * Client-side mirror of the database's `mkt_admin_can(...)`.
 *
 * This is purely cosmetic: it decides which tabs and buttons are worth drawing.
 * Every read and every action is re-authorised on the server, so a wrong answer
 * here can only ever hide something a user was allowed to do — never grant it.
 */
import type { PlatformIdentity } from "@/lib/mkt-platform";

export type AdminAbility =
  | "users.view"
  | "users.manage"
  | "businesses.view"
  | "businesses.manage"
  | "listings.view"
  | "listings.review"
  | "reports.view"
  | "reports.manage"
  | "verifications.view"
  | "verifications.manage"
  | "docs.view_sensitive"
  | "notes.read"
  | "notes.write"
  | "restrictions.manage";

const FALLBACK: Record<AdminAbility, string[]> = {
  "users.view": ["accounts.restrict", "accounts.suspend"],
  "users.manage": ["accounts.restrict"],
  "businesses.view": ["businesses.suspend", "verifications.review"],
  "businesses.manage": ["businesses.suspend"],
  "listings.view": ["ads.events_view", "ads.moderation_hide", "reports.audit_view"],
  "listings.review": ["ads.moderation_hide", "ads.moderation_suspend"],
  "reports.view": ["reports.inbox_view"],
  "reports.manage": ["reports.review"],
  "verifications.view": ["verifications.review"],
  "verifications.manage": ["verifications.review"],
  "docs.view_sensitive": ["verifications.review"],
  "notes.read": ["reports.add_internal_note"],
  "notes.write": ["reports.add_internal_note"],
  "restrictions.manage": ["accounts.restrict"],
};

export function adminCan(
  identity: PlatformIdentity | null | undefined,
  ability: AdminAbility,
): boolean {
  if (!identity || identity.restricted) return false;
  if (identity.is_platform_admin) return true;
  const perms = identity.staff_perms;
  if (perms.includes(ability)) return true;
  return FALLBACK[ability].some((perm) => perms.includes(perm));
}

import { supabase } from "@/integrations/supabase/client";

/**
 * Public handles are part of the URL space (/u/<username>), so a handle can never
 * collide with a platform route or an operational word. The same list is enforced
 * in the database by the `mkt_user_profiles_username_reserved` check constraint —
 * this copy only gives the user an immediate, readable error.
 */
export const RESERVED_USERNAMES = [
  "admin",
  "administrator",
  "settings",
  "setting",
  "marketplace",
  "market",
  "support",
  "api",
  "login",
  "logout",
  "register",
  "signup",
  "signin",
  "auth",
  "dashboard",
  "me",
  "u",
  "ads",
  "ad",
  "search",
  "help",
  "root",
  "system",
  "tahqaq",
  "null",
  "undefined",
  "about",
  "contact",
  "privacy",
  "terms",
  "static",
  "assets",
  "public",
  "www",
] as const;

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,31}$/;

/** Strip spaces and lowercase; the stored handle is always canonical. */
export function normalizeUsername(input: string): string {
  return input.trim().replace(/\s+/g, "").toLowerCase();
}

export type UsernameProblem = "format" | "reserved" | "taken";

/** Format and reserved-word check, without touching the network. */
export function checkUsernameShape(input: string): UsernameProblem | null {
  const value = normalizeUsername(input);
  if (!USERNAME_RE.test(value)) return "format";
  if ((RESERVED_USERNAMES as readonly string[]).includes(value)) return "reserved";
  return null;
}

/** Uniqueness across accounts; the database unique index is the final authority. */
export async function isUsernameTaken(input: string, ownUserId: string): Promise<boolean> {
  const value = normalizeUsername(input);
  const { data } = await supabase
    .from("mkt_user_profiles")
    .select("user_id")
    .eq("username", value)
    .neq("user_id", ownUserId)
    .maybeSingle();
  return !!data;
}

/** Phone numbers and bare emails are never acceptable as a display name. */
export function looksLikePhone(value: string): boolean {
  return /^[+\d][\d\s()-]{5,}$/.test(value.trim());
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Sniff the leading bytes so a renamed file (e.g. script.js → photo.png) is
 * rejected before it is ever uploaded. The bucket itself stays private and is
 * only ever read through short-lived signed URLs.
 */
export async function sniffImageType(file: File): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const b = (i: number) => head[i] ?? -1;
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return "image/png";
  const riff = String.fromCharCode(...head.slice(0, 4));
  const webp = String.fromCharCode(...head.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  return null;
}

/**
 * `return_to` sanitising for the account picker.
 *
 * Only same-origin, single-slash paths are ever followed. Everything else —
 * absolute URLs, protocol-relative `//host`, backslash tricks, `javascript:` —
 * collapses to the marketplace home, so choosing an account can never become an
 * open redirect. The check is applied again at navigation time, never trusted
 * from the parsed search object alone.
 */
export function safeInternalPath(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "/";
  const value = raw.trim();
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f\s]/.test(value)) return "/";
  if (/^\/+[a-z][a-z0-9+.-]*:/i.test(value)) return "/";
  return value;
}

/** True when the raw value survives sanitising unchanged (safe to pass along). */
export function isSafeInternalPath(raw: string | null | undefined): boolean {
  return typeof raw === "string" && raw.length > 0 && safeInternalPath(raw) === raw;
}

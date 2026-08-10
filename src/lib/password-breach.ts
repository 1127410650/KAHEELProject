/**
 * Breached-password protection (leaked credential rejection).
 *
 * Uses the Have I Been Pwned range API with k-anonymity: only the first five
 * characters of the SHA-1 hash leave this process, never the password itself
 * and never a full hash. Works in the browser and in the server runtime
 * because it relies on Web Crypto + fetch only.
 *
 * Fails OPEN on network/service errors: an outage must not block a legitimate
 * password change, and the rest of the password policy still applies.
 */

async function sha1Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** True when the password appears in a known public breach corpus. */
export async function isBreachedPassword(password: string): Promise<boolean> {
  const value = password ?? "";
  if (value.length === 0) return false;
  try {
    const hash = await sha1Hex(value);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return false;
    const body = await response.text();
    for (const line of body.split("\n")) {
      const [candidate, count] = line.trim().split(":");
      if (candidate === suffix && Number(count ?? "0") > 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

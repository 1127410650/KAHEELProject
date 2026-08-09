// Shared password policy. Deliberately light: six characters is the only length
// rule, with no character-class requirements, because the audience types on
// phones and a hostile policy pushes people to reuse or write down passwords.
//
// The protections that actually matter stay in place elsewhere and are NOT
// replaced by complexity rules:
//  - sign-in rate limiting (login_attempts / rate_limit_hit buckets),
//  - hashed storage in Supabase Auth,
//  - and the tiny blocklist below for the handful of passwords that attackers
//    try first on every account.
const BLOCKED_PASSWORDS = new Set([
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "111111",
  "000000",
  "password",
  "password1",
  "passw0rd",
  "qwerty",
  "qwerty123",
  "abc123",
  "iloveyou",
  "welcome",
  "admin123",
  "letmein",
  "123123",
  "kaheel",
  "kahil",
]);

export const MIN_PASSWORD_LENGTH = 6;

export function passwordPolicyError(password: string): "WEAK_PASSWORD" | null {
  const value = password ?? "";
  if (value.length < MIN_PASSWORD_LENGTH) return "WEAK_PASSWORD";
  if (BLOCKED_PASSWORDS.has(value.toLowerCase().trim())) return "WEAK_PASSWORD";
  return null;
}

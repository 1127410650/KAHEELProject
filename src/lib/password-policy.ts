// Shared password strength policy. Used by the invite-only sign-up server function
// and by the forced password-change dialog, so both paths reject the same weak inputs.
const COMMON_PASSWORDS = [
  "password",
  "passw0rd",
  "qwerty",
  "welcome",
  "iloveyou",
  "admin",
  "letmein",
  "tahqaq",
];

export function passwordPolicyError(password: string): "WEAK_PASSWORD" | null {
  const value = password ?? "";
  if (value.length < 10) return "WEAK_PASSWORD";
  const lower = value.toLowerCase();
  if (COMMON_PASSWORDS.some((c) => lower.includes(c))) return "WEAK_PASSWORD";
  if (/^(.)\1+$/.test(value)) return "WEAK_PASSWORD";
  // Sequential runs of 5+ digits or letters (123456789, abcdef...), forwards or backwards.
  const seq = "01234567890abcdefghijklmnopqrstuvwxyz";
  for (let i = 0; i + 5 <= lower.length; i += 1) {
    const chunk = lower.slice(i, i + 5);
    const rev = chunk.split("").reverse().join("");
    if (seq.includes(chunk) || seq.includes(rev)) return "WEAK_PASSWORD";
  }
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(value)).length;
  if (classes < 3) return "WEAK_PASSWORD";
  return null;
}

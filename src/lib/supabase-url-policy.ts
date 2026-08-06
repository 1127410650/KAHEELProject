export function validatedSupabaseUrl(
  value: string,
  expectedProjectRef: string | undefined,
  isDevelopment: boolean,
): string {
  const url = new URL(value);
  const isLocalDevelopment =
    isDevelopment && (url.hostname === "localhost" || url.hostname === "127.0.0.1");

  if (url.protocol !== "https:" && !isLocalDevelopment) {
    throw new Error("Supabase must use HTTPS outside local development.");
  }

  if (url.username || url.password) {
    throw new Error("Supabase URL must not contain embedded credentials.");
  }

  if (!isLocalDevelopment) {
    if (url.port && url.port !== "443") {
      throw new Error("Supabase URL uses an unapproved port.");
    }

    const suffix = ".supabase.co";
    if (!url.hostname.endsWith(suffix)) {
      throw new Error("Supabase URL must use the reviewed supabase.co project origin.");
    }

    const actualProjectRef = url.hostname.slice(0, -suffix.length);
    if (!actualProjectRef || actualProjectRef.includes(".")) {
      throw new Error("Supabase URL has an invalid project origin.");
    }

    if (expectedProjectRef && actualProjectRef !== expectedProjectRef) {
      throw new Error("Supabase URL does not match VITE_SUPABASE_PROJECT_ID.");
    }
  }

  return url.origin;
}

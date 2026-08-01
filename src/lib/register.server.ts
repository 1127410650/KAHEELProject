// Server-only public sign-up helper. Rate limited, generic responses, no service key in the browser.
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

function publishableClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(
          typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
        );
        if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
        if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/** Saudi-friendly normalisation: keep digits, store as +9665XXXXXXXX when possible. */
export function normalizeMobile(raw: string): string {
  const digits = (raw ?? "").replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (!digits) return "";
  if (digits.startsWith("966")) return `+${digits}`;
  if (digits.startsWith("0")) return `+966${digits.slice(1)}`;
  if (digits.startsWith("5") && digits.length === 9) return `+966${digits}`;
  return `+${digits}`;
}

export interface RegisterInput {
  full_name: string;
  email: string;
  phone: string;
  national_id?: string;
  password: string;
  origin: string;
  invite_token?: string;
}

export type RegisterResult =
  | { ok: true; needsConfirmation: boolean }
  | { ok: false; error: "RATE_LIMITED" | "INVALID" | "WEAK_PASSWORD" };

export async function registerAccountImpl(
  input: RegisterInput,
  clientKey: string,
): Promise<RegisterResult> {
  const email = (input.email ?? "").trim().toLowerCase();
  const fullName = (input.full_name ?? "").trim();
  const password = input.password ?? "";

  if (!email.includes("@") || fullName.length < 3) return { ok: false, error: "INVALID" };
  if (password.length < 8) return { ok: false, error: "WEAK_PASSWORD" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Two buckets: per-client (IP) and per-email, so neither can be abused alone.
  const [{ data: ipOk }, { data: emailOk }] = await Promise.all([
    supabaseAdmin.rpc("rate_limit_hit", {
      _bucket: "signup_ip",
      _key: clientKey,
      _limit: 5,
      _window: "01:00:00",
    }),
    supabaseAdmin.rpc("rate_limit_hit", {
      _bucket: "signup_email",
      _key: email,
      _limit: 3,
      _window: "01:00:00",
    }),
  ]);
  if (ipOk === false || emailOk === false) return { ok: false, error: "RATE_LIMITED" };

  const origin = /^https?:\/\//.test(input.origin) ? input.origin : "";
  const next = input.invite_token
    ? `${origin}/invite/${encodeURIComponent(input.invite_token)}`
    : `${origin}/auth`;

  const auth = publishableClient();
  const { data, error } = await auth.auth.signUp({
    email,
    password,
    options: {
      ...(next ? { emailRedirectTo: next } : {}),
      data: {
        full_name: fullName,
        phone: normalizeMobile(input.phone ?? ""),
        national_id: (input.national_id ?? "").trim() || null,
      },
    },
  });

  // Never disclose whether the email already exists: the caller always sees the
  // same "check your inbox" outcome.
  if (error) {
    const weak = /password/i.test(error.message);
    return weak ? { ok: false, error: "WEAK_PASSWORD" } : { ok: true, needsConfirmation: true };
  }

  // Keep the phone/national id on the profile row created by the signup trigger.
  if (data.user) {
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: fullName,
        phone: normalizeMobile(input.phone ?? "") || null,
        national_id: (input.national_id ?? "").trim() || null,
      })
      .eq("user_id", data.user.id);
  }

  return { ok: true, needsConfirmation: !data.session };
}

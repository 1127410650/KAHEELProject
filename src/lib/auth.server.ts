// Server-only helpers for identifier-based sign-in. Never imported by client code directly.
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

export interface SignInResult {
  ok: boolean;
  access_token?: string;
  refresh_token?: string;
  /** Generic — never reveals whether an account exists. */
  error?: "INVALID" | "LOCKED";
}

export async function signInWithIdentifierImpl(
  identifier: string,
  password: string,
): Promise<SignInResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const key = identifier.trim().toLowerCase();

  const { data: resolved } = await supabaseAdmin.rpc("resolve_login_identity", {
    _identifier: key,
  });
  const row = Array.isArray(resolved) ? resolved[0] : null;

  if (row?.locked) return { ok: false, error: "LOCKED" };

  const fail = async () => {
    const { data: locked } = await supabaseAdmin.rpc("register_login_result", {
      _identifier: key,
      _success: false,
    });
    return { ok: false, error: locked ? ("LOCKED" as const) : ("INVALID" as const) };
  };

  if (!row?.email || row.is_active === false) return fail();

  const auth = publishableClient();
  const { data, error } = await auth.auth.signInWithPassword({
    email: row.email,
    password,
  });
  if (error || !data.session) return fail();

  await supabaseAdmin.rpc("register_login_result", { _identifier: key, _success: true });
  return {
    ok: true,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
}

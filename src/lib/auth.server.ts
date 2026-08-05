// Server-only helpers for identifier-based sign-in. Never imported by client code directly.
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { normalizeMobile } from "@/lib/register.server";

function publishableClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(
          typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
        );
        if (init?.headers) new Headers(init.headers).forEach((value, name) => headers.set(name, value));
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

interface ResolvedIdentity {
  email: string | null;
  locked: boolean;
  is_active: boolean;
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
  let row = (Array.isArray(resolved) ? resolved[0] : null) as ResolvedIdentity | null;

  // Public phone-first accounts authenticate against a private Auth email alias.
  // Keep the existing resolver as the primary path, but resolve the alias through
  // the private profiles row when older database versions do not yet map phones.
  if (!row?.email) {
    const phone = key.includes("@") ? "" : normalizeMobile(key);
    const profileQuery = supabaseAdmin
      .from("profiles")
      .select("user_id, is_active")
      .limit(1);
    const { data: profile } = key.includes("@")
      ? await profileQuery.eq("email", key).maybeSingle()
      : phone
        ? await profileQuery.eq("phone", phone).maybeSingle()
        : { data: null };

    if (profile?.user_id) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
      if (authUser.user?.email) {
        row = {
          email: authUser.user.email,
          locked: false,
          is_active: profile.is_active !== false,
        };
      }
    }
  }

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

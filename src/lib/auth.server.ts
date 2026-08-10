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

interface LoginCandidate {
  user_id: string;
  email: string | null;
  is_active: boolean;
  locked: boolean;
}

export async function signInWithIdentifierImpl(
  identifier: string,
  password: string,
): Promise<SignInResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const key = identifier.trim().toLowerCase();

  // بحث مرن: البريد كما هو، والرقم بكل صيغه (بالصفر، بدونه، بالمفتاح الدولي).
  const { data: rows, error: resolveError } = await supabaseAdmin.rpc("resolve_login_candidates", {
    _identifier: key,
  });
  let candidates = ((rows ?? []) as LoginCandidate[]).filter(
    (row) => !!row.email && row.is_active !== false,
  );

  // احتياط للنسخ الأقدم من القاعدة: المُحلِّل السابق بصيغة صف واحد.
  if (resolveError || candidates.length === 0) {
    const { data: legacy } = await supabaseAdmin.rpc("resolve_login_identity", {
      _identifier: key,
    });
    const row = (Array.isArray(legacy) ? legacy[0] : null) as
      | { email: string | null; is_active: boolean; locked: boolean }
      | null;
    if (row?.locked) return { ok: false, error: "LOCKED" };
    if (row?.email && row.is_active !== false)
      candidates = [{ user_id: "", email: row.email, is_active: true, locked: false }];
  }

  if (candidates.some((row) => row.locked)) return { ok: false, error: "LOCKED" };

  const fail = async (reason: "NOT_FOUND" | "BAD_PASSWORD") => {
    // تشخيص داخلي فقط: المستخدم يرى رسالة عامة لا تكشف وجود الحساب.
    console.warn(`[auth] sign-in failed: ${reason} candidates=${candidates.length}`);
    const { data: locked } = await supabaseAdmin.rpc("register_login_result", {
      _identifier: key,
      _success: false,
    });
    return { ok: false, error: locked ? ("LOCKED" as const) : ("INVALID" as const) };
  };

  if (candidates.length === 0) return fail("NOT_FOUND");

  // عند تطابق أكثر من حساب بنفس الرقم، تُجرَّب كلمة المرور على كل مرشّح.
  const auth = publishableClient();
  for (const candidate of candidates) {
    const { data, error } = await auth.auth.signInWithPassword({
      email: candidate.email!,
      password,
    });
    if (!error && data.session) {
      await supabaseAdmin.rpc("register_login_result", { _identifier: key, _success: true });
      return {
        ok: true,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      };
    }
  }

  return fail("BAD_PASSWORD");
}


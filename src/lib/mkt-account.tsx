/**
 * Active account context — the single entry point of the marketplace.
 *
 * After signing in the user picks ONE account to work under: their personal
 * account, or a business they hold an active membership in. Everything the
 * platform shows afterwards belongs to that account only.
 *
 * Trust model: the list of accounts and the validation of a remembered choice
 * both come from the database (`mkt_my_accounts` / `mkt_account_context`, which
 * read `auth.uid()` server-side). `localStorage` only remembers the last key so
 * the user is not asked again on every visit — it is re-validated every session,
 * and a key that no longer resolves is dropped.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";

export interface MktAccount {
  account_key: string;
  kind: "individual" | "business";
  /** Null for the personal account; the business entity otherwise. */
  tenant_id: string | null;
  membership_id: string | null;
  role: string | null;
  name: string;
  slug: string | null;
  avatar_url: string | null;
  verification_status: string | null;
  can_publish: boolean;
  permissions: string[];
  /** Display-only city label (no ids), used by the account picker. */
  city?: string | null;
  /** Short activity label for businesses; null for the personal account. */
  activity?: string | null;

}

const REMEMBER_KEY = "tahqaq.mkt.account";

export function rememberedAccountKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(REMEMBER_KEY);
  } catch {
    return null;
  }
}

function remember(key: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (key) window.localStorage.setItem(REMEMBER_KEY, key);
    else window.localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* private mode: the choice is simply asked again next session */
  }
}

function normalize(rows: unknown): MktAccount[] {
  return ((rows ?? []) as MktAccount[]).map((row) => ({
    ...row,
    name: row.name ?? "",
    permissions: row.permissions ?? [],
  }));
}

/** Every account the signed-in user may enter, straight from the database. */
export function useMyAccounts() {
  const { session } = useSession();
  return useQuery({
    queryKey: ["mkt", "my-accounts", session?.user.id ?? null],
    enabled: !!session,
    staleTime: 30_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: true,
    queryFn: async (): Promise<MktAccount[]> => {
      const { data, error } = await supabase.rpc("mkt_my_accounts");
      if (error) throw error;
      return normalize(data);
    },
  });
}

/** Re-checks a single account key server-side; null means "not allowed". */
export async function verifyAccount(accountKey: string): Promise<MktAccount | null> {
  const { data, error } = await supabase.rpc("mkt_account_context", {
    _account_key: accountKey,
  });
  if (error) return null;
  return normalize(data)[0] ?? null;
}

export interface ActiveAccountState {
  accounts: MktAccount[];
  account: MktAccount | null;
  loading: boolean;
  /** True when a remembered account is no longer reachable (membership lost). */
  revoked: boolean;
  /** The account list could not be read (offline/server error) — NOT a sign-out. */
  unavailable: boolean;
  select: (accountKey: string) => Promise<boolean>;
  clear: () => void;
  can: (permission: string) => boolean;
}

export function useActiveAccount(): ActiveAccountState {
  const accounts = useMyAccounts();
  const queryClient = useQueryClient();
  const [key, setKey] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setKey(rememberedAccountKey());
    setHydrated(true);
  }, []);

  const list = accounts.data ?? [];
  const account = useMemo(
    () => (key ? (list.find((a) => a.account_key === key) ?? null) : null),
    [key, list],
  );

  const select = useCallback(
    async (accountKey: string) => {
      const verified = await verifyAccount(accountKey);
      if (!verified) {
        remember(null);
        setKey(null);
        return false;
      }
      // Keep the administrative workspace context aligned with the entity the
      // user just entered, so tenant-scoped RLS sees the same account.
      if (verified.tenant_id) {
        const { error } = await supabase.rpc("set_active_tenant", {
          _tenant_id: verified.tenant_id,
        });
        if (error) return false;
      }
      remember(accountKey);
      setKey(accountKey);
      // Drop every cached row of the previous account, then let the next render
      // refetch what it needs. Never awaited: a single slow/paused query must not
      // block leaving the picker.
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "mkt-account-list" });
      void queryClient.invalidateQueries();
      return true;
    },
    [queryClient],
  );


  const clear = useCallback(() => {
    remember(null);
    setKey(null);
    void queryClient.invalidateQueries();
  }, [queryClient]);

  // No account-selection screen: the personal account is the default context,
  // and a still-valid remembered key is restored instead. Only when the
  // remembered key no longer resolves do we fall back to the personal account.
  useEffect(() => {
    if (!hydrated || accounts.isLoading || accounts.isError || list.length === 0) return;
    if (key && list.some((a) => a.account_key === key)) return;
    const fallback = list.find((a) => a.kind === "individual") ?? list[0]!;
    void select(fallback.account_key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, accounts.isLoading, accounts.isError, key, list.length]);


  const unavailable = accounts.isError;
  const revoked =
    !!key && hydrated && !accounts.isLoading && !unavailable && list.length > 0 && !account;
  useEffect(() => {
    if (revoked) remember(null);
  }, [revoked]);

  const can = useCallback(
    (permission: string) => !!account && account.permissions.includes(permission),
    [account],
  );

  return {
    accounts: list,
    account,
    loading: !hydrated || accounts.isLoading,
    revoked,
    unavailable,
    select,
    clear,
    can,
  };
}

/** Scope helper: turns the active account into a listings filter. */
export function listingScope(account: MktAccount | null) {
  if (!account) return null;
  return account.kind === "business"
    ? { column: "tenant_id" as const, value: account.tenant_id }
    : { column: "tenant_id" as const, value: null };
}

/**
 * Gate for every private surface: the marketplace only works under one chosen
 * account, so a signed-in user without an active context is sent to the
 * selection screen (and back to where they were once they pick).
 */
export function useRequireAccount(revokedMessage?: string): ActiveAccountState {
  const state = useActiveAccount();
  const { session, loading: sessionLoading } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const href = useRouterState({ select: (s) => s.location.href });
  // One redirect per mount: `href` changes as soon as we navigate, so keeping it
  // in the effect deps used to re-fire the redirect endlessly ("Maximum update
  // depth exceeded") instead of settling on the picker.
  const redirected = useRef(false);

  useEffect(() => {
    // Never redirect while the session is still being restored, and never because
    // a network/RPC failure hid the account list: that is retried, not a sign-out.
    if (sessionLoading || !session || state.loading || state.account || state.unavailable) return;
    if (redirected.current || pathname === "/choose-account") return;
    redirected.current = true;
    if (state.revoked && revokedMessage) toast.error(revokedMessage);
    void navigate({
      to: "/choose-account",
      search: { next: href },
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, session, state.loading, state.account, state.revoked, state.unavailable, pathname]);


  return state;
}

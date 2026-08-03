import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { PRESERVED_LOCAL_KEYS } from "@/lib/auth-session";

export interface Account {
  tenant_id: string;
  name_ar: string;
  name_en: string | null;
  tenant_type: string;
  role: string;
  membership_status: string;
  last_seen_at: string | null;
  is_personal: boolean;
  is_current: boolean;
  is_owner: boolean;
  masked_ref: string | null;
}

/**
 * Accounts the signed-in user may enter. The list comes from a security-definer
 * RPC that only returns tenants with an active, unexpired membership — the client
 * never decides which tenant it may open.
 *
 * Signing in never provisions a workspace: personal tenants are no longer created
 * on demand, so new accounts only see the workspaces an admin or invitation gave them.
 */
export function useAccounts() {
  return useQuery({
    queryKey: ["my-accounts"],
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await supabase.rpc("my_accounts");
      if (error) throw error;
      return (data ?? []) as Account[];
    },
    staleTime: 30_000,
  });
}

/** Sort order: last used, then personal, then owned, then by last seen. */
export function sortAccounts(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => {
    if (a.is_current !== b.is_current) return a.is_current ? -1 : 1;
    if (a.is_personal !== b.is_personal) return a.is_personal ? -1 : 1;
    if (a.is_owner !== b.is_owner) return a.is_owner ? -1 : 1;
    const at = a.last_seen_at ? Date.parse(a.last_seen_at) : 0;
    const bt = b.last_seen_at ? Date.parse(b.last_seen_at) : 0;
    if (at !== bt) return bt - at;
    return a.name_ar.localeCompare(b.name_ar);
  });
}

export function accountHome(account: { tenant_type: string; is_personal: boolean; role: string }) {
  if (account.is_personal || account.tenant_type === "individual") return "/me";
  if (account.tenant_type === "service_provider") return "/requests";
  if (account.role === "supervisor") return "/portal";
  return "/dashboard";
}

/**
 * Enter an account. The server verifies auth.uid() + active membership, so a
 * hand-crafted tenant id cannot grant access. On success every cached row of the
 * previous account is dropped and the app is reloaded at the new account's home,
 * replacing history so the browser Back button cannot resurface stale data.
 */
export function useEnterAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tenantId: string) => {
      const { data, error } = await supabase.rpc("activate_account", { _tenant_id: tenantId });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as
        | { tenant_id: string; tenant_type: string; role: string; is_personal: boolean }
        | undefined;
      if (!row) throw new Error("NO_ACTIVE_MEMBERSHIP");
      return row;
    },
    onSuccess: async (row) => {
      await queryClient.cancelQueries();
      queryClient.clear();
      if (typeof window !== "undefined") {
        // Tenant-scoped scratch data (open project/request, signed URLs, drafts).
        for (const store of [window.sessionStorage, window.localStorage]) {
          for (const key of Object.keys(store)) {
            if (key.startsWith("tahqaq.") && !PRESERVED_LOCAL_KEYS.includes(key)) {
              store.removeItem(key);
            }
          }
        }
        window.location.replace(accountHome(row));
      }
    },
  });
}

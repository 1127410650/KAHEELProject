import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface Workspace {
  tenant_id: string;
  name_ar: string;
  name_en: string | null;
  role: string;
  is_current: boolean;
}

/**
 * Workspaces the signed-in user belongs to. The active one is decided by the
 * backend (`current_tenant_id`), which is also what every RLS policy uses — the
 * client never picks a tenant on its own.
 */
export function useWorkspaces() {
  return useQuery({
    queryKey: ["my-tenants"],
    queryFn: async (): Promise<Workspace[]> => {
      const { data, error } = await supabase.rpc("my_tenants");
      if (error) throw error;
      return (data ?? []) as Workspace[];
    },
    staleTime: 60_000,
  });
}

export function useSwitchWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tenantId: string) => {
      const { error } = await supabase.rpc("set_active_tenant", { _tenant_id: tenantId });
      if (error) throw error;
      return tenantId;
    },
    onSuccess: async () => {
      // Every cached row — and the session's roles/permissions — belongs to the
      // previous workspace, so reload instead of patching caches piecemeal.
      await queryClient.invalidateQueries();
      if (typeof window !== "undefined") window.location.reload();
    },

  });
}

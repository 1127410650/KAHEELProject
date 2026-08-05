import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { normalizeStoreTheme, type StoreThemeId } from "@/lib/store-theme";

export async function saveStoreTheme(
  accountKey: string,
  themeId: StoreThemeId,
): Promise<string> {
  const { data, error } = await supabase.rpc(
    "mkt_store_theme_save" as never,
    { _account_key: accountKey, _theme_id: themeId } as never,
  );
  if (error) throw error;
  return data as unknown as string;
}

export function usePublicStoreTheme(slug: string) {
  return useQuery({
    queryKey: ["mkt", "store-theme-public", slug],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<StoreThemeId> => {
      const { data, error } = await supabase.rpc(
        "mkt_store_theme_public" as never,
        { _slug: slug } as never,
      );
      if (error) throw error;
      return normalizeStoreTheme(data);
    },
  });
}

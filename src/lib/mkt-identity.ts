import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useWorkspaces } from "@/hooks/use-workspace";
import {
  BUSINESS_COLUMNS,
  USER_PROFILE_COLUMNS,
  type MktBusiness,
  type MktUserProfile,
} from "@/lib/mkt";

const STORAGE_KEY = "tahqaq.mkt.identity";

/**
 * A publishing identity: the person themselves, or one of the businesses they
 * are an active member of. The identity only decides which name an ad carries —
 * the database still verifies membership and publishing rights on every write.
 */
export interface MktIdentity {
  key: string;
  kind: "individual" | "business";
  /** Null for the individual identity; the business tenant otherwise. */
  tenantId: string | null;
  name: string;
  slug: string | null;
  verificationStatus: string | null;
  /** Personal avatar or business logo; null when none is uploaded. */
  avatarUrl: string | null;
  role?: string | undefined;
}

/** Phone numbers and raw emails are never used as a display name. */
function isPhoneLike(value: string | null | undefined) {
  return !!value && /^[+\d][\d\s()-]{5,}$/.test(value.trim());
}


export function useMyUserProfile() {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  return useQuery({
    queryKey: ["mkt", "my-user-profile", userId],
    enabled: !!userId,
    queryFn: async (): Promise<MktUserProfile | null> => {
      const { data } = await supabase
        .from("mkt_user_profiles")
        .select(USER_PROFILE_COLUMNS)
        .eq("user_id", userId!)
        .maybeSingle();
      return (data as MktUserProfile | null) ?? null;
    },
  });
}

/** Business profiles for every workspace the user can publish under. */
export function useMyBusinesses() {
  const workspaces = useWorkspaces();
  const tenantIds = (workspaces.data ?? [])
    .filter((w) => ["owner", "accountant", "employee", "service_provider"].includes(w.role))
    .map((w) => w.tenant_id);

  const profiles = useQuery({
    queryKey: ["mkt", "my-businesses", tenantIds.join(",")],
    enabled: tenantIds.length > 0,
    queryFn: async (): Promise<MktBusiness[]> => {
      const { data } = await supabase
        .from("mkt_business_profiles")
        .select(BUSINESS_COLUMNS)
        .in("tenant_id", tenantIds);
      return (data ?? []) as MktBusiness[];
    },
  });

  return { workspaces, profiles, tenantIds };
}

export function useIdentities() {
  const { session, profile } = useSession();
  const me = useMyUserProfile();
  const { workspaces, profiles } = useMyBusinesses();

  const identities = useMemo<MktIdentity[]>(() => {
    if (!session) return [];
    const list: MktIdentity[] = [
      {
        key: "individual",
        kind: "individual",
        tenantId: null,
        name: me.data?.display_name || profile?.full_name || session.user.email || "",
        slug: me.data?.username ?? null,
        verificationStatus: me.data?.verification_status ?? null,
      },
    ];
    const bizMap = new Map((profiles.data ?? []).map((b) => [b.tenant_id, b]));
    for (const w of workspaces.data ?? []) {
      if (!["owner", "accountant", "employee", "service_provider"].includes(w.role)) continue;
      const biz = bizMap.get(w.tenant_id);
      list.push({
        key: `business:${w.tenant_id}`,
        kind: "business",
        tenantId: w.tenant_id,
        name: biz?.display_name_ar || w.name_ar,
        slug: biz?.slug ?? null,
        verificationStatus: biz?.verification_status ?? null,
        role: w.role,
      });
    }
    return list;
  }, [session, profile, me.data, profiles.data, workspaces.data]);

  return { identities, loading: me.isLoading || workspaces.isLoading, myProfile: me };
}

/** The identity currently selected in this browser, persisted locally. */
export function useActiveIdentity() {
  const { identities, loading, myProfile } = useIdentities();
  const [key, setKey] = useState<string>("individual");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) setKey(stored);
  }, []);

  const select = useCallback((next: string) => {
    setKey(next);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const active =
    identities.find((i) => i.key === key) ?? identities[0] ?? null;

  return { identities, active, select, loading, myProfile };
}

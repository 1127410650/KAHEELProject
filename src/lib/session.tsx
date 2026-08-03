import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";

import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { consumeManualSignOut } from "@/lib/auth-session";
import { useI18n, type Locale } from "@/i18n";
import type { Permission } from "@/lib/permissions";

export type AppRole = "accountant" | "employee" | "supervisor";

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  national_id: string | null;
  supervisor_id: string | null;
  must_change_password: boolean;
  locale: Locale;
  is_active: boolean;
  always_select_account?: boolean;

}

interface SessionContextValue {
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  isAccountant: boolean;
  isSupervisor: boolean;
  supervisorId: string | null;
  permissions: string[];
  can: (permission: Permission) => boolean;
  loading: boolean;
  /**
   * Explicit three-state auth status. `session === null` while `status` is
   * "loading" is NOT a sign-out: it only means restoration is still running.
   */
  status: "loading" | "authenticated" | "unauthenticated";
  refresh: () => Promise<void>;
}


const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { setLocale, t } = useI18n();

  async function load(userId: string | undefined) {
    if (!userId) {
      setProfile(null);
      setRole(null);
      setPermissions([]);
      return;
    }
    const [{ data: profileRow }, { data: roleRows }, { data: permRows }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("user_permissions").select("permission").eq("user_id", userId),
    ]);
    if (profileRow) {
      setProfile(profileRow as unknown as Profile);
      // The profile locale is only a default: never override an explicit choice
      // the user already made in this browser.
      const chosen =
        typeof window !== "undefined" ? window.localStorage.getItem("tahqaq.locale") : null;
      if (chosen !== "ar" && chosen !== "en") {
        setLocale((profileRow as unknown as Profile).locale ?? "ar");
      }
    }
    const roles = (roleRows ?? []).map((r) => r.role as AppRole);
    setRole(roles.includes("accountant") ? "accountant" : (roles[0] ?? null));
    setPermissions((permRows ?? []).map((p) => p.permission));
  }

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await load(data.session?.user.id);
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_OUT") {
        // Only a real revocation (or a rejected refresh token) reaches here without
        // the manual flag; say so once instead of failing silently.
        if (!consumeManualSignOut()) toast.error(t("auth.expired"));
        setSession(null);
        void load(undefined);
        return;
      }
      if (event !== "SIGNED_IN" && event !== "USER_UPDATED" && event !== "TOKEN_REFRESHED") return;
      // A refreshed token keeps the same identity: never drop the session here.
      if (nextSession) setSession(nextSession);
      if (event !== "TOKEN_REFRESHED") void load(nextSession?.user.id);
    });


    // Permission/role changes made by an admin apply without signing out again.
    const onFocus = () => {
      if (document.visibilityState === "visible") {
        void supabase.auth.getSession().then(({ data }) => load(data.session?.user.id));
      }
    };
    window.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      window.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const value = useMemo<SessionContextValue>(() => {
    const isAccountant = role === "accountant";
    return {
      session,
      profile,
      role,
      isAccountant,
      isSupervisor: !!profile?.supervisor_id,
      supervisorId: profile?.supervisor_id ?? null,
      permissions,
      // Mirrors the database has_perm(): accountants hold every permission.
      can: (permission: Permission) => isAccountant || permissions.includes(permission),
      loading,
      status: loading ? "loading" : session ? "authenticated" : "unauthenticated",
      refresh: async () => {
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
        await load(data.session?.user.id);
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, profile, role, permissions, loading]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

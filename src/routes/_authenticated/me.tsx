import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, ClipboardList, FolderKanban, Info, Repeat2, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useAccounts, sortAccounts, type Account } from "@/hooks/use-accounts";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/me")({
  head: () => ({
    meta: [
      { title: "حسابي الشخصي — تحقّق | My account — Tahqaq" },
      {
        name: "description",
        content:
          "لوحة الحساب الشخصي: طلباتك ودعواتك وتنبيهاتك وعهدتك الخاصة دون أي بيانات للشركات.",
      },
      { property: "og:title", content: "حسابي الشخصي — تحقّق" },
      { property: "og:description", content: "Your personal dashboard on Tahqaq." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PersonalDashboard,
});

const CLOSED_STATUSES = ["executed", "completed", "rejected", "cancelled"];

function PersonalDashboard() {
  const { t, locale } = useI18n();
  const { session, profile, supervisorId, can } = useSession();
  const userId = session?.user.id ?? null;
  const canCustody = can("custody.view_own");

  // Scoped by RLS to the active (personal) workspace, then narrowed to my own rows.
  const openRequests = useQuery({
    queryKey: ["me", "open-requests", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("requests")
        .select("id", { count: "exact", head: true })
        .eq("created_by", userId!)
        .is("deleted_at", null)
        .not("status", "in", `(${CLOSED_STATUSES.join(",")})`);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const unread = useQuery({
    queryKey: ["me", "unread", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const custody = useQuery({
    queryKey: ["me", "custody", supervisorId],
    enabled: !!supervisorId && canCustody,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custody_balances")
        .select("balance")
        .eq("supervisor_id", supervisorId!)
        .maybeSingle();
      if (error) throw error;
      return Number(data?.balance ?? 0);
    },
  });

  const { data: accounts = [] } = useAccounts();
  const others = sortAccounts(accounts).filter((a: Account) => !a.is_current);
  const label = (a: Account) => (locale === "en" ? a.name_en || a.name_ar : a.name_ar);

  const stats: { key: string; value: string; icon: typeof Bell; to: string }[] = [
    {
      key: "me.openRequests",
      value: String(openRequests.data ?? 0),
      icon: ClipboardList,
      to: "/requests",
    },
    { key: "me.unread", value: String(unread.data ?? 0), icon: Bell, to: "/notifications" },
  ];
  if (canCustody) {
    stats.push({
      key: "me.myCustody",
      value: formatMoney(custody.data ?? 0, locale),
      icon: Wallet,
      to: "/my-custody",
    });
  }

  return (
    <div className="space-y-3 md:space-y-5">
      <PageHeader title={t("me.title")} description={t("me.subtitle")} />

      <p className="surface flex items-start gap-2 p-2.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span className="wrap-anywhere">{t("me.personalScope")}</span>
      </p>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.key} to={s.to} className="surface min-w-0 p-2.5 sm:p-4">
            <div className="flex items-center gap-2">
              <s.icon className="size-4 shrink-0 text-primary" aria-hidden />
              <p className="wrap-anywhere text-[11px] font-medium leading-snug text-muted-foreground sm:text-xs">
                {t(s.key)}
              </p>
            </div>
            <p className="mt-1 text-lg font-bold tabular-nums sm:text-2xl">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: "/requests", key: "me.myRequests", icon: ClipboardList },
          { to: "/projects", key: "me.myProjects", icon: FolderKanban },
          { to: "/notifications", key: "nav.notifications", icon: Bell },
          { to: "/settings", key: "nav.mySettings", icon: Info },
        ].map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="surface flex min-w-0 items-center gap-2 p-2.5 text-[12px] font-semibold sm:text-sm"
          >
            <l.icon className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="wrap-anywhere">{t(l.key)}</span>
          </Link>
        ))}
      </div>

      <section className="surface p-2.5 sm:p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[13px] font-bold sm:text-sm">{t("me.myAccounts")}</h2>
            <p className="wrap-anywhere text-[11px] leading-snug text-muted-foreground">
              {t("me.myAccountsHint")}
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0 gap-1.5">
            <Link to="/select-account">
              <Repeat2 className="size-4" aria-hidden />
              <span className="hidden text-xs sm:inline">{t("account.switch")}</span>
            </Link>
          </Button>
        </div>
        {others.length === 0 ? (
          <p className="py-2 text-[11px] text-muted-foreground sm:text-xs">{t("account.empty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {others.slice(0, 5).map((a) => (
              <li key={a.tenant_id} className="flex min-w-0 items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="wrap-anywhere text-[12px] font-semibold leading-snug sm:text-sm">
                    {label(a)}
                  </p>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {t(`account.types.${a.tenant_type}`)} — {t(`team.roles.${a.role}`)}
                  </p>
                </div>
                <Button asChild size="sm" variant="secondary" className="shrink-0">
                  <Link to="/select-account">{t("me.goto")}</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[11px] text-muted-foreground">
        {profile?.full_name || profile?.email || "—"}
      </p>
    </div>
  );
}

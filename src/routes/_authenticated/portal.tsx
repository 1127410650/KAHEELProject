import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ClipboardList, FolderKanban, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import {
  MEMBERSHIP_LABELS_AR,
  MEMBERSHIP_LABELS_EN,
  REQUEST_KIND_LABELS_AR,
  REQUEST_KIND_LABELS_EN,
  type MembershipType,
  type RequestKind,
} from "@/lib/permissions";
import { isClosed } from "@/lib/requests";
import {
  buildRequestTitle,
  PORTAL_GROUPS,
  portalGroupOf,
  resolveNextAction,
  notificationTextKey,
  type PortalGroup,
} from "@/lib/request-ui";
import { PageHeader } from "@/components/AppLayout";
import { NewRequestWizard } from "@/components/NewRequestWizard";
import { RequestCard } from "@/components/RequestCard";
import { formatDate, formatMoney, pickName } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({
    meta: [
      { title: "بوابة المشرف — تحقّق | Supervisor portal — Tahqaq" },
      {
        name: "description",
        content: "بوابة المشرف: تقديم الطلبات في ثلاث خطوات ومتابعة المرحلة والإجراء المطلوب.",
      },
      { property: "og:title", content: "بوابة المشرف — تحقّق" },
      { property: "og:description", content: "Submit and track supervisor requests in Tahqaq." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalPage,
});

function PortalPage() {
  const { t, locale } = useI18n();
  const { supervisorId, isSupervisor, session, role, can } = useSession();
  const kindLabels = locale === "ar" ? REQUEST_KIND_LABELS_AR : REQUEST_KIND_LABELS_EN;
  const membershipLabels = locale === "ar" ? MEMBERSHIP_LABELS_AR : MEMBERSHIP_LABELS_EN;
  const [group, setGroup] = useState<PortalGroup>("action_mine");

  const canViewCustody = can("custody.view_own");
  const canRequestCustody = can("custody.request_movement") || can("custody.request_topup");
  const canRequestPayment = can("payment.request");

  const { data: projects = [] } = useQuery({
    queryKey: ["portal", "projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, code, name_ar, name_en")
        .is("deleted_at", null)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: balance } = useQuery({
    queryKey: ["portal", "balance", supervisorId],
    enabled: !!supervisorId && canViewCustody,
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

  const { data: requests = [] } = useQuery({
    queryKey: ["portal", "requests", session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("*, projects!requests_project_id_fkey(code, name_ar, name_en)")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: myProjects = [] } = useQuery({
    queryKey: ["portal", "my-projects", supervisorId],
    enabled: !!supervisorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_supervisors")
        .select("membership_type, projects(id, code, name_ar, name_en, status)")
        .eq("supervisor_id", supervisorId!)
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["portal", "alerts", session?.user.id],
    enabled: !!session?.user.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, event, title, request_id, read_at, created_at")
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const unreadByRequest = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of alerts) {
      if (!a.request_id) continue;
      map.set(a.request_id, (map.get(a.request_id) ?? 0) + 1);
    }
    return map;
  }, [alerts]);

  const statusById = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of requests) map.set(r.id, r.status);
    return map;
  }, [requests]);

  const cards = useMemo(
    () =>
      requests.map((row) => {
        const projectName = row.projects
          ? pickName(locale, row.projects.name_ar, row.projects.name_en)
          : null;
        const action = resolveNextAction(row, {
          role,
          isSupervisorView: true,
          isRequester: true,
          can: (perm) => can(perm as never),
        });
        return {
          group: portalGroupOf(row.status),
          card: {
            id: row.id,
            request_no: row.request_no,
            title: buildRequestTitle({ ...row, projectName }, t("requests.untitled"), locale),
            typeLabel: kindLabels[row.kind as RequestKind] ?? row.request_type,
            projectName,
            status: row.status,
            requestDate: row.request_date,
            updatedAt: row.updated_at,
            actionText: t(action.messageKey),
            unread: unreadByRequest.get(row.id) ?? 0,
            amountText: row.amount != null ? formatMoney(row.amount, locale) : null,
          },
        };
      }),
    [requests, locale, role, can, t, kindLabels, unreadByRequest],
  );

  const counts = useMemo(() => {
    const base: Record<string, number> = {};
    for (const g of PORTAL_GROUPS) base[g] = 0;
    for (const c of cards) base[c.group] = (base[c.group] ?? 0) + 1;
    return base;
  }, [cards]);

  if (!isSupervisor) {
    return (
      <>
        <PageHeader title={t("portal.title")} />
        <div className="surface p-10 text-center text-muted-foreground">
          {t("portal.notSupervisor")}
        </div>
      </>
    );
  }

  const visible = cards.filter((c) => c.group === group);
  const openRequests = requests.filter((r) => !isClosed(r.status));

  return (
    <>
      <PageHeader
        title={t("portal.title")}
        description={t("portal.myRequestsHint")}
        actions={
          <NewRequestWizard
            projects={projects}
            canRequestCustody={canRequestCustody}
            canRequestPayment={canRequestPayment}
          />
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2 sm:mb-6 sm:gap-3 xl:grid-cols-4">
        {canViewCustody && (
          <StatCard
            label={t("portal.myBalance")}
            valueText={formatMoney(balance ?? 0, locale)}
            icon={Wallet}
            tone="primary"
          />
        )}
        <StatCard
          label={t("portal.openRequests")}
          value={openRequests.length}
          icon={ClipboardList}
          onClick={() => setGroup("in_progress")}
        />
        <StatCard
          label={t("groups.action_mine")}
          value={counts["action_mine"] ?? 0}
          icon={AlertCircle}
          onClick={() => setGroup("action_mine")}
        />
        <StatCard
          label={t("portal.myProjects")}
          value={myProjects.length}
          icon={FolderKanban}
          to="/projects"
        />
      </div>

      <section aria-labelledby="my-requests" className="mb-4 sm:mb-6">
        <h2 id="my-requests" className="mb-2 text-[15px] font-semibold sm:text-base">
          {t("portal.myRequests")}
        </h2>
        <nav
          className="-mx-2.5 mb-2.5 flex snap-x gap-2 overflow-x-auto px-2.5 pb-1 [scrollbar-width:none] sm:mx-0 sm:mb-4 sm:flex-wrap sm:overflow-visible sm:px-0"
          aria-label={t("portal.myRequests")}
        >
          {PORTAL_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              className={cn(
                "inline-flex h-9 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors sm:text-sm",
                group === g
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary",
              )}
            >
              {t(`groups.${g}`)}
              <span className="num rounded-full bg-black/10 px-1.5 text-[11px] dark:bg-white/10">
                {counts[g] ?? 0}
              </span>
            </button>
          ))}
        </nav>

        {visible.length === 0 ? (
          <div className="surface p-6 text-center text-sm text-muted-foreground sm:p-10">
            {t("groups.emptyGroup")}
          </div>
        ) : (
          <div className="grid gap-2 sm:gap-3 lg:grid-cols-2">
            {visible.map((c) => (
              <RequestCard key={c.card.id} data={c.card} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface p-5">
          <h2 className="mb-3 text-sm font-semibold">{t("portal.unreadAlerts")}</h2>
          {alerts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("portal.noAlerts")}</p>
          ) : (
            <ul className="space-y-3">
              {alerts.slice(0, 6).map((a) => (
                <li key={a.id} className="text-sm">
                  {a.request_id ? (
                    <Link
                      to="/requests/$id"
                      params={{ id: a.request_id }}
                      search={{ focus: "action" }}
                      className="font-medium text-primary hover:underline"
                    >
                      {t(notificationTextKey(a.event, statusById.get(a.request_id)))}
                    </Link>
                  ) : (
                    <span className="font-medium">{t(notificationTextKey(a.event))}</span>
                  )}
                  <p className="num text-xs text-muted-foreground">{formatDate(a.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface p-5">
          <h2 className="mb-3 text-sm font-semibold">{t("portal.myProjects")}</h2>
          {myProjects.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("portal.noProjects")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {myProjects.map((m, i) => (
                <li key={`${m.projects?.id ?? i}`} className="py-2.5 text-sm">
                  {m.projects ? (
                    <Link
                      to="/projects/$id"
                      params={{ id: m.projects.id }}
                      className="text-primary hover:underline"
                    >
                      <span className="num">{m.projects.code}</span>{" "}
                      {pickName(locale, m.projects.name_ar, m.projects.name_en)}
                    </Link>
                  ) : (
                    "—"
                  )}
                  <p className="text-xs text-muted-foreground">
                    {membershipLabels[(m.membership_type ?? "primary") as MembershipType]}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  valueText,
  icon: Icon,
  tone = "muted",
  onClick,
  to,
}: {
  label: string;
  value?: number;
  valueText?: string;
  icon: typeof Wallet;
  tone?: "muted" | "primary";
  onClick?: () => void;
  to?: string;
}) {
  const body = (
    <>
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg sm:size-9",
          tone === "primary" ? "bg-primary/10 text-primary" : "bg-secondary text-foreground",
        )}
      >
        <Icon className="size-4 sm:size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] leading-tight text-muted-foreground sm:text-sm">
          {label}
        </span>
        <span className="num block truncate text-[22px] font-bold leading-tight sm:text-2xl">
          {valueText ?? value ?? 0}
        </span>
      </span>
    </>
  );

  const cls =
    "surface flex min-h-[72px] items-center gap-2.5 p-2.5 text-start sm:min-h-0 sm:gap-3 sm:p-3.5";

  if (to)
    return (
      <Link to={to as "/projects"} className={cn(cls, "transition hover:bg-secondary/40")}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cn(cls, "transition hover:bg-secondary/40")}>
        {body}
      </button>
    );
  return <div className={cls}>{body}</div>;
}

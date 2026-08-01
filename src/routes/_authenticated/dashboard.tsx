import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  BarChart3,
  Boxes,
  ChevronDown,
  ClipboardList,
  Clock,
  FileText,
  FolderKanban,
  Info,
  Store,
  Users,
  Wallet,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { PageHeader } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney, formatNumber, pickName } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useWorkspaces } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — تحقّق | Dashboard — Tahqaq" },
      {
        name: "description",
        content: "نظرة عامة على المشاريع والمشرفين وأرصدة العهد في نظام تحقّق.",
      },
      { property: "og:title", content: "لوحة التحكم — تحقّق" },
      { property: "og:description", content: "Overview of projects, supervisors and custody." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { isSupervisor, isAccountant, loading } = useSession();

  if (loading) return null;
  if (isSupervisor && !isAccountant) return <Navigate to="/portal" replace />;

  return <DashboardContent />;
}

type SectionKey =
  | "summary"
  | "projects"
  | "supervisors"
  | "custody"
  | "requests"
  | "invoices"
  | "suppliers"
  | "products"
  | "notifications"
  | "reports";

const LIMIT = 5;
const STALE = 60_000;

/** One controlled accordion row: header bar + lazily rendered body. */
function Section({
  id,
  label,
  icon: Icon,
  count,
  open,
  onToggle,
  children,
}: {
  id: SectionKey;
  label: string;
  icon: typeof Users;
  count?: string | number | null;
  open: boolean;
  onToggle: (id: SectionKey) => void;
  children: ReactNode;
}) {
  return (
    <div className="surface min-w-0 overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={open}
        aria-controls={`sec-${id}`}
        className="flex w-full min-w-0 items-center gap-2 p-2.5 text-start sm:p-3.5"
      >
        <Icon className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="wrap-anywhere min-w-0 flex-1 text-[12.5px] font-semibold leading-snug sm:text-sm">
          {label}
        </span>
        {count != null && count !== "" && (
          <span className="num shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-foreground">
            {count}
          </span>
        )}
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open && (
        <div id={`sec-${id}`} className="min-w-0 border-t border-border p-2.5 sm:p-3.5">
          {children}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-2 sm:p-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className="size-3.5 shrink-0 text-primary" aria-hidden />
        <p className="wrap-anywhere text-[11px] font-medium leading-snug text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="num mt-1 wrap-anywhere text-[15px] font-bold leading-tight sm:text-lg">{value}</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-1 text-[11px] text-muted-foreground sm:text-xs">{text}</p>;
}

function ViewAll({ to, label }: { to: string; label: string }) {
  return (
    <div className="mt-2">
      <Button asChild size="sm" variant="outline" className="h-8 text-[12px]">
        <Link to={to as "/projects"}>{label}</Link>
      </Button>
    </div>
  );
}

function Row({
  primary,
  secondary,
  trailing,
  badge,
  to,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
  badge?: ReactNode;
  to?: { to: string; params?: Record<string, string> };
}) {
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <p className="wrap-anywhere text-[12px] font-semibold leading-snug sm:text-[13px]">
          {primary}
        </p>
        {secondary != null && (
          <p className="wrap-anywhere text-[11px] leading-snug text-muted-foreground">{secondary}</p>
        )}
      </div>
      {trailing != null && (
        <span className="num shrink-0 text-[12px] font-semibold sm:text-[13px]">{trailing}</span>
      )}
      {badge}
    </>
  );
  if (to)
    return (
      <li className="min-w-0">
        <Link
          to={to.to as "/projects/$id"}
          params={to.params as { id: string }}
          className="flex min-w-0 items-center gap-2 py-2"
        >
          {body}
        </Link>
      </li>
    );
  return <li className="flex min-w-0 items-center gap-2 py-2">{body}</li>;
}

function DashboardContent() {
  const { t, locale } = useI18n();
  const { can, isAccountant, session } = useSession();
  const { data: workspaces = [] } = useWorkspaces();
  const currentTenant = workspaces.find((w) => w.is_current)?.tenant_id ?? null;

  const [open, setOpen] = useState<SectionKey | null>("summary");
  const [supervisorFilter, setSupervisorFilter] = useState<string | null>(null);

  // Switching workspace must not keep the previous entity's open section/filter.
  useEffect(() => {
    setOpen("summary");
    setSupervisorFilter(null);
  }, [currentTenant]);

  const toggle = (id: SectionKey) => setOpen((prev) => (prev === id ? null : id));
  const on = (id: SectionKey) => open === id;

  const summary = useQuery({
    queryKey: ["entity", "summary", currentTenant],
    enabled: on("summary"),
    staleTime: STALE,
    queryFn: async () => {
      const [supervisors, projects, balances, pending, action, unread] = await Promise.all([
        supabase.from("supervisors").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("projects").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("custody_balances").select("balance"),
        supabase
          .from("custody_transactions")
          .select("id", { count: "exact", head: true })
          .in("status", ["draft", "under_review"])
          .is("deleted_at", null),
        supabase
          .from("requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["needs_info", "awaiting_reply"])
          .is("deleted_at", null),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .is("read_at", null),
      ]);
      return {
        supervisors: supervisors.count ?? 0,
        projects: projects.count ?? 0,
        custody: (balances.data ?? []).reduce((s, b) => s + Number(b.balance ?? 0), 0),
        pending: pending.count ?? 0,
        action: action.count ?? 0,
        unread: unread.count ?? 0,
      };
    },
  });

  const projects = useQuery({
    queryKey: ["entity", "projects", currentTenant],
    enabled: on("projects"),
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, code, name_ar, name_en, status")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      if (error) throw error;
      return data ?? [];
    },
  });

  const supervisors = useQuery({
    queryKey: ["entity", "supervisors", currentTenant],
    enabled: on("supervisors"),
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supervisors")
        .select("id, name_ar, name_en, phone, is_active")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      if (error) throw error;
      return data ?? [];
    },
  });

  const balances = useQuery({
    queryKey: ["entity", "custody-balances", currentTenant],
    enabled: on("custody"),
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase.from("custody_balances").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Each supervisor's movements are fetched on their own, so no rows can leak
  // into another supervisor's card.
  const custodyTxns = useQuery({
    queryKey: ["entity", "custody-txns", currentTenant, supervisorFilter],
    enabled: on("custody") && !!supervisorFilter,
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custody_transactions")
        .select("id, serial_no, txn_type, amount, txn_date, status")
        .eq("supervisor_id", supervisorFilter!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      if (error) throw error;
      return data ?? [];
    },
  });

  const requests = useQuery({
    queryKey: ["entity", "requests", currentTenant],
    enabled: on("requests"),
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, request_no, title, kind, status, amount, request_date")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(LIMIT);
      if (error) throw error;
      return data ?? [];
    },
  });

  const invoices = useQuery({
    queryKey: ["entity", "invoices", currentTenant],
    enabled: on("invoices"),
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_no, seller_name_raw, total_amount, invoice_date, status")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      if (error) throw error;
      return data ?? [];
    },
  });

  const suppliers = useQuery({
    queryKey: ["entity", "suppliers", currentTenant],
    enabled: on("suppliers"),
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name_ar, name_en, tax_number, city")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      if (error) throw error;
      return data ?? [];
    },
  });

  const products = useQuery({
    queryKey: ["entity", "products", currentTenant],
    enabled: on("products"),
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unified_products")
        .select("id, arabic_name, english_name, category, default_unit")
        .order("arabic_name")
        .limit(LIMIT);
      if (error) throw error;
      return data ?? [];
    },
  });

  const notifications = useQuery({
    queryKey: ["entity", "notifications", currentTenant, session?.user.id],
    enabled: on("notifications"),
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, created_at, read_at, request_id")
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      if (error) throw error;
      return data ?? [];
    },
  });

  const canProducts = isAccountant || can("products.view") || can("prices.view");
  const canReports = isAccountant || can("reports.view");

  const selectedBalance = useMemo(
    () => (balances.data ?? []).find((b) => b.supervisor_id === supervisorFilter) ?? null,
    [balances.data, supervisorFilter],
  );

  return (
    <div className="min-w-0 space-y-3 md:space-y-4">
      <PageHeader title={t("dashboard.title")} description={t("dashboard.description")} />

      <div className="min-w-0 space-y-2 lg:max-w-5xl">
        <Section
          id="summary"
          label={t("entity.sections.summary")}
          icon={Info}
          open={on("summary")}
          onToggle={toggle}
        >
          {summary.isLoading ? (
            <Loading />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <MiniStat
                label={t("dashboard.projectsCount")}
                value={formatNumber(summary.data?.projects)}
                icon={FolderKanban}
              />
              <MiniStat
                label={t("dashboard.supervisorsCount")}
                value={formatNumber(summary.data?.supervisors)}
                icon={Users}
              />
              <MiniStat
                label={t("dashboard.totalCustody")}
                value={formatMoney(summary.data?.custody ?? 0, locale)}
                icon={Wallet}
              />
              <MiniStat
                label={t("dashboard.pendingApprovals")}
                value={formatNumber(summary.data?.pending)}
                icon={Clock}
              />
              <MiniStat
                label={t("entity.actionNeeded")}
                value={formatNumber(summary.data?.action)}
                icon={ClipboardList}
              />
              <MiniStat
                label={t("entity.unread")}
                value={formatNumber(summary.data?.unread)}
                icon={Bell}
              />
            </div>
          )}
        </Section>

        <Section
          id="projects"
          label={t("nav.projects")}
          icon={FolderKanban}
          count={summary.data?.projects ?? null}
          open={on("projects")}
          onToggle={toggle}
        >
          {projects.isLoading ? (
            <Loading />
          ) : (projects.data ?? []).length === 0 ? (
            <Empty text={t("projects.empty")} />
          ) : (
            <ul className="divide-y divide-border">
              {(projects.data ?? []).map((p) => (
                <Row
                  key={p.id}
                  to={{ to: "/projects/$id", params: { id: p.id } }}
                  primary={pickName(locale, p.name_ar, p.name_en)}
                  secondary={<span className="num">{p.code}</span>}
                  badge={<StatusBadge status={p.status} />}
                />
              ))}
            </ul>
          )}
          <ViewAll to="/projects" label={t("common.viewAll")} />
        </Section>

        <Section
          id="supervisors"
          label={t("nav.supervisors")}
          icon={Users}
          count={summary.data?.supervisors ?? null}
          open={on("supervisors")}
          onToggle={toggle}
        >
          {supervisors.isLoading ? (
            <Loading />
          ) : (supervisors.data ?? []).length === 0 ? (
            <Empty text={t("supervisors.empty")} />
          ) : (
            <ul className="divide-y divide-border">
              {(supervisors.data ?? []).map((s) => (
                <Row
                  key={s.id}
                  to={{ to: "/supervisors/$id", params: { id: s.id } }}
                  primary={pickName(locale, s.name_ar, s.name_en)}
                  secondary={<span className="num">{s.phone ?? "—"}</span>}
                />
              ))}
            </ul>
          )}
          <ViewAll to="/supervisors" label={t("common.viewAll")} />
        </Section>

        <Section
          id="custody"
          label={t("nav.custody")}
          icon={Wallet}
          count={balances.data?.length ?? null}
          open={on("custody")}
          onToggle={toggle}
        >
          {balances.isLoading ? (
            <Loading />
          ) : (balances.data ?? []).length === 0 ? (
            <Empty text={t("custody.empty")} />
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {(balances.data ?? []).map((b) => (
                  <button
                    key={b.supervisor_id}
                    type="button"
                    onClick={() =>
                      setSupervisorFilter((prev) =>
                        prev === b.supervisor_id ? null : (b.supervisor_id as string),
                      )
                    }
                    className={cn(
                      "min-w-0 rounded-lg border p-2 text-start transition-colors sm:p-2.5",
                      supervisorFilter === b.supervisor_id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:bg-secondary/40",
                    )}
                  >
                    <p className="wrap-anywhere text-[12px] font-semibold leading-snug">
                      {pickName(locale, b.name_ar, b.name_en)}
                    </p>
                    <p className="num wrap-anywhere mt-0.5 text-[13px] font-bold text-primary">
                      {formatMoney(b.balance, locale)}
                    </p>
                  </button>
                ))}
              </div>

              {supervisorFilter && (
                <div className="mt-2.5 rounded-lg border border-border p-2 sm:p-2.5">
                  <p className="wrap-anywhere mb-1.5 text-[11px] font-semibold text-muted-foreground">
                    {t("custody.statement")} —{" "}
                    {pickName(locale, selectedBalance?.name_ar, selectedBalance?.name_en)}
                  </p>
                  {custodyTxns.isLoading ? (
                    <Loading />
                  ) : (custodyTxns.data ?? []).length === 0 ? (
                    <Empty text={t("custody.empty")} />
                  ) : (
                    <ul className="divide-y divide-border">
                      {(custodyTxns.data ?? []).map((r) => (
                        <Row
                          key={r.id}
                          primary={t(`custody.types.${r.txn_type}`)}
                          secondary={
                            <span className="num">
                              #{r.serial_no} · {formatDate(r.txn_date)}
                            </span>
                          }
                          trailing={formatMoney(r.amount, locale)}
                          badge={<StatusBadge status={r.status} />}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
          <ViewAll to="/custody" label={t("entity.viewAllCustody")} />
        </Section>

        <Section
          id="requests"
          label={t("nav.requests")}
          icon={ClipboardList}
          count={summary.data?.action ?? null}
          open={on("requests")}
          onToggle={toggle}
        >
          {requests.isLoading ? (
            <Loading />
          ) : (requests.data ?? []).length === 0 ? (
            <Empty text={t("requests.empty")} />
          ) : (
            <ul className="divide-y divide-border">
              {(requests.data ?? []).map((r) => (
                <Row
                  key={r.id}
                  to={{ to: "/requests/$id", params: { id: r.id } }}
                  primary={r.title || t("requests.untitled")}
                  secondary={
                    <span className="num">
                      #{r.request_no} · {formatDate(r.request_date)}
                    </span>
                  }
                  trailing={r.amount != null ? formatMoney(r.amount, locale) : undefined}
                  badge={<StatusBadge status={r.status} />}
                />
              ))}
            </ul>
          )}
          <ViewAll to="/requests" label={t("common.viewAll")} />
        </Section>

        <Section
          id="invoices"
          label={t("nav.invoices")}
          icon={FileText}
          open={on("invoices")}
          onToggle={toggle}
        >
          {invoices.isLoading ? (
            <Loading />
          ) : (invoices.data ?? []).length === 0 ? (
            <Empty text={t("common.noData")} />
          ) : (
            <ul className="divide-y divide-border">
              {(invoices.data ?? []).map((i) => (
                <Row
                  key={i.id}
                  primary={i.seller_name_raw || `#${i.invoice_no}`}
                  secondary={
                    <span className="num">
                      {i.invoice_no} · {formatDate(i.invoice_date)}
                    </span>
                  }
                  trailing={formatMoney(i.total_amount, locale)}
                  badge={<StatusBadge status={i.status} />}
                />
              ))}
            </ul>
          )}
          <ViewAll to="/invoices" label={t("common.viewAll")} />
        </Section>

        <Section
          id="suppliers"
          label={t("nav.suppliers")}
          icon={Store}
          open={on("suppliers")}
          onToggle={toggle}
        >
          {suppliers.isLoading ? (
            <Loading />
          ) : (suppliers.data ?? []).length === 0 ? (
            <Empty text={t("common.noData")} />
          ) : (
            <ul className="divide-y divide-border">
              {(suppliers.data ?? []).map((s) => (
                <Row
                  key={s.id}
                  primary={pickName(locale, s.name_ar, s.name_en)}
                  secondary={<span className="num">{s.tax_number ?? s.city ?? "—"}</span>}
                />
              ))}
            </ul>
          )}
          <ViewAll to="/suppliers" label={t("common.viewAll")} />
        </Section>

        {canProducts && (
          <Section
            id="products"
            label={t("nav.products")}
            icon={Boxes}
            open={on("products")}
            onToggle={toggle}
          >
            {products.isLoading ? (
              <Loading />
            ) : (products.data ?? []).length === 0 ? (
              <Empty text={t("common.noData")} />
            ) : (
              <ul className="divide-y divide-border">
                {(products.data ?? []).map((p) => (
                  <Row
                    key={p.id}
                    primary={locale === "en" ? p.english_name || p.arabic_name : p.arabic_name}
                    secondary={p.category ?? p.default_unit ?? "—"}
                  />
                ))}
              </ul>
            )}
            <ViewAll to="/products" label={t("common.viewAll")} />
          </Section>
        )}

        <Section
          id="notifications"
          label={t("nav.notifications")}
          icon={Bell}
          count={summary.data?.unread ?? null}
          open={on("notifications")}
          onToggle={toggle}
        >
          {notifications.isLoading ? (
            <Loading />
          ) : (notifications.data ?? []).length === 0 ? (
            <Empty text={t("me.noNotifications")} />
          ) : (
            <ul className="divide-y divide-border">
              {(notifications.data ?? []).map((n) => (
                <Row
                  key={n.id}
                  primary={n.title}
                  secondary={<span className="num">{formatDate(n.created_at)}</span>}
                />
              ))}
            </ul>
          )}
          <ViewAll to="/notifications" label={t("common.viewAll")} />
        </Section>

        {canReports && (
          <Section
            id="reports"
            label={t("nav.reports")}
            icon={BarChart3}
            open={on("reports")}
            onToggle={toggle}
          >
            <p className="wrap-anywhere text-[11px] leading-snug text-muted-foreground sm:text-xs">
              {t("reports.description")}
            </p>
            <ViewAll to="/reports" label={t("common.viewAll")} />
          </Section>
        )}
      </div>
    </div>
  );
}

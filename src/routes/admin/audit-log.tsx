import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";

import { useI18n } from "@/i18n";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { formatDateTime } from "@/lib/format";
import { loadAuditLog, usePlatformIdentity } from "@/lib/mkt-platform";
import { AdminUserLink } from "@/components/marketplace/AdminEntityLink";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/audit-log")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "سجل التدقيق — إدارة المنصة" },
      {
        name: "description",
        content: "سجل غير قابل للتعديل لكل إجراء إداري: المنفّذ، الجهة، الإجراء، السبب، والوقت بتوقيت الرياض.",
      },
      { property: "og:title", content: "سجل التدقيق — إدارة المنصة" },
      { property: "og:description", content: "سجل التدقيق الإداري في منصة كَحيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAuditLogPage,
});

const ENTITIES = ["user_roles", "mkt_account_restrictions", "mkt_platform_settings", "mkt_listings"];

function AdminAuditLogPage() {
  const { t } = useI18n();
  const { identity } = usePlatformIdentity();
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState("all");

  const staffAccess = identity?.staff_perms.includes("reports.audit_view") === true;

  const log = useQuery({
    queryKey: ["mkt", "admin", "audit", search, entity],
    enabled: identity?.is_platform_admin === true || staffAccess,
    queryFn: () => loadAuditLog(search, entity === "all" ? "" : entity),
  });
  const rows = log.data ?? [];

  return (
    <AdminShell title={t("admin.nav.auditLog")} staffAccess={staffAccess}>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(term);
        }}
      >
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={t("admin.audit.searchHint")}
            className="ps-9"
            aria-label={t("common.search")}
          />
        </div>
        <Select value={entity} onValueChange={setEntity}>
          <SelectTrigger className="min-h-11 w-full sm:w-52">
            <SelectValue aria-label={t("admin.audit.entity")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.audit.allEntities")}</SelectItem>
            {ENTITIES.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline" className="min-h-11">
          {t("common.search")}
        </Button>
      </form>

      {log.isLoading ? (
        <Skeleton className="mt-4 h-48 w-full rounded-xl" />
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{t("common.noData")}</p>
      ) : (
        <div className="mt-4 grid gap-2">
          {rows.map((row) => (
            <article key={row.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-semibold text-foreground">{row.action}</p>
                <time className="shrink-0 text-desc tabular-nums text-muted-foreground">
                  {formatDateTime(row.created_at)}
                </time>
              </div>
              <p className="mt-1 truncate text-desc text-muted-foreground">
                {row.entity_type}
                {row.entity_id ? ` · ${row.entity_id}` : ""}
              </p>
              <p className="mt-1 truncate text-desc text-foreground">
                {t("admin.audit.actor")}:{" "}
                <AdminUserLink
                  id={row.actor_id}
                  name={row.actor_name}
                  fallback={t("admin.audit.system")}
                  className="text-desc"
                />
              </p>

              {row.reason && (
                <p className="mt-[var(--sp-2)] rounded-lg bg-background px-2 py-[var(--sp-2)] text-desc text-foreground">
                  {row.reason}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

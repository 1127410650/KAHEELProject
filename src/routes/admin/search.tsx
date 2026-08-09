import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";

import { useI18n } from "@/i18n";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { runAdminSearch, searchHref, type SearchGroupType } from "@/lib/mkt-admin-search";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const GROUP_LABEL: Record<SearchGroupType, string> = {
  users: "admin.nav.users",
  businesses: "admin.nav.businesses",
  listings: "admin.nav.listings",
  reports: "admin.nav.reports",
  verifications: "admin.nav.verifications",
};

/**
 * Full-page administrative search: the same server function as the header box,
 * so the same permission filtering applies. Every row links to the record's
 * admin file inside the console — never to a public marketplace page.
 */
export const Route = createFileRoute("/admin/search")({
  ssr: "data-only",
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search["q"] === "string" ? search["q"] : "",
  }),
  head: () => ({
    meta: [
      { title: "البحث الإداري — إدارة المنصة" },
      {
        name: "description",
        content:
          "بحث موحّد داخل لوحة الإدارة عن المستخدمين والمتاجر والإعلانات والبلاغات وطلبات التوثيق.",
      },
      { property: "og:title", content: "البحث الإداري — إدارة المنصة" },
      { property: "og:description", content: "بحث موحّد داخل لوحة إدارة منصة گحيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSearchPage,
});

function AdminSearchPage() {
  const { t } = useI18n();
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const [term, setTerm] = useState(q);

  const results = useQuery({
    queryKey: ["mkt", "admin", "search", "page", q],
    enabled: q.trim().length >= 2,
    staleTime: 15_000,
    queryFn: () => runAdminSearch(q, 25),
  });

  const groups = results.data?.groups ?? [];

  function submit() {
    void navigate({ to: "/admin/search", search: { q: term.trim() }, replace: true });
  }

  return (
    <AdminShell title={t("admin.search.title")}>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute inset-y-0 start-2.5 my-auto size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            className="h-11 ps-8"
            aria-label={t("admin.search.label")}
            placeholder={t("admin.search.placeholder")}
          />
        </div>
        <Button type="submit" className="min-h-11" disabled={term.trim().length < 2}>
          {t("admin.search.label")}
        </Button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">{t("admin.search.hint")}</p>

      {q.trim().length < 2 ? null : results.isLoading ? (
        <Skeleton className="mt-5 h-48 w-full rounded-xl" />
      ) : groups.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{t("admin.search.empty")}</p>
      ) : (
        <div className="mt-5 grid gap-4">
          {groups.map((group) => (
            <section key={group.type} className="rounded-xl border border-border bg-card p-4">
              <h2 className="flex items-center justify-between gap-2 text-sm font-bold text-foreground">
                <span className="truncate">{t(GROUP_LABEL[group.type])}</span>
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs tabular-nums">
                  {group.count}
                </span>
              </h2>
              <div className="mt-3 grid gap-2">
                {group.items.map((item) => (
                  <Link
                    key={item.id}
                    to={searchHref(group.type, item.id)}
                    className="flex min-h-12 flex-col justify-center rounded-lg border border-border bg-background px-3 py-2 hover:bg-accent"
                  >
                    <span className="truncate text-sm font-medium text-foreground">
                      {item.title || item.id}
                    </span>
                    {(item.subtitle || item.meta) && (
                      <span className="truncate text-[11px] text-muted-foreground">
                        {[item.subtitle, item.meta].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

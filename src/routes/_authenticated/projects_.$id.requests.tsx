import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { PageHeader } from "@/components/AppLayout";
import { RequestRow } from "@/components/RequestRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime, pickName } from "@/lib/format";
import { REQUEST_KIND_LABELS_AR, REQUEST_KIND_LABELS_EN, type RequestKind } from "@/lib/permissions";
import { buildRequestTitle, simpleStage, SIMPLE_STAGES } from "@/lib/request-ui";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/_authenticated/projects_/$id/requests")({
  head: () => ({
    meta: [
      { title: "جميع طلبات المشروع — تحقّق | Project requests — Tahqaq" },
      {
        name: "description",
        content: "قائمة كاملة لطلبات المشروع مع البحث والفلاتر والترتيب حسب آخر تحديث.",
      },
      { property: "og:title", content: "جميع طلبات المشروع — تحقّق" },
      { property: "og:description", content: "Full, filterable list of project requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectRequestsPage,
});

function ProjectRequestsPage() {
  const { id } = Route.useParams();
  const { t, locale } = useI18n();
  const kindLabels = locale === "ar" ? REQUEST_KIND_LABELS_AR : REQUEST_KIND_LABELS_EN;

  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [kind, setKind] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [requester, setRequester] = useState("all");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, code, name_ar, name_en")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["project-requests", "all", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select(
          "id, request_no, title, kind, request_type, service_type, notes_ar, reason, beneficiary, amount, status, request_date, updated_at, supervisor_id, supervisors(name_ar, name_en)",
        )
        .eq("project_id", id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const requesters = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      const sup = r.supervisors as { name_ar?: string; name_en?: string } | null;
      if (r.supervisor_id && sup) {
        map.set(r.supervisor_id, pickName(locale, sup.name_ar, sup.name_en));
      }
    }
    return [...map.entries()];
  }, [rows, locale]);

  const projectName = project ? pickName(locale, project.name_ar, project.name_en) : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .map((r) => ({
        row: r,
        title: buildRequestTitle({ ...r, projectName }, t("requests.untitled"), locale),
      }))
      .filter(({ row, title }) => {
        if (q && ![row.request_no, title].some((v) => String(v ?? "").toLowerCase().includes(q)))
          return false;
        if (stage !== "all" && simpleStage(row.status) !== stage) return false;
        if (kind !== "all" && row.kind !== kind) return false;
        if (requester !== "all" && row.supervisor_id !== requester) return false;
        if (from && (row.request_date ?? "") < from) return false;
        if (to && (row.request_date ?? "") > to) return false;
        return true;
      });
  }, [rows, query, stage, kind, requester, from, to, projectName, locale, t]);

  const visible = filtered.slice(0, limit);

  return (
    <>
      <PageHeader
        title={t("requests.allProjectRequests")}
        description={projectName ?? ""}
        actions={
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/projects/$id" params={{ id }}>
              <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
              {t("common.back")}
            </Link>
          </Button>
        }
      />

      <div className="surface mb-2.5 grid gap-2 p-2.5 sm:grid-cols-2 sm:gap-3 sm:p-4 lg:grid-cols-3">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search
            className="pointer-events-none absolute inset-inline-start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            placeholder={t("common.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 ps-9 text-[13px]"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{t("common.status")}</Label>
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="h-9 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {[...SIMPLE_STAGES, "rejected", "cancelled"].map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`stage.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{t("requests.requestType")}</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="h-9 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {Object.keys(kindLabels).map((k) => (
                <SelectItem key={k} value={k}>
                  {kindLabels[k as RequestKind]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{t("requests.requester")}</Label>
          <Select value={requester} onValueChange={setRequester}>
            <SelectTrigger className="h-9 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {requesters.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">{t("requests.from")}</Label>
            <Input
              type="date"
              dir="ltr"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 text-[13px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">{t("requests.to")}</Label>
            <Input
              type="date"
              dir="ltr"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 text-[13px]"
            />
          </div>
        </div>
      </div>

      <p className="mb-2 text-[11px] text-muted-foreground">
        {t("requests.sortLatest")} · {t("requests.resultsCount")}:{" "}
        <span className="num">{filtered.length}</span>
      </p>

      {filtered.length === 0 ? (
        <div className="surface p-6 text-center text-[13px] text-muted-foreground sm:p-10">
          {t("requests.noneForProject")}
        </div>
      ) : (
        <div className="surface overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {visible.map(({ row, title }) => (
              <li key={row.id}>
                <RequestRow
                  id={row.id}
                  title={title}
                  requestNo={row.request_no}
                  status={row.status}
                  date={row.request_date}
                />
                <p className="hidden px-4 pb-2 text-[11px] text-muted-foreground sm:block">
                  {kindLabels[row.kind as RequestKind] ?? row.request_type} ·{" "}
                  <span className="num">{formatDateTime(row.updated_at)}</span>
                </p>
              </li>
            ))}
          </ul>
          {visible.length < filtered.length && (
            <div className="p-2.5 sm:p-3">
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-full text-[13px]"
                onClick={() => setLimit((n) => n + PAGE_SIZE)}
              >
                {t("requests.loadMore")}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

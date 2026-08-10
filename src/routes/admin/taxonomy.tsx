import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import {
  activityName,
  addAlias,
  createActivity,
  createActivityGroup,
  loadAdminActivities,
  loadActivityGroups,
  loadAliases,
  loadMigrationReport,
  loadSuggestions,
  mergeActivities,
  removeAlias,
  reviewSuggestion,
  searchActivities,
  updateActivity,
  type AdminActivityRow,
  type ActivitySuggestion,
} from "@/lib/mkt-activities";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/taxonomy")({
  ssr: "data-only",
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search["tab"] === "string" ? (search["tab"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "إدارة الأنشطة — كَحيل" },
      {
        name: "description",
        content: "إدارة قاعدة الأنشطة المرجعية: القطاعات، الأنشطة، الدمج، ومراجعة الاقتراحات.",
      },
      { property: "og:title", content: "إدارة الأنشطة — كَحيل" },
      { property: "og:description", content: "قاعدة الأنشطة المرجعية في كَحيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminActivitiesPage,
});

const selectClass =
  "h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm";

type Tab = "tree" | "suggestions" | "report";

function AdminActivitiesPage() {
  const { t } = useI18n();
  const { tab: tabParam } = Route.useSearch();
  const [tab, setTab] = useState<Tab>(
    tabParam === "suggestions" || tabParam === "report" ? tabParam : "tree",
  );

  return (
    <AdminShell title={t("market.admin.activities")}>
      <div className="min-w-0">
        <nav className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {(
            [
              ["tree", "market.admin.actTree"],
              ["suggestions", "market.admin.actSuggestions"],
              ["report", "market.admin.actReport"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={
                tab === key
                  ? "shrink-0 rounded-full bg-primary px-3 py-[var(--sp-2)] text-desc font-medium text-primary-foreground"
                  : "shrink-0 rounded-full border border-border bg-card px-3 py-[var(--sp-2)] text-desc font-medium text-foreground hover:bg-accent"
              }
            >
              {t(label)}
            </button>
          ))}
        </nav>

        {tab === "tree" && <TreeTab />}
        {tab === "suggestions" && <SuggestionsTab />}
        {tab === "report" && <ReportTab />}
      </div>
    </AdminShell>
  );
}

/* ------------------------------------------------------------------ tree tab */

function TreeTab() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [groupId, setGroupId] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [openAdd, setOpenAdd] = useState<"sector" | "activity" | null>(null);

  const groups = useQuery({
    queryKey: ["mkt", "activity-groups", "admin"],
    queryFn: () => loadActivityGroups(true),
  });
  const rows = useQuery({
    queryKey: ["mkt", "activities", "admin", groupId, q],
    queryFn: () =>
      loadAdminActivities({
        ...(q.trim() ? { q: q.trim() } : {}),
        ...(groupId ? { groupId } : {}),
        includeInactive: true,
        limit: 300,
      }),
  });
  const aliases = useQuery({
    queryKey: ["mkt", "activity-aliases", (rows.data ?? []).map((r) => r.id).join(",")],
    enabled: (rows.data ?? []).length > 0,
    queryFn: () => loadAliases((rows.data ?? []).map((r) => r.id)),
  });

  async function run(action: () => Promise<unknown>, okKey: string) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      toast.success(t(okKey));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["mkt", "activities"] }),
        qc.invalidateQueries({ queryKey: ["mkt", "activity-groups"] }),
        qc.invalidateQueries({ queryKey: ["mkt", "activity-aliases"] }),
      ]);
    } catch (error) {
      toast.error((error as Error)?.message || t("market.actions.failed"));
    } finally {
      setBusy(false);
    }
  }

  const mains = (rows.data ?? []).filter((r) => !r.parent_id);

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid min-w-0 gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
        <div className="relative min-w-0">
          <Search
            className="pointer-events-none absolute start-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={q}
            placeholder={t("market.admin.actSearch")}
            className="h-10 w-full min-w-0 ps-8"
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className={selectClass}
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          aria-label={t("market.activity.sector")}
        >
          <option value="">{t("market.activity.allSectors")}</option>
          {(groups.data ?? []).map((g) => (
            <option key={g.id} value={g.id}>
              {activityName(g, locale)}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" onClick={() => setOpenAdd("sector")}>
          <Plus className="size-3.5" aria-hidden />
          {t("market.admin.actAddSector")}
        </Button>
        <Button type="button" onClick={() => setOpenAdd("activity")}>
          <Plus className="size-3.5" aria-hidden />
          {t("market.admin.actAddActivity")}
        </Button>
      </div>

      {openAdd === "sector" && (
        <AddSectorForm
          busy={busy}
          onCancel={() => setOpenAdd(null)}
          onSubmit={async (values) => {
            await run(() => createActivityGroup(values), "market.admin.actCreated");
            setOpenAdd(null);
          }}
        />
      )}
      {openAdd === "activity" && (
        <AddActivityForm
          busy={busy}
          groups={(groups.data ?? []).map((g) => ({ id: g.id, label: activityName(g, locale) }))}
          mains={mains}
          defaultGroupId={groupId}
          onCancel={() => setOpenAdd(null)}
          onSubmit={async (values) => {
            await run(() => createActivity(values), "market.admin.actCreated");
            setOpenAdd(null);
          }}
        />
      )}

      {rows.isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (rows.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("market.admin.noResults")}</p>
      ) : (
        <ul className="min-w-0 space-y-2">
          {(rows.data ?? []).map((row) => (
            <ActivityRow
              key={row.id}
              row={row}
              busy={busy}
              aliases={(aliases.data ?? []).filter((a) => a.activity_id === row.id)}
              onRun={run}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AddSectorForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: { nameAr: string; nameEn?: string | undefined }) => Promise<void>;
}) {
  const { t } = useI18n();
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  return (
    <div className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-[var(--sp-2)]">
          <Label htmlFor="sec_ar">{t("market.admin.actSectorName")}</Label>
          <Input id="sec_ar" value={nameAr} maxLength={80} onChange={(e) => setNameAr(e.target.value)} />
        </div>
        <div className="min-w-0 space-y-[var(--sp-2)]">
          <Label htmlFor="sec_en">{t("market.admin.actSectorNameEn")}</Label>
          <Input
            id="sec_en"
            dir="ltr"
            value={nameEn}
            maxLength={80}
            onChange={(e) => setNameEn(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy || nameAr.trim().length < 2}
          onClick={() =>
            void onSubmit({ nameAr: nameAr.trim(), ...(nameEn.trim() ? { nameEn: nameEn.trim() } : {}) })
          }
        >
          {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          {t("market.admin.actAddSector")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {t("market.activity.cancel")}
        </Button>
      </div>
    </div>
  );
}

function AddActivityForm({
  busy,
  groups,
  mains,
  defaultGroupId,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  groups: { id: string; label: string }[];
  mains: AdminActivityRow[];
  defaultGroupId: string;
  onCancel: () => void;
  onSubmit: (values: {
    groupId: string;
    nameAr: string;
    nameEn?: string | undefined;
    parentId?: string | undefined;
  }) => Promise<void>;
}) {
  const { t } = useI18n();
  const [groupId, setGroupId] = useState(defaultGroupId || groups[0]?.id || "");
  const [parentId, setParentId] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const parents = mains.filter((m) => m.group_id === groupId);

  return (
    <div className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-[var(--sp-2)]">
          <Label htmlFor="act_group">{t("market.activity.sector")}</Label>
          <select
            id="act_group"
            className={selectClass}
            value={groupId}
            onChange={(e) => {
              setGroupId(e.target.value);
              setParentId("");
            }}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 space-y-[var(--sp-2)]">
          <Label htmlFor="act_parent">{t("market.admin.actParent")}</Label>
          <select
            id="act_parent"
            className={selectClass}
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">{t("market.admin.actNoParent")}</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name_ar}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 space-y-[var(--sp-2)]">
          <Label htmlFor="act_ar">{t("market.admin.actName")}</Label>
          <Input id="act_ar" value={nameAr} maxLength={120} onChange={(e) => setNameAr(e.target.value)} />
        </div>
        <div className="min-w-0 space-y-[var(--sp-2)]">
          <Label htmlFor="act_en">{t("market.admin.actNameEn")}</Label>
          <Input
            id="act_en"
            dir="ltr"
            value={nameEn}
            maxLength={120}
            onChange={(e) => setNameEn(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy || !groupId || nameAr.trim().length < 2}
          onClick={() =>
            void onSubmit({
              groupId,
              nameAr: nameAr.trim(),
              ...(nameEn.trim() ? { nameEn: nameEn.trim() } : {}),
              ...(parentId ? { parentId } : {}),
            })
          }
        >
          {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          {t("market.admin.actAddActivity")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {t("market.activity.cancel")}
        </Button>
      </div>
    </div>
  );
}

function ActivityRow({
  row,
  busy,
  aliases,
  onRun,
}: {
  row: AdminActivityRow;
  busy: boolean;
  aliases: { id: string; alias: string }[];
  onRun: (action: () => Promise<unknown>, okKey: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [aliasText, setAliasText] = useState("");
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeQuery, setMergeQuery] = useState("");
  const targets = useQuery({
    queryKey: ["mkt", "activities", "merge-target", row.id, mergeQuery],
    enabled: mergeOpen && mergeQuery.trim().length >= 2,
    queryFn: () => searchActivities({ q: mergeQuery.trim(), limit: 8 }),
  });

  return (
    <li className="min-w-0 rounded-xl border border-border bg-card p-3">
      <div className="flex min-w-0 flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="min-w-0 text-sm font-semibold text-foreground">
            {row.name_ar}
            {!row.is_active && (
              <span className="ms-2 rounded-full bg-secondary px-2 py-0.5 text-desc text-muted-foreground">
                {t("market.admin.actInactive")}
              </span>
            )}
          </p>
          <p className="min-w-0 text-desc text-muted-foreground">
            {row.group_name_ar}
            {row.parent_name_ar ? ` · ${row.parent_name_ar}` : ""} ·{" "}
            {row.parent_id ? t("market.admin.actSub") : t("market.admin.actMain")} ·{" "}
            {row.entity_count} {t("market.admin.actEntities")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-[var(--sp-2)]">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void onRun(
                () => updateActivity({ id: row.id, isActive: !row.is_active }),
                "market.admin.actUpdated",
              )
            }
          >
            {row.is_active ? t("market.admin.actDisable") : t("market.admin.actEnable")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => setMergeOpen((v) => !v)}
          >
            {t("market.admin.actMerge")}
          </Button>
        </div>
      </div>

      <div className="mt-2 min-w-0 space-y-[var(--sp-2)]">
        <p className="text-desc text-muted-foreground">{t("market.admin.actAliases")}</p>
        <ul className="flex min-w-0 flex-wrap gap-[var(--sp-2)]">
          {aliases.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                disabled={busy}
                className="rounded-full bg-secondary px-2 py-0.5 text-desc text-secondary-foreground"
                onClick={() => void onRun(() => removeAlias(a.id), "market.admin.actUpdated")}
              >
                {a.alias} ×
              </button>
            </li>
          ))}
        </ul>
        <div className="flex min-w-0 flex-wrap gap-2">
          <Input
            value={aliasText}
            maxLength={60}
            placeholder={t("market.admin.actAddAlias")}
            className="h-9 w-full min-w-0 sm:w-56"
            onChange={(e) => setAliasText(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || aliasText.trim().length < 2}
            onClick={() =>
              void onRun(() => addAlias(row.id, aliasText), "market.admin.actUpdated").then(() =>
                setAliasText(""),
              )
            }
          >
            {t("market.admin.actAddAlias")}
          </Button>
        </div>
      </div>

      {mergeOpen && (
        <div className="mt-3 min-w-0 space-y-2 rounded-lg border border-dashed border-border p-3">
          <Label htmlFor={`merge_${row.id}`}>{t("market.admin.actMergeTarget")}</Label>
          <Input
            id={`merge_${row.id}`}
            value={mergeQuery}
            maxLength={80}
            className="h-9 w-full min-w-0"
            onChange={(e) => setMergeQuery(e.target.value)}
          />
          <ul className="min-w-0 divide-y divide-border">
            {(targets.data ?? [])
              .filter((hit) => hit.id !== row.id)
              .map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    disabled={busy}
                    className="flex w-full min-w-0 items-center gap-2 p-2 text-start text-sm hover:bg-accent"
                    onClick={() =>
                      void onRun(
                        () => mergeActivities({ sourceId: row.id, targetId: hit.id }),
                        "market.admin.actMerged",
                      ).then(() => setMergeOpen(false))
                    }
                  >
                    <span className="min-w-0 flex-1">{hit.name_ar}</span>
                    <span className="shrink-0 text-desc text-muted-foreground">
                      {hit.group_name_ar}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </li>
  );
}

/* ----------------------------------------------------------- suggestions tab */

function SuggestionsTab() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const suggestions = useQuery({
    queryKey: ["mkt", "activity-suggestions", "pending"],
    queryFn: () => loadSuggestions("pending"),
  });
  const groups = useQuery({
    queryKey: ["mkt", "activity-groups", "admin"],
    queryFn: () => loadActivityGroups(true),
  });

  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      toast.success(t("market.admin.actReviewed"));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["mkt", "activity-suggestions"] }),
        qc.invalidateQueries({ queryKey: ["mkt", "activities"] }),
      ]);
    } catch (error) {
      toast.error((error as Error)?.message || t("market.actions.failed"));
    } finally {
      setBusy(false);
    }
  }

  if (suggestions.isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if ((suggestions.data ?? []).length === 0)
    return <p className="text-sm text-muted-foreground">{t("market.admin.noResults")}</p>;

  return (
    <ul className="min-w-0 space-y-3">
      {(suggestions.data ?? []).map((s) => (
        <SuggestionRow
          key={s.id}
          suggestion={s}
          busy={busy}
          groups={(groups.data ?? []).map((g) => ({ id: g.id, label: activityName(g, locale) }))}
          onRun={run}
        />
      ))}
    </ul>
  );
}

function SuggestionRow({
  suggestion,
  busy,
  groups,
  onRun,
}: {
  suggestion: ActivitySuggestion;
  busy: boolean;
  groups: { id: string; label: string }[];
  onRun: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"new" | "link" | null>(null);
  const [groupId, setGroupId] = useState(suggestion.group_id ?? groups[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [linkQuery, setLinkQuery] = useState("");
  const hits = useQuery({
    queryKey: ["mkt", "activities", "suggest-link", suggestion.id, linkQuery],
    enabled: mode === "link" && linkQuery.trim().length >= 2,
    queryFn: () => searchActivities({ q: linkQuery.trim(), limit: 8 }),
  });

  return (
    <li className="min-w-0 rounded-xl border border-border bg-card p-3">
      <p className="min-w-0 text-sm font-semibold text-foreground">
        {suggestion.raw_text}
      </p>
      <p className="text-desc text-muted-foreground">{t("market.admin.actPending")}</p>

      <div className="mt-2 flex flex-wrap gap-[var(--sp-2)]">
        <Button type="button" size="sm" variant="outline" onClick={() => setMode("new")}>
          {t("market.admin.actApproveNew")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setMode("link")}>
          {t("market.admin.actLinkExisting")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() =>
            void onRun(() =>
              reviewSuggestion({
                id: suggestion.id,
                decision: "rejected",
                ...(note.trim() ? { note: note.trim() } : {}),
              }),
            )
          }
        >
          {t("market.admin.actReject")}
        </Button>
      </div>

      <div className="mt-2 min-w-0 space-y-[var(--sp-2)]">
        <Label htmlFor={`note_${suggestion.id}`}>{t("market.admin.actReviewNote")}</Label>
        <Input
          id={`note_${suggestion.id}`}
          value={note}
          maxLength={200}
          className="h-9 w-full min-w-0"
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {mode === "new" && (
        <div className="mt-3 min-w-0 space-y-2 rounded-lg border border-dashed border-border p-3">
          <Label htmlFor={`grp_${suggestion.id}`}>{t("market.activity.sector")}</Label>
          <select
            id={`grp_${suggestion.id}`}
            className={selectClass}
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            disabled={busy || !groupId}
            onClick={() =>
              void onRun(async () => {
                const id = await createActivity({
                  groupId,
                  nameAr: suggestion.raw_text,
                  ...(suggestion.parent_id ? { parentId: suggestion.parent_id } : {}),
                });
                await reviewSuggestion({
                  id: suggestion.id,
                  decision: "approved",
                  activityId: id,
                  ...(note.trim() ? { note: note.trim() } : {}),
                });
              })
            }
          >
            {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {t("market.admin.actApproveNew")}
          </Button>
        </div>
      )}

      {mode === "link" && (
        <div className="mt-3 min-w-0 space-y-2 rounded-lg border border-dashed border-border p-3">
          <Label htmlFor={`link_${suggestion.id}`}>{t("market.admin.actMergeTarget")}</Label>
          <Input
            id={`link_${suggestion.id}`}
            value={linkQuery}
            maxLength={80}
            className="h-9 w-full min-w-0"
            onChange={(e) => setLinkQuery(e.target.value)}
          />
          <ul className="min-w-0 divide-y divide-border">
            {(hits.data ?? []).map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  disabled={busy}
                  className="flex w-full min-w-0 items-center gap-2 p-2 text-start text-sm hover:bg-accent"
                  onClick={() =>
                    void onRun(() =>
                      reviewSuggestion({
                        id: suggestion.id,
                        decision: "merged",
                        activityId: hit.id,
                        ...(note.trim() ? { note: note.trim() } : {}),
                      }),
                    )
                  }
                >
                  <span className="min-w-0 flex-1">{hit.name_ar}</span>
                  <span className="shrink-0 text-desc text-muted-foreground">
                    {hit.group_name_ar}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

/* ---------------------------------------------------------------- report tab */

function ReportTab() {
  const { t } = useI18n();
  const report = useQuery({
    queryKey: ["mkt", "activity-migration-report"],
    queryFn: loadMigrationReport,
  });

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of report.data ?? []) map.set(row.bucket, (map.get(row.bucket) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [report.data]);

  if (report.isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;

  return (
    <div className="min-w-0 space-y-4">
      <p className="rounded-lg bg-secondary/50 p-[var(--sp-3)] text-desc leading-relaxed text-muted-foreground">
        {t("market.admin.actReportHint")}
      </p>

      <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-desc text-muted-foreground">{t("market.admin.actTotal")}</p>
          <p className="text-lg font-bold text-foreground">{(report.data ?? []).length}</p>
        </div>
        {counts.map(([bucket, count]) => (
          <div key={bucket} className="rounded-xl border border-border bg-card p-3">
            <p className="min-w-0 text-desc text-muted-foreground">
              {t(`market.admin.actBucket.${bucket}`)}
            </p>
            <p className="text-lg font-bold text-foreground">{count}</p>
          </div>
        ))}
      </div>

      <ul className="min-w-0 space-y-2">
        {(report.data ?? []).slice(0, 200).map((row, index) => (
          <li
            key={`${row.tenant_id}-${index}`}
            className="min-w-0 rounded-xl border border-border bg-card p-3"
          >
            <p className="min-w-0 text-sm font-medium text-foreground">
              {row.legacy_text || "—"}
            </p>
            <p className="min-w-0 text-desc text-muted-foreground">
              {t(`market.admin.actBucket.${row.bucket}`)}
              {row.matched_name_ar
                ? ` · ${t("market.admin.actSuggested")}: ${row.matched_name_ar}`
                : ""}
              {row.score === null
                ? ""
                : ` · ${t("market.admin.actScore")}: ${Math.round(row.score * 100)}%`}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

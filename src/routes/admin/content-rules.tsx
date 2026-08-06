import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, PlayCircle, Trash2 } from "lucide-react";

import { useI18n } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import { adminErrorMessage } from "@/lib/mkt-platform";
import {
  deleteModerationRule,
  loadModerationRules,
  loadModerationThresholds,
  loadRecentJobRuns,
  previewRuleMatches,
  runModerationTickNow,
  saveModerationRule,
  type ModerationRule,
  type RuleAction,
  type RuleCategory,
  type RuleKind,
  type RuleLang,
  type RuleSeverity,
} from "@/lib/mkt-moderation";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { AdminStatusBadge, type AdminTone } from "@/components/marketplace/AdminStatusBadge";
import { ReasonDialog } from "@/components/marketplace/ReasonDialog";
import { Panel } from "@/components/marketplace/AdminDetail";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/content-rules")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "قواعد فحص المحتوى — إدارة المنصة" },
      {
        name: "description",
        content: "إدارة قواعد الفحص الآلي للإعلانات وعتبات القرار وسجل تشغيل مهمة الفحص الدورية — لمدير النظام فقط.",
      },
      { property: "og:title", content: "قواعد فحص المحتوى — إدارة المنصة" },
      { property: "og:description", content: "إدارة قواعد فحص المحتوى في منصة كحلي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminContentRulesPage,
});

const KINDS: RuleKind[] = ["word", "phrase", "regex"];
const LANGS: RuleLang[] = ["ar", "en", "any"];
const CATEGORIES: RuleCategory[] = [
  "profanity",
  "sexual",
  "threat",
  "hate",
  "racism",
  "defamation",
  "incitement",
  "morals",
  "fraud",
  "prohibited",
  "competitor",
  "bypass",
  "contact",
  "spam",
  "other",
];
const SEVERITIES: RuleSeverity[] = ["low", "medium", "high"];
const ACTIONS: RuleAction[] = ["flag", "review", "block", "allow"];

const SEVERITY_TONE: Record<RuleSeverity, AdminTone> = {
  low: "idle",
  medium: "pending",
  high: "critical",
};
const ACTION_TONE: Record<RuleAction, AdminTone> = {
  flag: "idle",
  review: "pending",
  block: "critical",
  allow: "done",
};

type Draft = {
  id: string | null;
  kind: RuleKind;
  pattern: string;
  lang: RuleLang;
  category: RuleCategory;
  severity: RuleSeverity;
  action: RuleAction;
  weight: string;
  is_active: boolean;
  notes: string;
};

const EMPTY_DRAFT: Draft = {
  id: null,
  kind: "word",
  pattern: "",
  lang: "any",
  category: "other",
  severity: "medium",
  action: "flag",
  weight: "5",
  is_active: true,
  notes: "",
};

function ruleToDraft(rule: ModerationRule): Draft {
  return {
    id: rule.id,
    kind: rule.kind,
    pattern: rule.pattern,
    lang: rule.lang,
    category: rule.category,
    severity: rule.severity,
    action: rule.action,
    weight: String(rule.weight),
    is_active: rule.is_active,
    notes: rule.notes ?? "",
  };
}

function AdminContentRulesPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ModerationRule | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [toggleBusy, setToggleBusy] = useState<string | null>(null);

  const [sampleText, setSampleText] = useState("");
  const [tickBusy, setTickBusy] = useState(false);

  const rules = useQuery({ queryKey: ["mkt", "admin", "moderation-rules"], queryFn: loadModerationRules });
  const thresholds = useQuery({
    queryKey: ["mkt", "admin", "moderation-thresholds"],
    queryFn: loadModerationThresholds,
  });
  const jobRuns = useQuery({ queryKey: ["mkt", "admin", "moderation-job-runs"], queryFn: () => loadRecentJobRuns(10) });

  const rows = rules.data ?? [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (term && !row.pattern.toLowerCase().includes(term)) return false;
      if (categoryFilter !== "all" && row.category !== categoryFilter) return false;
      if (actionFilter !== "all" && row.action !== actionFilter) return false;
      if (severityFilter !== "all" && row.severity !== severityFilter) return false;
      if (activeFilter === "active" && !row.is_active) return false;
      if (activeFilter === "inactive" && row.is_active) return false;
      return true;
    });
  }, [rows, search, categoryFilter, actionFilter, severityFilter, activeFilter]);

  const preview = useMemo(
    () => (sampleText.trim() ? previewRuleMatches(sampleText, rows) : []),
    [sampleText, rows],
  );
  const matchedPreview = preview.filter((p) => p.matched);

  function validateDraft(d: Draft): string | null {
    if (!d.pattern.trim()) return t("admin.contentRules.errorPatternRequired");
    if (d.kind === "regex") {
      try {
        // eslint-disable-next-line no-new
        new RegExp(d.pattern);
      } catch {
        return t("admin.contentRules.errorInvalidRegex");
      }
    }
    const weight = Number(d.weight);
    if (!Number.isFinite(weight) || weight < 0 || weight > 20) {
      return t("admin.contentRules.errorWeightRange");
    }
    return null;
  }

  async function submitDraft() {
    if (!draft) return;
    const error = validateDraft(draft);
    if (error) {
      setDraftError(error);
      return;
    }
    setDraftError(null);
    setSavingDraft(true);
    try {
      await saveModerationRule({
        id: draft.id,
        kind: draft.kind,
        pattern: draft.pattern.trim(),
        lang: draft.lang,
        category: draft.category,
        severity: draft.severity,
        action: draft.action,
        weight: Math.round(Number(draft.weight)),
        is_active: draft.is_active,
        notes: draft.notes.trim() || null,
      });
      toast.success(t("admin.actionDone"));
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "moderation-rules"] });
    } catch (err) {
      toast.error(adminErrorMessage(err, t("admin.actionFailed")));
    } finally {
      setSavingDraft(false);
    }
  }

  async function toggleActive(rule: ModerationRule, next: boolean) {
    setToggleBusy(rule.id);
    try {
      await saveModerationRule({
        id: rule.id,
        kind: rule.kind,
        pattern: rule.pattern,
        lang: rule.lang,
        category: rule.category,
        severity: rule.severity,
        action: rule.action,
        weight: rule.weight,
        is_active: next,
        notes: rule.notes,
      });
      toast.success(t("admin.actionDone"));
      await queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "moderation-rules"] });
    } catch (err) {
      toast.error(adminErrorMessage(err, t("admin.actionFailed")));
    } finally {
      setToggleBusy(null);
    }
  }

  async function confirmDelete(reason: string) {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteModerationRule(deleteTarget.id, reason);
      toast.success(t("admin.actionDone"));
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "moderation-rules"] });
    } catch (err) {
      toast.error(adminErrorMessage(err, t("admin.actionFailed")));
    } finally {
      setDeleteBusy(false);
    }
  }

  async function runTick() {
    setTickBusy(true);
    try {
      const result = await runModerationTickNow();
      toast.success(result.ok ? t("admin.contentRules.tickSuccess") : t("admin.contentRules.tickFinishedWithIssues"));
      await queryClient.invalidateQueries({ queryKey: ["mkt", "admin", "moderation-job-runs"] });
    } catch (err) {
      toast.error(adminErrorMessage(err, t("admin.actionFailed")));
    } finally {
      setTickBusy(false);
    }
  }

  return (
    <AdminShell title={t("admin.nav.contentRules")} systemOwnerOnly>
      <div className="space-y-4">
        <Panel title={t("admin.contentRules.thresholdsTitle")}>
          {thresholds.isLoading ? (
            <Skeleton className="h-12 w-full rounded-lg" />
          ) : (
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-muted-foreground">
                {t("admin.contentRules.reviewThreshold")}:{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {thresholds.data?.thresholds?.review ?? "—"}
                </span>
              </span>
              <span className="text-muted-foreground">
                {t("admin.contentRules.blockThreshold")}:{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {thresholds.data?.thresholds?.block ?? "—"}
                </span>
              </span>
              <span className="text-muted-foreground">
                {t("admin.contentRules.policyVersion")}:{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {thresholds.data?.policyVersion ?? "—"}
                </span>
              </span>
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">{t("admin.contentRules.thresholdsHint")}</p>
        </Panel>

        <Panel
          title={t("admin.contentRules.title")}
          actions={
            <Button
              size="sm"
              className="min-h-11 gap-1.5"
              onClick={() => {
                setDraft({ ...EMPTY_DRAFT });
                setDraftError(null);
              }}
            >
              <Plus className="size-4" aria-hidden />
              {t("admin.contentRules.addRule")}
            </Button>
          }
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.contentRules.searchPlaceholder")}
              className="h-11"
            />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-11"><SelectValue placeholder={t("admin.contentRules.category")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.contentRules.all")}</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{t(`admin.moderation.category.${c}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-11"><SelectValue placeholder={t("admin.contentRules.action")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.contentRules.all")}</SelectItem>
                {ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>{t(`admin.contentRules.actionValue.${a}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="h-11"><SelectValue placeholder={t("admin.contentRules.severity")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.contentRules.all")}</SelectItem>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>{t(`admin.moderation.severity.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger className="h-11"><SelectValue placeholder={t("admin.contentRules.status")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.contentRules.all")}</SelectItem>
                <SelectItem value="active">{t("admin.contentRules.activeOnly")}</SelectItem>
                <SelectItem value="inactive">{t("admin.contentRules.inactiveOnly")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4">
            {rules.isLoading ? (
              <Skeleton className="h-40 w-full rounded-xl" />
            ) : filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("common.noData")}</p>
            ) : (
              <ul className="grid gap-2">
                {filtered.map((rule) => (
                  <li key={rule.id} className="rounded-lg border border-border bg-background p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-foreground">{rule.pattern}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <AdminStatusBadge tone="idle" label={t(`admin.contentRules.kindValue.${rule.kind}`)} />
                          <AdminStatusBadge tone="idle" label={t(`admin.moderation.category.${rule.category}`)} />
                          <AdminStatusBadge tone={SEVERITY_TONE[rule.severity]} label={t(`admin.moderation.severity.${rule.severity}`)} />
                          <AdminStatusBadge tone={ACTION_TONE[rule.action]} label={t(`admin.contentRules.actionValue.${rule.action}`)} />
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {t("admin.moderation.weight")}: {rule.weight}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {rule.lang === "any" ? t("admin.contentRules.langAny") : rule.lang.toUpperCase()}
                          </span>
                        </div>
                        {rule.notes && <p className="mt-1 break-words text-xs text-muted-foreground">{rule.notes}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="grid min-h-11 min-w-11 place-items-center">
                          <Switch
                            checked={rule.is_active}
                            disabled={toggleBusy === rule.id}
                            onCheckedChange={(next) => void toggleActive(rule, next)}
                            aria-label={t("admin.contentRules.toggleActive")}
                          />
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-11"
                          aria-label={t("common.edit")}
                          onClick={() => {
                            setDraft(ruleToDraft(rule));
                            setDraftError(null);
                          }}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-11 text-destructive"
                          aria-label={t("common.delete")}
                          onClick={() => setDeleteTarget(rule)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel title={t("admin.contentRules.testTitle")}>
          <p className="text-xs text-muted-foreground">{t("admin.contentRules.testHint")}</p>
          <Textarea
            value={sampleText}
            onChange={(e) => setSampleText(e.target.value)}
            rows={4}
            className="mt-2"
            placeholder={t("admin.contentRules.testPlaceholder")}
          />
          <div className="mt-3">
            {sampleText.trim() === "" ? null : matchedPreview.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("admin.contentRules.testNoMatch")}</p>
            ) : (
              <ul className="grid gap-1.5">
                {matchedPreview.map((m) => (
                  <li key={m.rule.id} className="flex flex-wrap items-center gap-1.5 rounded-lg bg-background px-3 py-2 text-xs">
                    <AdminStatusBadge tone={ACTION_TONE[m.rule.action]} label={t(`admin.contentRules.actionValue.${m.rule.action}`)} />
                    <span className="font-medium text-foreground">{m.rule.pattern}</span>
                    <span className="text-muted-foreground">· {t(`admin.moderation.category.${m.rule.category}`)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel
          title={t("admin.contentRules.jobsTitle")}
          actions={
            <Button size="sm" className="min-h-11 gap-1.5" disabled={tickBusy} onClick={() => void runTick()}>
              <PlayCircle className="size-4" aria-hidden />
              {t("admin.contentRules.runNow")}
            </Button>
          }
        >
          {jobRuns.isLoading ? (
            <Skeleton className="h-32 w-full rounded-xl" />
          ) : (jobRuns.data ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("common.noData")}</p>
          ) : (
            <ul className="grid gap-1.5">
              {(jobRuns.data ?? []).map((run, index) => (
                <li key={`${run.job}-${run.started_at}-${index}`} className="rounded-lg bg-background px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <AdminStatusBadge tone={run.ok ? "done" : "critical"} label={t(run.ok ? "admin.contentRules.jobOk" : "admin.contentRules.jobFailed")} />
                      <span className="truncate text-sm font-medium text-foreground">{run.job}</span>
                      {run.source && <span className="text-[11px] text-muted-foreground">({run.source})</span>}
                    </div>
                    <span className="text-[11px] tabular-nums text-muted-foreground">{formatDateTime(run.started_at)}</span>
                  </div>
                  <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                    {t("admin.contentRules.duration")}: {run.duration_ms != null ? `${run.duration_ms}ms` : "—"}
                  </p>
                  {run.error && <p className="mt-1 break-words text-xs text-destructive">{run.error}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Dialog open={!!draft} onOpenChange={(next) => { if (!next) { setDraft(null); setDraftError(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? t("admin.contentRules.editRule") : t("admin.contentRules.addRule")}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid gap-3">
              <label className="block text-xs font-medium text-foreground">
                {t("admin.contentRules.pattern")}
                <Textarea
                  value={draft.pattern}
                  onChange={(e) => setDraft({ ...draft, pattern: e.target.value })}
                  rows={2}
                  className="mt-1.5"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-medium text-foreground">
                  {t("admin.contentRules.kind")}
                  <Select value={draft.kind} onValueChange={(v) => setDraft({ ...draft, kind: v as RuleKind })}>
                    <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {KINDS.map((k) => <SelectItem key={k} value={k}>{t(`admin.contentRules.kindValue.${k}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-xs font-medium text-foreground">
                  {t("admin.contentRules.lang")}
                  <Select value={draft.lang} onValueChange={(v) => setDraft({ ...draft, lang: v as RuleLang })}>
                    <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LANGS.map((l) => <SelectItem key={l} value={l}>{l === "any" ? t("admin.contentRules.langAny") : l.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-xs font-medium text-foreground">
                  {t("admin.contentRules.category")}
                  <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v as RuleCategory })}>
                    <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{t(`admin.moderation.category.${c}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-xs font-medium text-foreground">
                  {t("admin.contentRules.severity")}
                  <Select value={draft.severity} onValueChange={(v) => setDraft({ ...draft, severity: v as RuleSeverity })}>
                    <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{t(`admin.moderation.severity.${s}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-xs font-medium text-foreground">
                  {t("admin.contentRules.action")}
                  <Select value={draft.action} onValueChange={(v) => setDraft({ ...draft, action: v as RuleAction })}>
                    <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACTIONS.map((a) => <SelectItem key={a} value={a}>{t(`admin.contentRules.actionValue.${a}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-xs font-medium text-foreground">
                  {t("admin.contentRules.weight")}
                  <Input
                    value={draft.weight}
                    inputMode="numeric"
                    className="mt-1.5 h-11"
                    onChange={(e) => setDraft({ ...draft, weight: e.target.value })}
                  />
                </label>
              </div>
              <label className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-secondary px-3">
                <span className="text-sm text-foreground">{t("admin.contentRules.toggleActive")}</span>
                <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
              </label>
              <label className="block text-xs font-medium text-foreground">
                {t("admin.contentRules.notes")}
                <Textarea
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  rows={2}
                  className="mt-1.5"
                />
              </label>
              {draftError && <p className="text-xs text-destructive">{draftError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDraft(null); setDraftError(null); }} disabled={savingDraft}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void submitDraft()} disabled={savingDraft}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReasonDialog
        open={!!deleteTarget}
        title={t("admin.contentRules.deleteRule")}
        description={deleteTarget?.pattern}
        confirmLabel={t("common.delete")}
        destructive
        pending={deleteBusy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={(reason) => void confirmDelete(reason)}
      />
    </AdminShell>
  );
}

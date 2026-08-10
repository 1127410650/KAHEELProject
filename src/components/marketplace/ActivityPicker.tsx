import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import {
  activityName,
  loadActivityGroups,
  searchActivities,
  suggestActivity,
  type ActivitySearchHit,
} from "@/lib/mkt-activities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ActivityChoice {
  id: string;
  name_ar: string;
  name_en: string | null;
  group_id: string;
}

export interface ActivityValue {
  main: ActivityChoice | null;
  subs: ActivityChoice[];
}

interface Props {
  value: ActivityValue;
  onChange: (value: ActivityValue) => void;
  /** Only used to attach a suggestion to the entity being edited. */
  tenantId?: string | null | undefined;
  disabled?: boolean | undefined;
}

const MIN_QUERY = 2;
const selectClass =
  "h-11 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm sm:h-10";

function toChoice(hit: ActivitySearchHit): ActivityChoice {
  return { id: hit.id, name_ar: hit.name_ar, name_en: hit.name_en, group_id: hit.group_id };
}

/** Small debounce so search starts while typing without hammering the server. */
function useDebounced(value: string, ms = 250): string {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setOut(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return out;
}

/**
 * Activity selector driven by the reference taxonomy.
 *
 * Nothing is ever selected automatically: results are listed by confidence and
 * the user picks. One main activity, many sub activities inside the same
 * sector. The sector list is open — any sector staff adds shows up here — and
 * when the tree still has no match, the user picks "my activity is not listed"
 * and writes it; that text is stored as a *suggestion* for the admin queue and
 * never becomes an approved activity by itself.
 */
export function ActivityPicker({ value, onChange, tenantId, disabled }: Props) {
  const { t, locale } = useI18n();
  const [groupId, setGroupId] = useState("");
  const [mainQuery, setMainQuery] = useState("");
  const [subQuery, setSubQuery] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestText, setSuggestText] = useState("");
  const mainQ = useDebounced(mainQuery);
  const subQ = useDebounced(subQuery);

  const groups = useQuery({
    queryKey: ["mkt", "activity-groups"],
    staleTime: 300_000,
    queryFn: () => loadActivityGroups(),
  });

  const mainResults = useQuery({
    queryKey: ["mkt", "activities", "search-main", groupId, mainQ],
    enabled: mainQ.trim().length >= MIN_QUERY && !value.main,
    queryFn: () =>
      searchActivities({
        q: mainQ.trim(),
        groupId: groupId || null,
        onlyMain: true,
        limit: 12,
      }),
  });

  const subResults = useQuery({
    queryKey: ["mkt", "activities", "search-sub", value.main?.id ?? "", subQ],
    enabled: !!value.main && subQ.trim().length >= MIN_QUERY,
    queryFn: () =>
      searchActivities({
        q: subQ.trim(),
        parentId: value.main?.id ?? null,
        onlyMain: false,
        limit: 12,
      }),
  });

  const subIds = useMemo(() => new Set(value.subs.map((s) => s.id)), [value.subs]);

  async function suggest(text: string) {
    const clean = text.trim();
    if (suggesting || clean.length < 2) return;
    setSuggesting(true);
    try {
      await suggestActivity({
        text: clean,
        groupId: value.main?.group_id ?? groupId ?? null,
        parentId: value.main?.id ?? null,
        tenantId: tenantId ?? null,
      });
      toast.success(t("market.activity.suggestSent"));
      setSuggestOpen(false);
      setSuggestText("");
    } catch {
      toast.error(t("market.activity.suggestFailed"));
    } finally {
      setSuggesting(false);
    }
  }

  const noMainMatch =
    mainQ.trim().length >= MIN_QUERY &&
    !value.main &&
    !mainResults.isFetching &&
    (mainResults.data ?? []).length === 0;

  return (
    <div className="space-y-4">
      {/* ---- sector filter: optional, and open to any new sector ---- */}
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="activity_sector">{t("market.activity.sector")}</Label>
        <select
          id="activity_sector"
          className={selectClass}
          value={groupId}
          disabled={disabled || !!value.main}
          onChange={(e) => setGroupId(e.target.value)}
        >
          <option value="">{t("market.activity.allSectors")}</option>
          {(groups.data ?? []).map((g) => (
            <option key={g.id} value={g.id}>
              {activityName(g, locale)}
            </option>
          ))}
        </select>
      </div>

      {/* ---- main activity: exactly one ---- */}
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="activity_main">{t("market.activity.main")}</Label>
        {value.main ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/40 p-2.5">
            <Check className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 break-words text-sm font-medium text-foreground">
              {activityName(value.main, locale)}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled}
              className="ms-auto shrink-0"
              onClick={() => {
                setMainQuery("");
                setSubQuery("");
                onChange({ main: null, subs: [] });
              }}
            >
              {t("market.activity.change")}
            </Button>
          </div>
        ) : (
          <>
            <div className="relative min-w-0">
              <Search
                className="pointer-events-none absolute start-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="activity_main"
                autoComplete="off"
                disabled={disabled}
                placeholder={t("market.activity.searchPlaceholder")}
                value={mainQuery}
                maxLength={80}
                className="h-11 w-full min-w-0 ps-8 sm:h-10"
                onChange={(e) => setMainQuery(e.target.value)}
              />
              {mainResults.isFetching && (
                <Loader2
                  className="absolute end-2 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
                  aria-hidden
                />
              )}
            </div>
            <p className="text-desc text-muted-foreground">{t("market.activity.mainHint")}</p>
            {(mainResults.data ?? []).length > 0 && (
              <ul className="max-h-64 min-w-0 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {(mainResults.data ?? []).map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setMainQuery("");
                        onChange({ main: toChoice(hit), subs: [] });
                      }}
                      className="flex w-full min-w-0 items-start gap-2 p-2.5 text-start hover:bg-accent"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-medium text-foreground">
                          {activityName(hit, locale)}
                        </span>
                        <span className="block break-words text-desc text-muted-foreground">
                          {locale === "en"
                            ? hit.group_name_en || hit.group_name_ar
                            : hit.group_name_ar}
                          {hit.matched_alias ? ` · ${hit.matched_alias}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-desc text-muted-foreground">
                        {Math.round(hit.score * 100)}%
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {noMainMatch && (
              <p className="text-desc text-muted-foreground">{t("market.activity.noResults")}</p>
            )}
          </>
        )}
      </div>

      {/* ---- sub activities: many, inside the same main activity ---- */}
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="activity_sub">{t("market.activity.subs")}</Label>
        {value.subs.length > 0 && (
          <ul className="flex min-w-0 flex-wrap gap-1.5">
            {value.subs.map((sub) => (
              <li key={sub.id}>
                <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-desc text-foreground">
                  <span className="truncate">{activityName(sub, locale)}</span>
                  <button
                    type="button"
                    aria-label={t("market.form.remove")}
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        main: value.main,
                        subs: value.subs.filter((s) => s.id !== sub.id),
                      })
                    }
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <Input
          id="activity_sub"
          autoComplete="off"
          disabled={disabled || !value.main}
          placeholder={
            value.main ? t("market.activity.searchPlaceholder") : t("market.activity.pickMainFirst")
          }
          value={subQuery}
          maxLength={80}
          className="h-11 w-full min-w-0 sm:h-10"
          onChange={(e) => setSubQuery(e.target.value)}
        />
        <p className="text-desc text-muted-foreground">{t("market.activity.subsHint")}</p>
        {(subResults.data ?? []).length > 0 && (
          <ul className="max-h-56 min-w-0 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {(subResults.data ?? []).map((hit) => {
              const on = subIds.has(hit.id);
              return (
                <li key={hit.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onChange({
                        main: value.main,
                        subs: on
                          ? value.subs.filter((s) => s.id !== hit.id)
                          : [...value.subs, toChoice(hit)],
                      });
                    }}
                    className="flex w-full min-w-0 items-center gap-2 p-2.5 text-start hover:bg-accent"
                  >
                    <span className="min-w-0 flex-1 break-words text-sm text-foreground">
                      {activityName(hit, locale)}
                    </span>
                    {on && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ---- "my activity is not listed": suggestion only, never approved here ---- */}
      <div className="min-w-0 rounded-lg border border-dashed border-border p-3">
        {suggestOpen ? (
          <div className="min-w-0 space-y-2">
            <Label htmlFor="activity_suggest">{t("market.activity.suggestLabel")}</Label>
            <Input
              id="activity_suggest"
              autoComplete="off"
              disabled={disabled}
              value={suggestText}
              maxLength={120}
              className="h-11 w-full min-w-0 sm:h-10"
              onChange={(e) => setSuggestText(e.target.value)}
            />
            <p className="text-desc leading-relaxed text-muted-foreground">
              {t("market.activity.suggestHint")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={disabled || suggesting || suggestText.trim().length < 2}
                onClick={() => void suggest(suggestText)}
              >
                {suggesting ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Plus className="size-3.5" aria-hidden />
                )}
                {t("market.activity.suggest")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={suggesting}
                onClick={() => {
                  setSuggestOpen(false);
                  setSuggestText("");
                }}
              >
                {t("market.activity.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => {
              setSuggestText(mainQuery.trim() || subQuery.trim());
              setSuggestOpen(true);
            }}
          >
            <Plus className="size-3.5" aria-hidden />
            {t("market.activity.notFound")}
          </Button>
        )}
      </div>
    </div>
  );
}

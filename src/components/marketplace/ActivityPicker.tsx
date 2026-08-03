import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import {
  activityName,
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
 * sector. When the tree has no match, the user can only *suggest* a new
 * activity, which goes to the admin review queue.
 */
export function ActivityPicker({ value, onChange, tenantId, disabled }: Props) {
  const { t, locale } = useI18n();
  const [mainQuery, setMainQuery] = useState("");
  const [subQuery, setSubQuery] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const mainQ = useDebounced(mainQuery);
  const subQ = useDebounced(subQuery);

  const mainResults = useQuery({
    queryKey: ["mkt", "activities", "search-main", mainQ],
    enabled: mainQ.trim().length >= MIN_QUERY && !value.main,
    queryFn: () => searchActivities({ q: mainQ.trim(), onlyMain: true, limit: 12 }),
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
    if (suggesting) return;
    setSuggesting(true);
    try {
      await suggestActivity({
        text,
        groupId: value.main?.group_id ?? null,
        parentId: value.main?.id ?? null,
        tenantId: tenantId ?? null,
      });
      toast.success(t("market.activity.suggestSent"));
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
  const noSubMatch =
    !!value.main &&
    subQ.trim().length >= MIN_QUERY &&
    !subResults.isFetching &&
    (subResults.data ?? []).length === 0;

  return (
    <div className="space-y-4">
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
            <p className="text-[11px] text-muted-foreground">{t("market.activity.mainHint")}</p>
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
                        <span className="block break-words text-[11px] text-muted-foreground">
                          {locale === "en"
                            ? hit.group_name_en || hit.group_name_ar
                            : hit.group_name_ar}
                          {hit.matched_alias ? ` · ${hit.matched_alias}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                        {Math.round(hit.score * 100)}%
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {noMainMatch && (
              <div className="rounded-lg border border-dashed border-border p-3">
                <p className="text-xs text-muted-foreground">{t("market.activity.noResults")}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={disabled || suggesting}
                  onClick={() => void suggest(mainQuery.trim())}
                >
                  {suggesting ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Plus className="size-3.5" aria-hidden />
                  )}
                  {t("market.activity.suggest")}
                </Button>
              </div>
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
                <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-foreground">
                  <span className="truncate">{activityName(sub, locale)}</span>
                  <button
                    type="button"
                    aria-label={t("market.form.remove")}
                    disabled={disabled}
                    onClick={() =>
                      onChange({ main: value.main, subs: value.subs.filter((s) => s.id !== sub.id) })
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
        <p className="text-[11px] text-muted-foreground">{t("market.activity.subsHint")}</p>
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
                    {on ? (
                      <Check className="size-4 shrink-0 text-primary" aria-hidden />
                    ) : (
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                        {Math.round(hit.score * 100)}%
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {noSubMatch && (
          <div className="rounded-lg border border-dashed border-border p-3">
            <p className="text-xs text-muted-foreground">{t("market.activity.noResults")}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={disabled || suggesting}
              onClick={() => void suggest(subQuery.trim())}
            >
              {suggesting ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-3.5" aria-hidden />
              )}
              {t("market.activity.suggest")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

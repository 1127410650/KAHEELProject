import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Check, Pencil } from "lucide-react";

import { useI18n } from "@/i18n";
import { useIsMobile } from "@/hooks/use-mobile";
import type { MktCategory } from "@/lib/mkt";
import { normalizeCategoryLabel } from "@/lib/mkt-category-alias";
import { rootSlugRank } from "@/lib/market-primary-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";


interface Props {
  categories: MktCategory[];
  categoryId: string;
  subcategoryId: string;
  onChange: (next: { categoryId: string; subcategoryId: string }) => void;
  /** Fired when the picker is dismissed before the deepest level was chosen. */
  onAbort?: (() => void) | undefined;
}


type Stage = "root" | "sub" | "leaf";

/**
 * One level per screen: main field as large cards, then the subcategories of
 * that field only. The picker closes itself as soon as the deepest available
 * level is chosen, and the chosen path shows as a single editable line.
 */
export function CategoryPicker({
  categories,
  categoryId,
  subcategoryId,
  onChange,
  onAbort,
}: Props) {
  const { t, locale } = useI18n();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("root");
  const [root, setRoot] = useState("");
  const [sub, setSub] = useState("");
  const [term, setTerm] = useState("");
  /** True once a deepest-level pick was made, so a close is not a dismissal. */
  const completed = useRef(false);


  const label = (o: { name_ar: string; name_en: string | null }) =>
    locale === "ar" ? o.name_ar : o.name_en || o.name_ar;

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  // Top level = the approved primary fields, in the approved order. Any root
  // that is not part of the approved list (legacy data) sorts after them
  // instead of being hidden, so nothing becomes unreachable.
  const roots = useMemo(
    () =>
      categories
        .filter((c) => !c.parent_id)
        .slice()
        .sort(
          (a, b) =>
            rootSlugRank(a.slug) - rootSlugRank(b.slug) ||
            a.sort_order - b.sort_order ||
            a.name_ar.localeCompare(b.name_ar, "ar"),
        ),
    [categories],
  );
  const childrenOf = (id: string) => categories.filter((c) => c.parent_id === id);


  const pathText = useMemo(() => {
    const parts: string[] = [];
    const r = categoryId ? byId.get(categoryId) : undefined;
    if (r) parts.push(label(r));
    const s = subcategoryId ? byId.get(subcategoryId) : undefined;
    if (s) {
      const parent = s.parent_id ? byId.get(s.parent_id) : undefined;
      if (parent && parent.id !== categoryId) parts.push(label(parent));
      parts.push(label(s));
    }
    return parts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, subcategoryId, byId, locale]);

  // Opening always restarts from the top level, one level at a time.
  useEffect(() => {
    if (!open) return;
    setRoot("");
    setSub("");
    setTerm("");
    setStage("root");
  }, [open]);

  function finish(nextRoot: string, nextSub: string) {
    completed.current = true;
    onChange({ categoryId: nextRoot, subcategoryId: nextSub });
    setOpen(false);
  }

  /** A dismissal without a complete path is what makes the hint appear. */
  function change(next: boolean) {
    if (next) completed.current = false;
    setOpen(next);
    if (!next && !completed.current) onAbort?.();
  }

  function pickRoot(id: string) {
    setRoot(id);
    setSub("");
    setTerm("");
    if (childrenOf(id).length === 0) {
      finish(id, "");
      return;
    }
    setStage("sub");
  }

  function pickSub(id: string) {
    setSub(id);
    setTerm("");
    if (childrenOf(id).length === 0) {
      finish(root, id);
      return;
    }
    setStage("leaf");
  }

  const all =
    stage === "root"
      ? roots.map((c) => ({ id: c.id, text: label(c), onSelect: () => pickRoot(c.id) }))
      : stage === "sub"
        ? childrenOf(root).map((c) => ({ id: c.id, text: label(c), onSelect: () => pickSub(c.id) }))
        : childrenOf(sub).map((c) => ({
            id: c.id,
            text: label(c),
            onSelect: () => finish(root, c.id),
          }));

  /*
   * Search at the top level looks through the WHOLE tree — Arabic name, English
   * name and subcategories — tolerant of hamza, tāʾ marbūṭa, spaces and
   * punctuation, and shows the full path («خدمات ← الكهرباء»). Deeper levels
   * only narrow what is on screen.
   */
  const needle = normalizeCategoryLabel(term);
  const deepMatches = useMemo(() => {
    if (!needle || stage !== "root") return [];
    const out: { id: string; text: string; onSelect: () => void }[] = [];
    for (const rootCat of roots) {
      const rootHit = [rootCat.name_ar, rootCat.name_en ?? "", rootCat.slug].some((v) =>
        normalizeCategoryLabel(v).includes(needle),
      );
      if (rootHit) {
        out.push({ id: rootCat.id, text: label(rootCat), onSelect: () => pickRoot(rootCat.id) });
      }
      for (const child of childrenOf(rootCat.id)) {
        const childHit = [child.name_ar, child.name_en ?? "", child.slug].some((v) =>
          normalizeCategoryLabel(v).includes(needle),
        );
        if (!childHit) continue;
        out.push({
          id: child.id,
          text: `${label(rootCat)} ← ${label(child)}`,
          onSelect: () => {
            const grandChildren = childrenOf(child.id);
            if (grandChildren.length === 0) {
              finish(rootCat.id, child.id);
              return;
            }
            setRoot(rootCat.id);
            setSub(child.id);
            setTerm("");
            setStage("leaf");
          },
        });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needle, stage, roots, categories, locale]);

  const items = !needle
    ? all
    : stage === "root"
      ? deepMatches
      : all.filter((item) => normalizeCategoryLabel(item.text).includes(needle));


  const stageTitle = stage === "root" ? t("market.form.chooseField") : t("market.form.chooseSub");

  const body = (
    <div className="space-y-3">
      {stage !== "root" && (
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 px-2"
            onClick={() => {
              setTerm("");
              setStage(stage === "leaf" ? "sub" : "root");
            }}
          >
            {locale === "ar" ? (
              <ChevronRight className="size-4" aria-hidden />
            ) : (
              <ChevronLeft className="size-4" aria-hidden />
            )}
            {t("market.form.back")}
          </Button>
          <span className="text-foreground">
            {[
              root ? label(byId.get(root)!) : null,
              stage === "leaf" && sub ? label(byId.get(sub)!) : null,
            ]
              .filter(Boolean)
              .join(" ← ")}
          </span>
        </div>
      )}
      <Input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={t("market.form.searchLevel")}
        className="h-11"
      />
      <ul
        className={
          stage === "root" && !needle
            ? "grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto pe-1"
            : "max-h-[60vh] space-y-1.5 overflow-y-auto pe-1"
        }
      >
        {items.map((item) => (

          <li key={item.id}>
            <button
              type="button"
              onClick={item.onSelect}
              className={
                stage === "root" && !needle
                  ? "flex min-h-24 w-full items-center justify-center rounded-xl border border-border bg-card px-3 py-4 text-center text-sm font-medium text-foreground hover:border-primary/60 hover:bg-accent"
                  : "flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-start text-sm text-foreground hover:border-primary/50 hover:bg-accent"
              }
            >
              <span className="min-w-0 break-words">{item.text}</span>
              {(stage !== "root" || !!needle) && (
                <span className="shrink-0 text-muted-foreground" aria-hidden>
                  {locale === "ar" ? "‹" : "›"}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {items.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {t("market.form.noResults")}
        </p>
      )}
    </div>

  );

  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-foreground">{t("market.form.categoryPath")}</span>
      <button
        type="button"
        onClick={() => change(true)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2.5 text-start text-sm"
      >
        {pathText.length > 0 ? (
          <span className="min-w-0 break-words text-foreground">{pathText.join(" ← ")}</span>
        ) : (
          <span className="text-muted-foreground">{t("market.form.choosePath")}</span>
        )}
        {pathText.length > 0 ? (
          <span className="flex shrink-0 items-center gap-1 text-xs text-primary">
            <Pencil className="size-3.5" aria-hidden />
            {t("market.form.editPath")}
          </span>
        ) : (
          <Check className="size-4 shrink-0 text-muted-foreground opacity-0" aria-hidden />
        )}
      </button>

      {isMobile ? (
        <Drawer open={open} onOpenChange={change}>
          <DrawerContent className="px-4 pb-6">
            <DrawerHeader className="px-0 text-start">
              <DrawerTitle>{stageTitle}</DrawerTitle>
            </DrawerHeader>
            {body}
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={change}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{stageTitle}</DialogTitle>
            </DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

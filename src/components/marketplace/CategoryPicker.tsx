import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";

import { useI18n } from "@/i18n";
import { useIsMobile } from "@/hooks/use-mobile";
import type { MktCategory, MktListingType } from "@/lib/mkt";
import { purposesFor } from "@/lib/mkt-taxonomy";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

export interface CategorySelection {
  categoryId: string;
  subcategoryId: string;
  typeCode: string;
}

interface Props {
  categories: MktCategory[];
  types: MktListingType[];
  value: CategorySelection;
  onChange: (next: CategorySelection) => void;
}

type Stage = "root" | "sub" | "leaf" | "purpose";

/**
 * Staged category picker: main field → section → sub-type (when the tree has
 * one) → purpose. Never a single long list, and every stage can be stepped back.
 */
export function CategoryPicker({ categories, types, value, onChange }: Props) {
  const { t, locale } = useI18n();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("root");
  const [root, setRoot] = useState("");
  const [sub, setSub] = useState("");
  const [leaf, setLeaf] = useState("");

  const label = (o: { name_ar: string; name_en: string | null }) =>
    locale === "ar" ? o.name_ar : o.name_en || o.name_ar;

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const roots = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
  const childrenOf = (id: string) => categories.filter((c) => c.parent_id === id);

  // The stored value can be a root only, or root + subcategory.
  const selectedRootId = value.categoryId;
  const selectedSub = value.subcategoryId ? byId.get(value.subcategoryId) : undefined;
  const selectedType = types.find((tp) => tp.code === value.typeCode);

  const pathText = useMemo(() => {
    const parts: string[] = [];
    const r = selectedRootId ? byId.get(selectedRootId) : undefined;
    if (r) parts.push(label(r));
    if (selectedSub) parts.push(label(selectedSub));
    if (selectedType) parts.push(label(selectedType));
    return parts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRootId, selectedSub, selectedType, byId, locale]);

  // Opening always restarts from the current selection.
  useEffect(() => {
    if (!open) return;
    setRoot(value.categoryId);
    setSub(value.subcategoryId);
    setLeaf("");
    setStage(value.categoryId ? "sub" : "root");
  }, [open, value.categoryId, value.subcategoryId]);

  const purposeCodes = purposesFor(root ? byId.get(root)?.slug : null);
  const purposeOptions = purposeCodes
    .map((code) => types.find((tp) => tp.code === code))
    .filter((tp): tp is MktListingType => !!tp);

  function pickRoot(id: string) {
    setRoot(id);
    setSub("");
    setLeaf("");
    setStage(childrenOf(id).length > 0 ? "sub" : "purpose");
  }

  function pickSub(id: string) {
    setSub(id);
    setLeaf("");
    setStage(childrenOf(id).length > 0 ? "leaf" : "purpose");
  }

  function pickPurpose(code: string) {
    onChange({ categoryId: root, subcategoryId: leaf || sub, typeCode: code });
    setOpen(false);
  }

  function back() {
    if (stage === "purpose") {
      if (leaf) {
        setLeaf("");
        setStage("leaf");
      } else if (sub) {
        setStage("sub");
      } else {
        setStage("root");
      }
      return;
    }
    if (stage === "leaf") {
      setStage("sub");
      return;
    }
    if (stage === "sub") setStage("root");
  }

  const list: { id: string; text: string; onSelect: () => void; selected: boolean }[] =
    stage === "root"
      ? roots.map((c) => ({
          id: c.id,
          text: label(c),
          onSelect: () => pickRoot(c.id),
          selected: c.id === root,
        }))
      : stage === "sub"
        ? childrenOf(root).map((c) => ({
            id: c.id,
            text: label(c),
            onSelect: () => pickSub(c.id),
            selected: c.id === sub,
          }))
        : stage === "leaf"
          ? childrenOf(sub).map((c) => ({
              id: c.id,
              text: label(c),
              onSelect: () => {
                setLeaf(c.id);
                setStage("purpose");
              },
              selected: c.id === leaf,
            }))
          : purposeOptions.map((tp) => ({
              id: tp.code,
              text: label(tp),
              onSelect: () => pickPurpose(tp.code),
              selected: tp.code === value.typeCode,
            }));

  const stageTitle =
    stage === "root"
      ? t("market.form.stageRoot")
      : stage === "sub"
        ? t("market.form.stageSection")
        : stage === "leaf"
          ? t("market.form.stageSubType")
          : t("market.form.stagePurpose");

  const crumbs = [
    root ? label(byId.get(root)!) : null,
    sub ? label(byId.get(sub)!) : null,
    leaf ? label(byId.get(leaf)!) : null,
  ].filter((v): v is string => !!v);

  const body = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {stage !== "root" && (
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={back}>
            {locale === "ar" ? (
              <ChevronRight className="size-4" aria-hidden />
            ) : (
              <ChevronLeft className="size-4" aria-hidden />
            )}
            {t("market.form.back")}
          </Button>
        )}
        {crumbs.map((c, i) => (
          <span key={`${c}-${i}`} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden>←</span>}
            <span className="text-foreground">{c}</span>
          </span>
        ))}
      </div>
      <ul className="max-h-[60vh] space-y-1 overflow-y-auto pe-1">
        {list.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={item.onSelect}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-start text-sm text-foreground hover:border-primary/50 hover:bg-accent"
            >
              <span className="min-w-0 break-words">{item.text}</span>
              {item.selected ? (
                <Check className="size-4 shrink-0 text-primary" aria-hidden />
              ) : (
                <span className="shrink-0 text-muted-foreground" aria-hidden>
                  {locale === "ar" ? "‹" : "›"}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-foreground">{t("market.form.categoryPath")}</span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-start text-sm"
      >
        {pathText.length > 0 ? (
          <span className="flex flex-wrap items-center gap-1 text-foreground">
            {pathText.map((p, i) => (
              <span key={`${p}-${i}`} className="flex items-center gap-1">
                {i > 0 && (
                  <span className="text-muted-foreground" aria-hidden>
                    ←
                  </span>
                )}
                <span>{p}</span>
              </span>
            ))}
          </span>
        ) : (
          <span className="text-muted-foreground">{t("market.form.choosePath")}</span>
        )}
      </button>

      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="px-4 pb-6">
            <DrawerHeader className="px-0 text-start">
              <DrawerTitle>{stageTitle}</DrawerTitle>
            </DrawerHeader>
            {body}
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
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

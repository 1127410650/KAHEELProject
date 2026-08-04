/**
 * Catalog editor — one screen for both worlds.
 *
 * A restaurant edits a menu (sections = menu groups, items = dishes, with option
 * groups such as size or extras). A retail / services store edits products or
 * services in the same structure, minus the option groups. Nothing here decides
 * ownership: the storefront id comes from the signed-in account's own store and
 * every write is validated again by the database policies and guards.
 */
import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { currencyLabel } from "@/lib/mkt";
import {
  catalogErrorKey,
  deleteAddonGroup,
  deleteAddonOption,
  deleteItem,
  deleteSection,
  reorderItems,
  reorderSections,
  saveAddonGroup,
  saveAddonOption,
  saveItem,
  saveSection,
  setItemAvailability,
  uploadItemImage,
  useStoreCatalog,
  type StoreAddonGroup,
  type StoreItem,
  type StoreSection,
} from "@/lib/mkt-store-catalog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function money(amount: number, currency: string, locale: "ar" | "en"): string {
  const value = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount);
  const label = currencyLabel(currency, locale);
  return locale === "ar" ? `${value} ${label}` : `${label} ${value}`;
}

export function CatalogEditor({
  storefrontId,
  storeType,
  currency,
}: {
  storefrontId: string;
  storeType: string;
  currency: string;
}) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const catalog = useStoreCatalog(storefrontId);
  const withOptions = storeType === "restaurant" || storeType === "mixed";

  const [sectionDraft, setSectionDraft] = useState<{ id?: string; name: string } | null>(null);
  const [itemDraft, setItemDraft] = useState<Partial<StoreItem> | null>(null);
  const [optionsFor, setOptionsFor] = useState<StoreItem | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["mkt", "store-catalog", storefrontId] });

  const fail = (error: unknown) => toast.error(t(catalogErrorKey(error)));

  const sections = catalog.data?.sections ?? [];
  const items = catalog.data?.items ?? [];
  const groups = catalog.data?.groups ?? [];
  const media = catalog.data?.media ?? {};

  const grouped = useMemo(() => {
    const map = new Map<string, StoreItem[]>();
    for (const section of sections) map.set(section.id, []);
    map.set("__none", []);
    for (const item of items) {
      const key = item.section_id && map.has(item.section_id) ? item.section_id : "__none";
      map.get(key)!.push(item);
    }
    return map;
  }, [sections, items]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await refresh();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  async function moveSection(section: StoreSection, delta: number) {
    const order = sections.map((s) => s.id);
    const from = order.indexOf(section.id);
    const to = from + delta;
    if (to < 0 || to >= order.length) return;
    order.splice(to, 0, order.splice(from, 1)[0]!);
    await run(() => reorderSections(order));
  }

  async function moveItem(item: StoreItem, delta: number) {
    const siblings = (grouped.get(item.section_id ?? "__none") ?? []).map((i) => i.id);
    const from = siblings.indexOf(item.id);
    const to = from + delta;
    if (to < 0 || to >= siblings.length) return;
    siblings.splice(to, 0, siblings.splice(from, 1)[0]!);
    await run(() => reorderItems(siblings));
  }

  if (catalog.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setSectionDraft({ name: "" })} disabled={busy}>
          <Plus className="me-1 h-4 w-4" />
          {t("market.store.catalog.addSection")}
        </Button>
        <Button
          variant="outline"
          disabled={busy || sections.length === 0}
          onClick={() =>
            setItemDraft({
              section_id: sections[0]?.id ?? null,
              base_price: 0,
              is_available: true,
            })
          }
        >
          <Plus className="me-1 h-4 w-4" />
          {withOptions ? t("market.store.catalog.addDish") : t("market.store.catalog.addProduct")}
        </Button>
        {sections.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("market.store.catalog.sectionFirst")}</p>
        ) : null}
      </div>

      {sections.length === 0 && items.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 pt-5 text-sm">
            <p className="font-medium">{t("market.store.catalog.emptyTitle")}</p>
            <p className="text-muted-foreground">{t("market.store.catalog.emptyHint")}</p>
          </CardContent>
        </Card>
      ) : null}

      {[...sections, null].map((section) => {
        const key = section?.id ?? "__none";
        const rows = grouped.get(key) ?? [];
        if (!section && rows.length === 0) return null;
        return (
          <Card key={key}>
            <CardContent className="space-y-3 pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">
                  {section ? section.name_ar : t("market.store.catalog.noSection")}
                </span>
                <Badge variant="secondary">{rows.length}</Badge>
                {section && !section.is_active ? (
                  <Badge variant="outline">{t("market.store.catalog.sectionHidden")}</Badge>
                ) : null}
                {section ? (
                  <div className="ms-auto flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("market.store.catalog.moveUp")}
                      disabled={busy}
                      onClick={() => void moveSection(section, -1)}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("market.store.catalog.moveDown")}
                      disabled={busy}
                      onClick={() => void moveSection(section, 1)}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("common.edit")}
                      disabled={busy}
                      onClick={() => setSectionDraft({ id: section.id, name: section.name_ar })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("common.delete")}
                      disabled={busy}
                      onClick={() => void run(() => deleteSection(section.id))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ) : null}
              </div>

              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("market.store.catalog.sectionEmpty")}
                </p>
              ) : null}

              <div className="grid gap-2">
                {rows.map((item) => {
                  const itemGroups = groups.filter((g) => g.item_id === item.id);
                  const url = item.image_path ? media[item.image_path] : undefined;
                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
                    >
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                        {url ? (
                          <img
                            src={url}
                            alt={item.name_ar}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium">{item.name_ar}</span>
                          {!item.is_available ? (
                            <Badge variant="outline">{t("market.store.catalog.unavailable")}</Badge>
                          ) : null}
                          {item.is_featured ? (
                            <Badge variant="secondary">{t("market.store.catalog.featured")}</Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {money(item.base_price, item.currency_code || currency, locale)}
                          {withOptions && itemGroups.length > 0
                            ? ` · ${t("market.store.catalog.groupsCount")}: ${itemGroups.length}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("market.store.catalog.moveUp")}
                          disabled={busy}
                          onClick={() => void moveItem(item, -1)}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("market.store.catalog.moveDown")}
                          disabled={busy}
                          onClick={() => void moveItem(item, 1)}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("market.store.catalog.toggle")}
                          disabled={busy}
                          onClick={() =>
                            void run(() => setItemAvailability(item.id, !item.is_available))
                          }
                        >
                          {item.is_available ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </Button>
                        {withOptions ? (
                          <Button variant="outline" size="sm" onClick={() => setOptionsFor(item)}>
                            {t("market.store.catalog.options")}
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("common.edit")}
                          onClick={() => setItemDraft(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("common.delete")}
                          disabled={busy}
                          onClick={() => void run(() => deleteItem(item.id))}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* ── section dialog ── */}
      <Dialog open={!!sectionDraft} onOpenChange={(open) => !open && setSectionDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sectionDraft?.id
                ? t("market.store.catalog.editSection")
                : t("market.store.catalog.addSection")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="section-name">{t("market.store.catalog.sectionName")}</Label>
            <Input
              id="section-name"
              value={sectionDraft?.name ?? ""}
              onChange={(e) =>
                setSectionDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))
              }
            />
          </div>
          <DialogFooter>
            <Button
              disabled={busy || !sectionDraft?.name.trim()}
              onClick={() =>
                void run(async () => {
                  await saveSection(storefrontId, {
                    id: sectionDraft?.id,
                    name_ar: sectionDraft!.name,
                    sort_order: sectionDraft?.id ? undefined : sections.length,
                  });
                  setSectionDraft(null);
                })
              }
            >
              {busy ? <Loader2 className="me-1 h-4 w-4 animate-spin" /> : null}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── item dialog ── */}
      {itemDraft ? (
        <ItemDialog
          storefrontId={storefrontId}
          storeType={storeType}
          currency={currency}
          sections={sections}
          draft={itemDraft}
          onClose={() => setItemDraft(null)}
          onSaved={() => {
            setItemDraft(null);
            void refresh();
          }}
        />
      ) : null}

      {/* ── options dialog ── */}
      {optionsFor ? (
        <OptionsDialog
          item={optionsFor}
          groups={groups.filter((g) => g.item_id === optionsFor.id)}
          currency={currency}
          onClose={() => setOptionsFor(null)}
          onChanged={refresh}
        />
      ) : null}
    </div>
  );
}

/* ── item form ─────────────────────────────────────────────────────────────── */

function ItemDialog({
  storefrontId,
  storeType,
  currency,
  sections,
  draft,
  onClose,
  onSaved,
}: {
  storefrontId: string;
  storeType: string;
  currency: string;
  sections: StoreSection[];
  draft: Partial<StoreItem>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const isService = storeType === "services";
  const [form, setForm] = useState({
    name: draft.name_ar ?? "",
    description: draft.description_ar ?? "",
    price: draft.base_price != null ? String(draft.base_price) : "",
    compare: draft.compare_at_price != null ? String(draft.compare_at_price) : "",
    minutes:
      (isService ? draft.duration_minutes : draft.preparation_minutes) != null
        ? String(isService ? draft.duration_minutes : draft.preparation_minutes)
        : "",
    sectionId: draft.section_id ?? sections[0]?.id ?? null,
    available: draft.is_available ?? true,
    featured: draft.is_featured ?? false,
    trackInventory: draft.track_inventory ?? false,
    stock: draft.stock_quantity != null ? String(draft.stock_quantity) : "",
    imagePath: draft.image_path ?? null,
  });
  const [busy, setBusy] = useState(false);

  const priceValue = Number(form.price);
  const invalid = !form.name.trim() || !Number.isFinite(priceValue) || priceValue < 0;

  async function pickImage(file: File) {
    setBusy(true);
    const result = await uploadItemImage(storefrontId, file, form.imagePath);
    setBusy(false);
    if ("error" in result) {
      toast.error(t(`market.media.error.${result.error}`));
      return;
    }
    setForm((prev) => ({ ...prev, imagePath: result.path }));
  }

  async function submit() {
    setBusy(true);
    try {
      const minutes = form.minutes.trim() === "" ? null : Number(form.minutes);
      await saveItem(storefrontId, {
        id: draft.id,
        section_id: form.sectionId,
        item_type: isService ? "service" : storeType === "restaurant" ? "dish" : "product",
        name_ar: form.name,
        description_ar: form.description,
        base_price: priceValue,
        compare_at_price: form.compare.trim() === "" ? null : Number(form.compare),
        image_path: form.imagePath,
        preparation_minutes: isService ? null : minutes,
        duration_minutes: isService ? minutes : null,
        track_inventory: form.trackInventory,
        stock_quantity: form.trackInventory ? Number(form.stock || 0) : null,
        is_available: form.available,
        is_featured: form.featured,
      });
      onSaved();
    } catch (error) {
      toast.error(t(catalogErrorKey(error)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {draft.id ? t("market.store.catalog.editItem") : t("market.store.catalog.newItem")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item-name">{t("market.store.catalog.itemName")}</Label>
            <Input
              id="item-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-section">{t("market.store.catalog.section")}</Label>
            <select
              id="item-section"
              className="h-11 w-full rounded-md border bg-background px-3 text-sm"
              value={form.sectionId ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, sectionId: e.target.value || null }))}
            >
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name_ar}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-desc">{t("market.store.catalog.itemDescription")}</Label>
            <Textarea
              id="item-desc"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="item-price">
                {t("market.store.catalog.price")} ({currency})
              </Label>
              <Input
                id="item-price"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-compare">{t("market.store.catalog.comparePrice")}</Label>
              <Input
                id="item-compare"
                inputMode="decimal"
                value={form.compare}
                onChange={(e) => setForm((p) => ({ ...p, compare: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-minutes">
                {isService
                  ? t("market.store.catalog.durationMinutes")
                  : t("market.store.catalog.prepMinutes")}
              </Label>
              <Input
                id="item-minutes"
                inputMode="numeric"
                value={form.minutes}
                onChange={(e) => setForm((p) => ({ ...p, minutes: e.target.value }))}
              />
            </div>
            {form.trackInventory ? (
              <div className="space-y-2">
                <Label htmlFor="item-stock">{t("market.store.catalog.stock")}</Label>
                <Input
                  id="item-stock"
                  inputMode="numeric"
                  value={form.stock}
                  onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))}
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              {t("market.store.catalog.available")}
              <Switch
                checked={form.available}
                onCheckedChange={(v) => setForm((p) => ({ ...p, available: v }))}
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              {t("market.store.catalog.markFeatured")}
              <Switch
                checked={form.featured}
                onCheckedChange={(v) => setForm((p) => ({ ...p, featured: v }))}
              />
            </label>
            {!isService ? (
              <label className="flex items-center justify-between gap-3 text-sm">
                {t("market.store.catalog.trackInventory")}
                <Switch
                  checked={form.trackInventory}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, trackInventory: v }))}
                />
              </label>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>{t("market.store.catalog.photo")}</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="me-1 h-4 w-4" />
                {form.imagePath
                  ? t("market.store.catalog.replacePhoto")
                  : t("market.store.catalog.addPhoto")}
              </Button>
              {form.imagePath ? (
                <span className="text-xs text-muted-foreground">
                  {t("market.store.catalog.photoReady")}
                </span>
              ) : null}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void pickImage(file);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={busy || invalid}>
            {busy ? <Loader2 className="me-1 h-4 w-4 animate-spin" /> : null}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── option groups ─────────────────────────────────────────────────────────── */

function OptionsDialog({
  item,
  groups,
  currency,
  onClose,
  onChanged,
}: {
  item: StoreItem;
  groups: StoreAddonGroup[];
  currency: string;
  onClose: () => void;
  onChanged: () => Promise<unknown> | void;
}) {
  const { t, locale } = useI18n();
  const [busy, setBusy] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [optionDrafts, setOptionDrafts] = useState<Record<string, { name: string; price: string }>>(
    {},
  );

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await onChanged();
    } catch (error) {
      toast.error(t(catalogErrorKey(error)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t("market.store.catalog.options")} — {item.name_ar}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="group-name">{t("market.store.catalog.groupName")}</Label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder={t("market.store.catalog.groupExample")}
              />
            </div>
            <Button
              disabled={busy || !groupName.trim()}
              onClick={() =>
                void run(async () => {
                  await saveAddonGroup(item.id, {
                    name_ar: groupName,
                    selection_type: "single",
                    is_required: false,
                    minimum_choices: 0,
                    maximum_choices: 1,
                    sort_order: groups.length,
                  });
                  setGroupName("");
                })
              }
            >
              <Plus className="me-1 h-4 w-4" />
              {t("market.store.catalog.addGroup")}
            </Button>
          </div>

          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("market.store.catalog.noGroups")}</p>
          ) : null}

          {groups.map((group) => {
            const draft = optionDrafts[group.id] ?? { name: "", price: "" };
            return (
              <div key={group.id} className="space-y-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{group.name_ar}</span>
                  <Badge variant="secondary">
                    {group.selection_type === "single"
                      ? t("market.store.catalog.single")
                      : t("market.store.catalog.multiple")}
                  </Badge>
                  {group.is_required ? (
                    <Badge variant="outline">{t("market.store.catalog.required")}</Badge>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ms-auto"
                    aria-label={t("common.delete")}
                    disabled={busy}
                    onClick={() => void run(() => deleteAddonGroup(group.id))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex items-center justify-between gap-3 text-sm">
                    {t("market.store.catalog.multipleChoice")}
                    <Switch
                      checked={group.selection_type === "multiple"}
                      onCheckedChange={(v) =>
                        void run(() =>
                          saveAddonGroup(item.id, {
                            id: group.id,
                            name_ar: group.name_ar,
                            selection_type: v ? "multiple" : "single",
                            is_required: group.is_required,
                            minimum_choices: group.minimum_choices,
                            maximum_choices: v ? null : 1,
                          }),
                        )
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    {t("market.store.catalog.required")}
                    <Switch
                      checked={group.is_required}
                      onCheckedChange={(v) =>
                        void run(() =>
                          saveAddonGroup(item.id, {
                            id: group.id,
                            name_ar: group.name_ar,
                            selection_type: group.selection_type,
                            is_required: v,
                            minimum_choices: v ? Math.max(group.minimum_choices, 1) : 0,
                            maximum_choices: group.maximum_choices,
                          }),
                        )
                      }
                    />
                  </label>
                </div>

                <Separator />

                <div className="space-y-2">
                  {group.options.map((option) => (
                    <div key={option.id} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate">{option.name_ar}</span>
                      <span className="text-muted-foreground">
                        + {money(option.price_delta, currency, locale)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("common.delete")}
                        disabled={busy}
                        onClick={() => void run(() => deleteAddonOption(option.id))}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {group.options.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t("market.store.catalog.noOptions")}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input
                      aria-label={t("market.store.catalog.optionName")}
                      placeholder={t("market.store.catalog.optionName")}
                      value={draft.name}
                      onChange={(e) =>
                        setOptionDrafts((prev) => ({
                          ...prev,
                          [group.id]: { ...draft, name: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      aria-label={t("market.store.catalog.optionPrice")}
                      placeholder="0"
                      inputMode="decimal"
                      value={draft.price}
                      onChange={(e) =>
                        setOptionDrafts((prev) => ({
                          ...prev,
                          [group.id]: { ...draft, price: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <Button
                    variant="outline"
                    disabled={busy || !draft.name.trim()}
                    onClick={() =>
                      void run(async () => {
                        await saveAddonOption(group.id, {
                          name_ar: draft.name,
                          price_delta: Number(draft.price || 0),
                        });
                        setOptionDrafts((prev) => ({
                          ...prev,
                          [group.id]: { name: "", price: "" },
                        }));
                      })
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>{t("common.done")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Store offers editor ("سند كَحيل").
 *
 * The merchant declares a discount, its window, and whether it covers the
 * whole store or specific items. Nothing here decides who may write: every
 * mutation goes through the row-level policies in `mkt-store-offers.ts`.
 */
import { useMemo, useState } from "react";
import { Percent, Plus, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { currencyLabel } from "@/lib/mkt";
import { useStoreCatalog } from "@/lib/mkt-store-catalog";
import {
  offerStatus,
  useArchiveStoreOffer,
  useMyStoreOffers,
  useOfferItemIds,
  useSaveStoreOffer,
  useToggleStoreOffer,
  type OfferDiscountType,
  type StoreOffer,
} from "@/lib/mkt-store-offers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const STATUS_LABEL: Record<string, string> = {
  live: "سارٍ الآن",
  scheduled: "مجدول",
  expired: "منتهٍ",
  paused: "موقوف",
};

/** `datetime-local` needs a local, second-less value. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

interface DraftState {
  id?: string;
  title: string;
  description: string;
  discount_type: OfferDiscountType;
  discount_value: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  applies_to_all: boolean;
  item_ids: string[];
}

function emptyDraft(): DraftState {
  return {
    title: "",
    description: "",
    discount_type: "percent",
    discount_value: "10",
    starts_at: toLocalInput(new Date().toISOString()),
    ends_at: "",
    is_active: true,
    applies_to_all: true,
    item_ids: [],
  };
}

export function OffersEditor({
  storefrontId,
  currency,
}: {
  storefrontId: string;
  currency: string;
}) {
  const { locale } = useI18n();
  const offers = useMyStoreOffers(storefrontId);
  const catalog = useStoreCatalog(storefrontId);
  const save = useSaveStoreOffer(storefrontId);
  const toggle = useToggleStoreOffer();
  const archive = useArchiveStoreOffer();

  const [draft, setDraft] = useState<DraftState | null>(null);
  const editingItems = useOfferItemIds(draft?.id ?? null);

  const items = catalog.data?.items ?? [];
  const itemNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      map.set(item.id, locale === "ar" ? item.name_ar : item.name_en || item.name_ar);
    }
    return map;
  }, [items, locale]);

  const openNew = () => setDraft(emptyDraft());

  const openEdit = (offer: StoreOffer) =>
    setDraft({
      id: offer.id,
      title: offer.title,
      description: offer.description ?? "",
      discount_type: offer.discount_type,
      discount_value: String(offer.discount_value),
      starts_at: toLocalInput(offer.starts_at),
      ends_at: toLocalInput(offer.ends_at),
      is_active: offer.is_active,
      applies_to_all: offer.applies_to_all,
      item_ids: [],
    });

  // The linked items arrive after the offer is opened, so merge them once.
  const draftItemIds =
    draft && draft.id && draft.item_ids.length === 0 && editingItems.data?.length
      ? editingItems.data
      : (draft?.item_ids ?? []);

  const submit = () => {
    if (!draft) return;
    const title = draft.title.trim();
    const value = Number(draft.discount_value);
    if (title.length < 3) {
      toast.error("اكتب عنوانًا واضحًا للعرض (3 أحرف على الأقل).");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("قيمة الخصم يجب أن تكون رقمًا أكبر من صفر.");
      return;
    }
    if (draft.discount_type === "percent" && value > 90) {
      toast.error("نسبة الخصم لا تتجاوز 90%.");
      return;
    }
    const startsAt = fromLocalInput(draft.starts_at) ?? new Date().toISOString();
    const endsAt = fromLocalInput(draft.ends_at);
    if (endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      toast.error("تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية.");
      return;
    }
    if (!draft.applies_to_all && draftItemIds.length === 0) {
      toast.error("اختر منتجًا واحدًا على الأقل، أو اجعل العرض على كل المتجر.");
      return;
    }

    save.mutate(
      {
        ...(draft.id ? { id: draft.id } : {}),
        title,
        description: draft.description.trim() || null,
        discount_type: draft.discount_type,
        discount_value: value,
        starts_at: startsAt,
        ends_at: endsAt,
        is_active: draft.is_active,
        applies_to_all: draft.applies_to_all,
        item_ids: draftItemIds,
      },

      {
        onSuccess: () => {
          toast.success(draft.id ? "تم تحديث العرض." : "تم إنشاء العرض.");
          setDraft(null);
        },
        onError: () => toast.error("لم يُحفظ العرض. تحقّق من البيانات وأعد المحاولة."),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-section flex items-center gap-2 font-black">
            <Tag className="size-4 text-market-navy" aria-hidden />
            عروض المتجر
          </h2>
          <p className="mt-1 text-desc text-muted-foreground">
            العرض السارٍ يظهر للزوّار في صفحة متجرك العامة.
          </p>
        </div>
        <Button size="sm" onClick={openNew} disabled={!!draft}>
          <Plus className="me-1 size-4" aria-hidden />
          عرض جديد
        </Button>
      </div>

      {draft ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black">
              {draft.id ? "تعديل العرض" : "عرض جديد"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-[var(--sp-2)]">
                <Label htmlFor="offer-title">عنوان العرض</Label>
                <Input
                  id="offer-title"
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  placeholder="مثال: خصم افتتاح الفرع"
                />
              </div>
              <div className="space-y-[var(--sp-2)]">
                <Label htmlFor="offer-value">
                  قيمة الخصم{" "}
                  {draft.discount_type === "percent" ? "(%)" : `(${currencyLabel(currency, locale)})`}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="offer-value"
                    inputMode="decimal"
                    value={draft.discount_value}
                    onChange={(event) =>
                      setDraft({ ...draft, discount_value: event.target.value })
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        discount_type: draft.discount_type === "percent" ? "amount" : "percent",
                      })
                    }
                  >
                    {draft.discount_type === "percent" ? (
                      <Percent className="size-4" aria-hidden />
                    ) : (
                      currencyLabel(currency, locale)
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-[var(--sp-2)]">
                <Label htmlFor="offer-start">بداية العرض</Label>
                <Input
                  id="offer-start"
                  type="datetime-local"
                  value={draft.starts_at}
                  onChange={(event) => setDraft({ ...draft, starts_at: event.target.value })}
                />
              </div>
              <div className="space-y-[var(--sp-2)]">
                <Label htmlFor="offer-end">نهاية العرض (اختياري)</Label>
                <Input
                  id="offer-end"
                  type="datetime-local"
                  value={draft.ends_at}
                  onChange={(event) => setDraft({ ...draft, ends_at: event.target.value })}
                />
              </div>
            </div>

            <div className="space-y-[var(--sp-2)]">
              <Label htmlFor="offer-description">تفاصيل العرض (اختياري)</Label>
              <Textarea
                id="offer-description"
                rows={2}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                placeholder="شروط العرض أو ملاحظة قصيرة للعميل."
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 rounded-xl border p-3">
              <label className="flex items-center gap-2 text-desc font-bold">
                <Switch
                  checked={draft.is_active}
                  onCheckedChange={(checked) => setDraft({ ...draft, is_active: checked })}
                />
                العرض مُفعّل
              </label>
              <label className="flex items-center gap-2 text-desc font-bold">
                <Switch
                  checked={draft.applies_to_all}
                  onCheckedChange={(checked) =>
                    setDraft({ ...draft, applies_to_all: checked, item_ids: [] })
                  }
                />
                يشمل كل المتجر
              </label>
            </div>

            {!draft.applies_to_all ? (
              <div className="space-y-2 rounded-xl border p-3">
                <p className="text-desc font-bold">المنتجات المشمولة</p>
                {catalog.isLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : items.length === 0 ? (
                  <p className="text-desc text-muted-foreground">
                    لا توجد منتجات بعد — أضِف منتجات من صفحة الأقسام والمنتجات.
                  </p>
                ) : (
                  <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                    {items.map((item) => {
                      const selected = draftItemIds.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              item_ids: selected
                                ? draftItemIds.filter((id) => id !== item.id)
                                : [...draftItemIds, item.id],
                            })
                          }
                          className={`rounded-full border px-3 py-[var(--sp-2)] text-desc font-bold transition ${
                            selected
                              ? "border-market-navy bg-market-navy/10 text-market-navy"
                              : "border-border text-muted-foreground hover:border-market-navy/40"
                          }`}
                        >
                          {itemNames.get(item.id)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button onClick={submit} disabled={save.isPending}>
                {save.isPending ? "جارٍ الحفظ…" : "حفظ العرض"}
              </Button>
              <Button variant="outline" onClick={() => setDraft(null)}>
                إلغاء
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {offers.isLoading ? (
        <Skeleton className="h-24 w-full rounded-[var(--r-card)]" />
      ) : (offers.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">
            لا توجد عروض بعد. أنشئ عرضًا ليظهر لزوّار متجرك.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(offers.data ?? []).map((offer) => {
            const status = offerStatus(offer);
            return (
              <Card key={offer.id}>
                <CardContent className="space-y-2 pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-black">{offer.title}</p>
                    <Badge variant={status === "live" ? "default" : "outline"}>
                      {STATUS_LABEL[status]}
                    </Badge>
                  </div>
                  <p className="text-desc font-bold text-market-navy">
                    {offer.discount_type === "percent"
                      ? `خصم ${offer.discount_value}%`
                      : `خصم ${offer.discount_value} ${currencyLabel(currency, locale)}`}
                    {offer.applies_to_all ? " · على كل المتجر" : " · على منتجات محددة"}
                  </p>
                  {offer.description ? (
                    <p className="text-desc text-muted-foreground">{offer.description}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(offer)}>
                      تعديل
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggle.mutate({ id: offer.id, isActive: !offer.is_active })}
                    >
                      {offer.is_active ? "إيقاف" : "تفعيل"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        archive.mutate(offer.id, {
                          onSuccess: () => toast.success("تم أرشفة العرض."),
                        });
                      }}
                    >
                      <Trash2 className="me-1 size-3.5" aria-hidden />
                      أرشفة
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

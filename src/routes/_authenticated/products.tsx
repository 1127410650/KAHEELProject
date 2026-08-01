import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, ChevronDown, GitMerge, Loader2, Plus, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { formatDate, formatMoney, pickName } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "المنتجات والأسعار — تحقّق | Products & prices — Tahqaq" },
      {
        name: "description",
        content:
          "دليل المنتجات الموحدة وسجل الأسعار المعتمدة من الفواتير الضريبية مع مقارنة أسعار الموردين.",
      },
      { property: "og:title", content: "المنتجات والأسعار — تحقّق" },
      {
        property: "og:description",
        content: "Unified product catalog with approved price history and supplier price comparison.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductsPage,
});

type PriceRow = {
  id: string;
  unified_product_id: string | null;
  supplier_id: string | null;
  invoice_id: string | null;
  invoice_date: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  total_with_vat: number | null;
  status: string;
  exclusion_reason: string | null;
};

function ProductsPage() {
  const { t, locale } = useI18n();
  const { can, isAccountant } = useSession();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ar: "", en: "", unit: "", category: "" });
  const [mergeFrom, setMergeFrom] = useState<string | null>(null);
  const [mergeInto, setMergeInto] = useState("");
  const [mergeReason, setMergeReason] = useState("");
  const [excluding, setExcluding] = useState<PriceRow | null>(null);
  const [excludeReason, setExcludeReason] = useState("");

  const canView = can("products.view") || isAccountant;
  const canManage = can("products.manage") || isAccountant;
  const canMerge = can("products.merge") || isAccountant;

  const productsQuery = useQuery({
    queryKey: ["unified-products"],
    enabled: canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unified_products")
        .select("id,arabic_name,english_name,category,default_unit,status,created_at")
        .order("arabic_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const pricesQuery = useQuery({
    queryKey: ["product-prices"],
    enabled: canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_price_history")
        .select(
          "id,unified_product_id,supplier_id,invoice_id,invoice_date,quantity,unit,unit_price,total_with_vat,status,exclusion_reason",
        )
        .order("invoice_date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as PriceRow[];
    },
  });

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", "min"],
    enabled: canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id,name_ar,name_en")
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const supplierName = (supplierId: string | null) => {
    const supplier = suppliersQuery.data?.find((s) => s.id === supplierId);
    return supplier ? pickName(locale, supplier.name_ar, supplier.name_en) : t("tiv.unknownSupplier");
  };

  const byProduct = useMemo(() => {
    const map = new Map<string, PriceRow[]>();
    for (const row of pricesQuery.data ?? []) {
      if (!row.unified_product_id) continue;
      const list = map.get(row.unified_product_id) ?? [];
      list.push(row);
      map.set(row.unified_product_id, list);
    }
    return map;
  }, [pricesQuery.data]);

  const products = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (productsQuery.data ?? []).filter(
      (p) =>
        !term ||
        (p.arabic_name ?? "").toLowerCase().includes(term) ||
        (p.english_name ?? "").toLowerCase().includes(term),
    );
  }, [productsQuery.data, search]);

  const createProduct = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("unified_products").insert({
        arabic_name: form.ar.trim(),
        english_name: form.en.trim() || null,
        default_unit: form.unit.trim() || null,
        category: form.category.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["unified-products"] });
      setCreating(false);
      setForm({ ar: "", en: "", unit: "", category: "" });
      toast.success(t("tiv.productCreated"));
    },
    onError: (error: Error) => toast.error(error.message || t("tiv.saveFailed")),
  });

  const merge = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("tiv_merge_products", {
        _from: mergeFrom!,
        _into: mergeInto,
        _reason: mergeReason.trim(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["unified-products"] });
      await qc.invalidateQueries({ queryKey: ["product-prices"] });
      setMergeFrom(null);
      setMergeInto("");
      setMergeReason("");
      toast.success(t("tiv.merged"));
    },
    onError: (error: Error) => toast.error(error.message || t("tiv.saveFailed")),
  });

  const exclude = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("tiv_exclude_price", {
        _id: excluding!.id,
        _reason: excludeReason.trim(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["product-prices"] });
      setExcluding(null);
      setExcludeReason("");
      toast.success(t("tiv.priceExcluded"));
    },
    onError: (error: Error) => toast.error(error.message || t("tiv.saveFailed")),
  });

  if (!canView) {
    return (
      <div className="space-y-3">
        <PageHeader title={t("nav.products")} />
        <p className="rounded-lg border border-border bg-card p-4 text-sm">{t("errors.forbidden")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
      <PageHeader
        title={t("nav.products")}
        description={t("tiv.productsSubtitle")}
        actions={
          canManage ? (
            <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden />
              {t("tiv.newProduct")}
            </Button>
          ) : null
        }
      />

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 ltr:left-2.5 rtl:right-2.5 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("tiv.searchProducts")}
          className="ltr:pl-8 rtl:pr-8"
          aria-label={t("tiv.searchProducts")}
        />
      </div>

      {productsQuery.isLoading || pricesQuery.isLoading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : products.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
          {t("tiv.noProducts")}
        </p>
      ) : (
        <div className="space-y-2">
          {products.map((product) => {
            const rows = (byProduct.get(product.id) ?? []).filter((r) => r.status === "active");
            const units = new Set(rows.map((r) => r.unit ?? "—"));
            // Never blend different units: statistics use the product's dominant unit only.
            const unitCounts = new Map<string, number>();
            for (const r of rows) {
              const k = r.unit ?? "—";
              unitCounts.set(k, (unitCounts.get(k) ?? 0) + 1);
            }
            const statUnit =
              Array.from(unitCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
            const statRows = statUnit ? rows.filter((r) => (r.unit ?? "—") === statUnit) : rows;
            const prices = statRows.map((r) => Number(r.unit_price ?? 0)).filter((n) => n > 0);
            const min = prices.length ? Math.min(...prices) : null;
            const max = prices.length ? Math.max(...prices) : null;
            const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
            const open = openId === product.id;

            const bySupplier = new Map<string, PriceRow[]>();
            for (const row of rows) {
              const key = row.supplier_id ?? "none";
              bySupplier.set(key, [...(bySupplier.get(key) ?? []), row]);
            }

            return (
              <article key={product.id} className="rounded-lg border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : product.id)}
                  className="flex w-full items-center gap-2 p-2.5 text-start"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">
                      {pickName(locale, product.arabic_name, product.english_name)}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {product.default_unit ?? "—"} · {t("tiv.pricePoints")}: {rows.length}
                      {min !== null ? ` · ${formatMoney(min, locale)} – ${formatMoney(max, locale)}` : ""}
                    </p>
                  </div>
                  {units.size > 1 && (
                    <Badge variant="outline" className="shrink-0 text-[10px] text-warning">
                      {t("tiv.mixedUnits")}
                    </Badge>
                  )}
                  <ChevronDown
                    className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>

                {open && (
                  <div className="space-y-2 border-t border-border p-2.5">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: t("tiv.minPrice"), value: min },
                        { label: t("tiv.avgPrice"), value: avg },
                        { label: t("tiv.maxPrice"), value: max },
                      ].map((cell) => (
                        <div key={cell.label} className="rounded-md border border-border bg-muted/40 p-1.5">
                          <p className="text-xs font-bold">{formatMoney(cell.value, locale)}</p>
                          <p className="text-[10px] leading-tight text-muted-foreground">{cell.label}</p>
                        </div>
                      ))}
                    </div>

                    {units.size > 1 && (
                      <p className="rounded-md border border-warning/50 bg-warning/10 p-1.5 text-[11px] text-warning">
                        {t("tiv.mixedUnitsHint")} ({Array.from(units).join(", ")})
                      </p>
                    )}

                    <h3 className="text-[11px] font-bold">{t("tiv.bySupplier")}</h3>
                    {Array.from(bySupplier.entries()).map(([supplierId, supplierRows]) => {
                      const supplierPrices = supplierRows
                        .map((r) => Number(r.unit_price ?? 0))
                        .filter((n) => n > 0);
                      const supplierAvg = supplierPrices.length
                        ? supplierPrices.reduce((a, b) => a + b, 0) / supplierPrices.length
                        : null;
                      return (
                        <div key={supplierId} className="rounded-md border border-border p-2">
                          <p className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                            <span className="truncate">
                              {supplierName(supplierId === "none" ? null : supplierId)}
                            </span>
                            <span>{formatMoney(supplierAvg, locale)}</span>
                          </p>
                          <ul className="mt-1 space-y-1">
                            {supplierRows.slice(0, 8).map((row) => (
                              <li
                                key={row.id}
                                className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground"
                              >
                                <span className="truncate">
                                  {formatDate(row.invoice_date)} · {row.quantity ?? "—"} {row.unit ?? ""}
                                </span>
                                <span className="flex shrink-0 items-center gap-1">
                                  {formatMoney(row.unit_price, locale)}
                                  {canManage && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-6"
                                      aria-label={t("tiv.excludePrice")}
                                      onClick={() => setExcluding(row)}
                                    >
                                      <Ban className="size-3.5" aria-hidden />
                                    </Button>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}

                    {rows.length === 0 && (
                      <p className="text-[11px] text-muted-foreground">{t("tiv.noPrices")}</p>
                    )}

                    {canMerge && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-[11px]"
                        onClick={() => {
                          setMergeFrom(product.id);
                          setMergeInto("");
                        }}
                      >
                        <GitMerge className="size-3.5" aria-hidden />
                        {t("tiv.mergeInto")}
                      </Button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* new product */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{t("tiv.newProduct")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2.5">
            <div className="space-y-1">
              <Label htmlFor="p-ar">{t("tiv.nameAr")}</Label>
              <Input id="p-ar" value={form.ar} onChange={(e) => setForm({ ...form, ar: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-en">{t("tiv.nameEn")}</Label>
              <Input id="p-en" value={form.en} onChange={(e) => setForm({ ...form, en: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label htmlFor="p-unit">{t("tiv.unit")}</Label>
                <Input id="p-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="p-cat">{t("tiv.category")}</Label>
                <Input
                  id="p-cat"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={createProduct.isPending || form.ar.trim().length < 2}
              onClick={() => createProduct.mutate()}
            >
              {t("common.save")}
            </Button>
            <Button variant="outline" onClick={() => setCreating(false)}>
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* merge */}
      <Dialog open={Boolean(mergeFrom)} onOpenChange={(o) => !o && setMergeFrom(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{t("tiv.mergeInto")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5">
            <p className="text-[11px] text-muted-foreground">{t("tiv.mergeHint")}</p>
            <Select value={mergeInto || "none"} onValueChange={(v) => setMergeInto(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder={t("tiv.pickProduct")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("tiv.noProduct")}</SelectItem>
                {(productsQuery.data ?? [])
                  .filter((p) => p.id !== mergeFrom)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {pickName(locale, p.arabic_name, p.english_name)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <div className="space-y-1">
              <Label htmlFor="m-reason">{t("tiv.reason")}</Label>
              <Textarea
                id="m-reason"
                rows={2}
                value={mergeReason}
                onChange={(e) => setMergeReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={merge.isPending || !mergeInto || mergeReason.trim().length < 4}
              onClick={() => merge.mutate()}
            >
              {t("common.confirm")}
            </Button>
            <Button variant="outline" onClick={() => setMergeFrom(null)}>
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* exclude price */}
      <Dialog open={Boolean(excluding)} onOpenChange={(o) => !o && setExcluding(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{t("tiv.excludePrice")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="e-reason">{t("tiv.reason")}</Label>
            <Textarea
              id="e-reason"
              rows={2}
              value={excludeReason}
              onChange={(e) => setExcludeReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={exclude.isPending || excludeReason.trim().length < 4}
              onClick={() => exclude.mutate()}
            >
              {t("common.confirm")}
            </Button>
            <Button variant="outline" onClick={() => setExcluding(null)}>
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

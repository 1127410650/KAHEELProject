import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Link2, Loader2, PackageSearch, Pencil, XCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { PageHeader } from "@/components/AppLayout";
import { InfoTable } from "@/components/InfoTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/_authenticated/invoices_/$id/lines")({
  head: () => ({
    meta: [
      { title: "مراجعة بنود الفاتورة — تحقّق | Invoice line review — Tahqaq" },
      {
        name: "description",
        content:
          "مراجعة واعتماد بنود الفاتورة المستخرجة وربطها بالمنتجات الموحدة قبل دخولها دليل الأسعار.",
      },
      { property: "og:title", content: "مراجعة بنود الفاتورة — تحقّق" },
      {
        property: "og:description",
        content: "Review, correct and approve extracted invoice line items before they enter the price book.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvoiceLinesPage,
});

type LineItem = {
  id: string;
  line_number: number | null;
  original_name: string | null;
  description: string | null;
  sku: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price_before_vat: number | null;
  vat_rate: number | null;
  subtotal_before_vat: number | null;
  total_with_vat: number | null;
  confidence: number | null;
  review_status: string;
  unified_product_id: string | null;
};

const REVIEW_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  approved: "default",
  rejected: "destructive",
  pending: "secondary",
  edited: "outline",
};

function num(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function InvoiceLinesPage() {
  const { id } = Route.useParams();
  const { t, locale } = useI18n();
  const { can, isAccountant } = useSession();
  const qc = useQueryClient();

  const [editing, setEditing] = useState<LineItem | null>(null);
  const [form, setForm] = useState({ name: "", quantity: "", unit: "", price: "", vat: "" });
  const [linking, setLinking] = useState<LineItem | null>(null);
  const [productId, setProductId] = useState("");
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");

  const canReview = can("invoices.review_extracted") || isAccountant;
  const canDecide = can("invoices.approve") || isAccountant;

  const invoiceQuery = useQuery({
    queryKey: ["verified-invoice", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id,internal_no,invoice_no,invoice_date,status,amount_before_tax,tax_amount,total_amount,seller_name_raw,seller_vat_number,extraction_method,lines_reviewed_at,approved_at,supplier:suppliers(id,name_ar,name_en),project:projects(id,code,name_ar,name_en)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const linesQuery = useQuery({
    queryKey: ["invoice-lines", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_line_items")
        .select(
          "id,line_number,original_name,description,sku,quantity,unit,unit_price_before_vat,vat_rate,subtotal_before_vat,total_with_vat,confidence,review_status,unified_product_id",
        )
        .eq("invoice_id", id)
        .order("line_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LineItem[];
    },
  });

  const productsQuery = useQuery({
    queryKey: ["unified-products", "min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unified_products")
        .select("id,arabic_name,english_name,default_unit,status")
        .eq("status", "active")
        .order("arabic_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const lines = linesQuery.data ?? [];
  const invoice = invoiceQuery.data;

  const totals = useMemo(() => {
    const before = lines.reduce((sum, l) => sum + Number(l.subtotal_before_vat ?? 0), 0);
    const withVat = lines.reduce((sum, l) => sum + Number(l.total_with_vat ?? 0), 0);
    const invBefore = Number(invoice?.amount_before_tax ?? 0);
    const invTotal = Number(invoice?.total_amount ?? 0);
    return {
      before,
      withVat,
      diffBefore: before - invBefore,
      diffTotal: withVat - invTotal,
      matches: Math.abs(withVat - invTotal) < 0.05,
    };
  }, [lines, invoice]);

  const pending = lines.filter((l) => l.review_status === "pending").length;

  const reviewLine = useMutation({
    mutationFn: async (payload: {
      lineId: string;
      decision: "approve" | "reject" | "edit";
      patch?: Record<string, unknown>;
      reason?: string;
    }) => {
      const { error } = await supabase.rpc("tiv_review_line_item", {
        _id: payload.lineId,
        _decision: payload.decision,
        _patch: (payload.patch ?? {}) as never,
        _reason: payload.reason ?? undefined,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["invoice-lines", id] });
      await qc.invalidateQueries({ queryKey: ["verified-invoice", id] });
      toast.success(t("tiv.lineSaved"));
    },
    onError: (error: Error) => toast.error(error.message || t("tiv.saveFailed")),
  });

  const decide = useMutation({
    mutationFn: async (payload: { decision: "approve" | "reject"; note: string }) => {
      const { error } = await supabase.rpc("tiv_decide_invoice", {
        _invoice_id: id,
        _decision: payload.decision,
        _note: payload.note || undefined,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["verified-invoice", id] });
      await qc.invalidateQueries({ queryKey: ["invoice-lines", id] });
      setDecision(null);
      setNote("");
      toast.success(t("tiv.decisionSaved"));
    },
    onError: (error: Error) => toast.error(error.message || t("tiv.saveFailed")),
  });

  if (invoiceQuery.isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-3">
        <PageHeader title={t("tiv.linesTitle")} />
        <p className="rounded-lg border border-border bg-card p-4 text-sm">{t("tiv.invoiceNotFound")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
      <PageHeader
        title={t("tiv.linesTitle")}
        description={`${invoice.invoice_no ?? invoice.internal_no} · ${formatDate(invoice.invoice_date)}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/invoices">{t("tiv.allInvoices")}</Link>
          </Button>
        }
      />

      <section className="rounded-lg border border-border bg-card p-3">
        <InfoTable
          dense
          rows={[
            {
              label: t("tiv.supplier"),
              value: invoice.supplier
                ? pickName(locale, invoice.supplier.name_ar, invoice.supplier.name_en)
                : invoice.seller_name_raw,
            },
            { label: t("tiv.vatNumber"), value: invoice.seller_vat_number },
            {
              label: t("tiv.project"),
              value: invoice.project
                ? `${invoice.project.code} — ${pickName(locale, invoice.project.name_ar, invoice.project.name_en)}`
                : null,
              hideIfEmpty: true,
            },
            { label: t("tiv.status"), value: t(`status.${invoice.status}`) },
            { label: t("tiv.beforeTax"), value: formatMoney(invoice.amount_before_tax, locale) },
            { label: t("tiv.taxAmount"), value: formatMoney(invoice.tax_amount, locale) },
            { label: t("tiv.totalWithTax"), value: formatMoney(invoice.total_amount, locale) },
          ]}
        />
      </section>

      <section
        className={`rounded-lg border p-3 text-xs ${
          totals.matches
            ? "border-success/40 bg-success/10 text-success"
            : "border-warning/50 bg-warning/10 text-warning"
        }`}
      >
        <p className="font-bold">{totals.matches ? t("tiv.totalsMatch") : t("tiv.totalsMismatch")}</p>
        <p className="mt-1 leading-snug">
          {t("tiv.linesSum")}: {formatMoney(totals.withVat, locale)} · {t("tiv.difference")}:{" "}
          {formatMoney(totals.diffTotal, locale)}
        </p>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">
            {t("tiv.lines")} <span className="text-muted-foreground">({lines.length})</span>
          </h2>
          <span className="text-[11px] text-muted-foreground">
            {t("tiv.pendingLines")}: {pending}
          </span>
        </div>

        {lines.length === 0 && (
          <p className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
            {t("tiv.noLines")}
          </p>
        )}

        {lines.map((line) => {
          const product = productsQuery.data?.find((p) => p.id === line.unified_product_id);
          return (
            <article key={line.id} className="rounded-lg border border-border bg-card p-2.5">
              <header className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold">
                    {line.line_number ? `${line.line_number}. ` : ""}
                    {line.original_name || line.description || "—"}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {line.quantity ?? "—"} {line.unit ?? ""} ×{" "}
                    {formatMoney(line.unit_price_before_vat, locale)}
                    {line.sku ? ` · ${line.sku}` : ""}
                  </p>
                </div>
                <Badge variant={REVIEW_BADGE[line.review_status] ?? "secondary"} className="shrink-0 text-[10px]">
                  {t(`tiv.review.${line.review_status}`)}
                </Badge>
              </header>

              <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                <span>
                  {t("tiv.beforeTax")}: {formatMoney(line.subtotal_before_vat, locale)}
                </span>
                <span>
                  {t("tiv.totalWithTax")}: {formatMoney(line.total_with_vat, locale)}
                </span>
                <span>
                  {t("tiv.vatRate")}: {line.vat_rate ?? "—"}%
                </span>
                <span className="truncate">
                  {t("tiv.unifiedProduct")}:{" "}
                  {product ? pickName(locale, product.arabic_name, product.english_name) : "—"}
                </span>
              </div>

              {canReview && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-[11px]"
                    onClick={() => {
                      setEditing(line);
                      setForm({
                        name: line.original_name ?? "",
                        quantity: String(line.quantity ?? ""),
                        unit: line.unit ?? "",
                        price: String(line.unit_price_before_vat ?? ""),
                        vat: String(line.vat_rate ?? 15),
                      });
                    }}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                    {t("common.edit")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-[11px]"
                    onClick={() => {
                      setLinking(line);
                      setProductId(line.unified_product_id ?? "");
                    }}
                  >
                    <Link2 className="size-3.5" aria-hidden />
                    {t("tiv.linkProduct")}
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 gap-1 text-[11px]"
                    disabled={reviewLine.isPending || line.review_status === "approved"}
                    onClick={() => reviewLine.mutate({ lineId: line.id, decision: "approve" })}
                  >
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    {t("tiv.approveLine")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-[11px] text-destructive"
                    disabled={reviewLine.isPending || line.review_status === "rejected"}
                    onClick={() => reviewLine.mutate({ lineId: line.id, decision: "reject" })}
                  >
                    <XCircle className="size-3.5" aria-hidden />
                    {t("tiv.rejectLine")}
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </section>

      {canDecide && (
        <section className="flex flex-wrap gap-2 rounded-lg border border-border bg-card p-3">
          <div className="w-full text-[11px] text-muted-foreground">{t("tiv.decideHint")}</div>
          <Button
            disabled={decide.isPending || pending > 0}
            onClick={() => setDecision("approve")}
            className="gap-1.5"
          >
            <CheckCircle2 className="size-4" aria-hidden />
            {t("tiv.approveInvoice")}
          </Button>
          <Button
            variant="outline"
            disabled={decide.isPending}
            onClick={() => setDecision("reject")}
            className="gap-1.5 text-destructive"
          >
            <XCircle className="size-4" aria-hidden />
            {t("tiv.rejectInvoice")}
          </Button>
          <Button variant="ghost" asChild className="gap-1.5">
            <Link to="/products">
              <PackageSearch className="size-4" aria-hidden />
              {t("nav.products")}
            </Link>
          </Button>
        </section>
      )}

      {/* edit line */}
      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{t("tiv.editLine")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2.5">
            <div className="space-y-1">
              <Label htmlFor="l-name">{t("tiv.lineName")}</Label>
              <Input id="l-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label htmlFor="l-qty">{t("tiv.quantity")}</Label>
                <Input
                  id="l-qty"
                  inputMode="decimal"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="l-unit">{t("tiv.unit")}</Label>
                <Input id="l-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="l-price">{t("tiv.unitPrice")}</Label>
                <Input
                  id="l-price"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="l-vat">{t("tiv.vatRate")}</Label>
                <Input
                  id="l-vat"
                  inputMode="decimal"
                  value={form.vat}
                  onChange={(e) => setForm({ ...form, vat: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={reviewLine.isPending}
              onClick={() => {
                if (!editing) return;
                reviewLine.mutate({
                  lineId: editing.id,
                  decision: "edit",
                  patch: {
                    original_name: form.name.trim() || null,
                    quantity: num(form.quantity),
                    unit: form.unit.trim() || null,
                    unit_price_before_vat: num(form.price),
                    vat_rate: num(form.vat),
                  },
                });
                setEditing(null);
              }}
            >
              {t("common.save")}
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* link to unified product */}
      <Dialog open={Boolean(linking)} onOpenChange={(o) => !o && setLinking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{t("tiv.linkProduct")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">{t("tiv.unitWarning")}</p>
            <Select value={productId || "none"} onValueChange={(v) => setProductId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder={t("tiv.pickProduct")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("tiv.noProduct")}</SelectItem>
                {(productsQuery.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {pickName(locale, p.arabic_name, p.english_name)}
                    {p.default_unit ? ` — ${p.default_unit}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              disabled={reviewLine.isPending}
              onClick={() => {
                if (!linking) return;
                reviewLine.mutate({
                  lineId: linking.id,
                  decision: "edit",
                  patch: { unified_product_id: productId || null },
                });
                setLinking(null);
              }}
            >
              {t("common.save")}
            </Button>
            <Button variant="outline" onClick={() => setLinking(null)}>
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* invoice decision */}
      <Dialog open={Boolean(decision)} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              {decision === "approve" ? t("tiv.approveInvoice") : t("tiv.rejectInvoice")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="d-note">{t("tiv.note")}</Label>
            <Textarea id="d-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">{t("tiv.approveEffect")}</p>
          </div>
          <DialogFooter>
            <Button
              disabled={decide.isPending || (decision === "reject" && note.trim().length < 4)}
              onClick={() => decision && decide.mutate({ decision, note: note.trim() })}
            >
              {t("common.confirm")}
            </Button>
            <Button variant="outline" onClick={() => setDecision(null)}>
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

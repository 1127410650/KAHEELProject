import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  Copy,
  Loader2,
  Save,
  Send,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { PageHeader } from "@/components/AppLayout";
import { InfoTable } from "@/components/InfoTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, formatDateTime, formatMoney, pickName, todayInRiyadh } from "@/lib/format";
import {
  clearStashedVerification,
  readStashedVerification,
  saveVerifiedInvoice,
  splitAmounts,
  type SaveInvoiceOutcome,
  type StashedVerification,
} from "@/lib/invoice-save";

export const Route = createFileRoute("/_authenticated/invoices_/verified/new")({
  head: () => ({
    meta: [
      { title: "مراجعة وحفظ الفاتورة — تحقّق | Review & save invoice — Tahqaq" },
      {
        name: "description",
        content:
          "مراجعة نتيجة التحقق الضريبي للفاتورة وحفظها في النظام مع ربط المورد والمشروع والبنود المستخرجة.",
      },
      { property: "og:title", content: "مراجعة وحفظ الفاتورة — تحقّق" },
      {
        property: "og:description",
        content: "Review a ZATCA verification result and save the invoice with supplier and line items.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SaveVerifiedInvoicePage,
});

const LEVEL_STYLE: Record<string, string> = {
  green: "border-success/40 bg-success/10 text-success",
  yellow: "border-warning/50 bg-warning/10 text-warning",
  red: "border-destructive/40 bg-destructive/10 text-destructive",
  gray: "border-border bg-muted text-muted-foreground",
};

interface SupplierMatch {
  supplier_id: string | null;
  matched_by: string | null;
  name_ar?: string | null;
  name_en?: string | null;
  name_mismatch?: boolean;
}

function SaveVerifiedInvoicePage() {
  const { t, locale } = useI18n();
  const { can, isAccountant } = useSession();
  const navigate = useNavigate();

  const [stash, setStash] = useState<StashedVerification | null | undefined>(undefined);
  const [showTech, setShowTech] = useState(false);
  const [busy, setBusy] = useState(false);
  const [duplicate, setDuplicate] = useState<SaveInvoiceOutcome["duplicate"]>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const clientToken = useRef(crypto.randomUUID());

  // form state
  const [supplierId, setSupplierId] = useState("");
  const [createSupplier, setCreateSupplier] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayInRiyadh());
  const [projectId, setProjectId] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    const found = readStashedVerification();
    setStash(found);
    if (found) {
      setInvoiceNo(found.invoiceNo ?? "");
      setInvoiceDate(found.invoiceDate ?? found.timestamp?.slice(0, 10) ?? todayInRiyadh());
    }
  }, []);

  const amounts = useMemo(
    () => splitAmounts(stash?.total ?? null, stash?.vatTotal ?? null),
    [stash?.total, stash?.vatTotal],
  );
  const zatcaUuid = stash?.decodedTags.find((f) => f.tag === 6)?.value ?? null;

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", "min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id,name_ar,name_en,tax_number")
        .is("deleted_at", null)
        .order("name_ar");
      if (error) throw error;
      return data;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name_ar,name_en,code,supervisor_id")
        .is("deleted_at", null)
        .order("name_ar");
      if (error) throw error;
      return data;
    },
  });

  const { data: match } = useQuery({
    queryKey: ["supplier-match", stash?.vatNumber, stash?.sellerName],
    enabled: Boolean(stash && (stash.vatNumber || stash.sellerName)),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("tiv_match_supplier", {
        _vat: stash?.vatNumber ?? null,
        _name: stash?.sellerName ?? null,
      });
      if (error) throw error;
      return data as unknown as SupplierMatch;
    },
  });

  useEffect(() => {
    if (match?.supplier_id && !supplierId) setSupplierId(match.supplier_id);
  }, [match?.supplier_id, supplierId]);

  // supervisor auto-fill from the selected project
  useEffect(() => {
    if (!projectId) return;
    const project = projects.find((p) => p.id === projectId);
    if (project?.supervisor_id) setSupervisorId(project.supervisor_id);
  }, [projectId, projects]);

  const lineItems = stash?.lineItems ?? [];
  const highConfidence = lineItems.filter(
    (li) => li.unitPrice && li.quantity && li.name && li.name.length > 2,
  ).length;
  const needsReview = lineItems.length - highConfidence;

  const canSave = can("invoices.save_verified") || isAccountant;

  async function save(status: "tech_verified" | "needs_review", overrideWith?: string) {
    if (!stash || busy) return;
    if (!canSave) {
      toast.error(t("tiv.noSavePerm"));
      return;
    }
    if (!invoiceNo.trim()) {
      toast.error(t("tiv.invoiceNoRequired"));
      return;
    }
    if (!supplierId && !createSupplier) {
      toast.error(t("tiv.supplierRequired"));
      return;
    }
    setBusy(true);
    try {
      const outcome = await saveVerifiedInvoice({
        stash,
        invoiceNo: invoiceNo.trim(),
        invoiceDate,
        supplierId: supplierId || null,
        createSupplier: !supplierId && createSupplier,
        sellerName: stash.sellerName,
        sellerVat: stash.vatNumber,
        projectId: projectId || null,
        supervisorId: supervisorId || null,
        amountBeforeTax: amounts.before,
        taxAmount: amounts.tax,
        description: description.trim() || null,
        status,
        lineItems,
        clientToken: clientToken.current,
        duplicateOverrideReason: overrideWith ?? null,
        file,
      });

      if (!outcome.saved && outcome.duplicate?.duplicate) {
        setDuplicate(outcome.duplicate);
        return;
      }
      if (!outcome.saved || !outcome.invoiceId) {
        toast.error(t("tiv.saveFailed"));
        return;
      }
      clearStashedVerification();
      toast.success(
        outcome.fileUploaded === false && file ? t("tiv.savedNoFile") : t("tiv.saved"),
      );
      navigate({ to: "/invoices/$id/lines", params: { id: outcome.invoiceId } });
    } catch {
      toast.error(t("tiv.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (stash === undefined) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (stash === null) {
    return (
      <div className="space-y-3">
        <PageHeader title={t("tiv.reviewTitle")} />
        <div className="rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4 text-warning" aria-hidden />
            {t("tiv.expired")}
          </p>
          <Link
            to="/verify-invoice"
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
          >
            {t("tiv.scanAgain")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
      <PageHeader title={t("tiv.reviewTitle")} subtitle={t("tiv.reviewSubtitle")} />

      {/* 1 — verification result */}
      <section className={`rounded-lg border p-3 ${LEVEL_STYLE[stash.level] ?? LEVEL_STYLE.gray}`}>
        <p className="flex items-center gap-2 text-sm font-bold">
          <ShieldCheck className="size-4" aria-hidden />
          {t(`verify.level.${stash.level}`)}
          {stash.phase ? (
            <span className="text-[11px] font-medium opacity-80">
              {t("verify.phase")} {stash.phase}
            </span>
          ) : null}
        </p>
        {stash.reasons.length > 0 && (
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[11px] leading-snug opacity-90">
            {stash.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-3">
        <InfoTable
          dense
          rows={[
            { label: t("tiv.seller"), value: stash.sellerName },
            { label: t("tiv.vatNumber"), value: stash.vatNumber },
            { label: t("tiv.invoiceTimestamp"), value: formatDateTime(stash.timestamp) },
            { label: t("tiv.beforeTax"), value: formatMoney(amounts.before, locale) },
            { label: t("tiv.taxAmount"), value: formatMoney(amounts.tax, locale) },
            { label: t("tiv.totalWithTax"), value: formatMoney(amounts.total, locale) },
            { label: t("tiv.extractionMethod"), value: stash.extractionMethod },
            { label: t("tiv.uuid"), value: zatcaUuid, hideIfEmpty: true },
          ]}
        />
        <button
          type="button"
          onClick={() => setShowTech((v) => !v)}
          className="mt-2 flex w-full items-center justify-between rounded-md px-1 py-1.5 text-xs font-semibold text-primary"
        >
          {t("tiv.technicalDetails")}
          <ChevronDown className={`size-4 transition-transform ${showTech ? "rotate-180" : ""}`} aria-hidden />
        </button>
        {showTech && (
          <div className="mt-1 space-y-1.5 rounded-md bg-muted/50 p-2 text-[11px]">
            {stash.decodedTags.map((tag) => (
              <p key={`${tag.tag}-${tag.value}`} className="break-all">
                <span className="font-semibold">TLV {tag.tag}:</span> {tag.value}
              </p>
            ))}
            <p className="break-all">
              <span className="font-semibold">file_hash:</span> {stash.fileHash ?? "—"}
            </p>
            <p className="break-all">
              <span className="font-semibold">qr_hash:</span> {stash.qrHash ?? "—"}
            </p>
          </div>
        )}
      </section>

      {/* 2 — save data */}
      <section className="space-y-3 rounded-lg border border-border bg-card p-3">
        <h2 className="text-sm font-bold">{t("tiv.saveData")}</h2>

        {match?.supplier_id && match?.name_mismatch && (
          <div className="rounded-md border border-warning/50 bg-warning/10 p-2 text-[11px] leading-snug">
            <p className="font-semibold">{t("tiv.supplierNameMismatch")}</p>
            <p>
              {t("tiv.registeredName")}: {match.name_ar ?? match.name_en ?? "—"}
            </p>
            <p>
              {t("tiv.extractedName")}: {stash.sellerName ?? "—"}
            </p>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("tiv.supplier")}</Label>
            <Select
              value={supplierId || "none"}
              onValueChange={(v) => {
                setSupplierId(v === "none" ? "" : v);
                setCreateSupplier(false);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("tiv.pickSupplier")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("tiv.noSupplier")}</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {pickName(s.name_ar, s.name_en, locale)}
                    {s.tax_number ? ` — ${s.tax_number}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!supplierId && (
              <div className="rounded-md border border-border bg-muted/40 p-2 text-[11px]">
                <p className="font-semibold">{t("tiv.supplierNotFound")}</p>
                <p className="mt-0.5">
                  {stash.sellerName ?? "—"} — {stash.vatNumber ?? "—"}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant={createSupplier ? "default" : "outline"}
                  className="mt-2 h-7 gap-1 text-[11px]"
                  onClick={() => setCreateSupplier((v) => !v)}
                >
                  <Truck className="size-3.5" aria-hidden />
                  {createSupplier ? t("tiv.willCreateSupplier") : t("tiv.createSupplier")}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inv-no">{t("tiv.invoiceNo")}</Label>
            <Input id="inv-no" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inv-date">{t("tiv.invoiceDate")}</Label>
            <Input
              id="inv-date"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("tiv.project")}</Label>
            <Select value={projectId || "none"} onValueChange={(v) => setProjectId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder={t("tiv.pickProject")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("tiv.noProject")}</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code} — {pickName(p.name_ar, p.name_en, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="inv-desc">{t("tiv.description")}</Label>
            <Textarea
              id="inv-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="inv-file">{t("tiv.originalFile")}</Label>
            <Input
              id="inv-file"
              type="file"
              accept="image/*,application/pdf,text/xml,application/xml"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-[11px] text-muted-foreground">
              {stash.fileName ? `${t("tiv.scannedFile")}: ${stash.fileName}` : t("tiv.fileOptional")}
            </p>
          </div>
        </div>

        <InfoTable
          dense
          rows={[
            { label: t("tiv.currency"), value: "SAR" },
            {
              label: t("tiv.supervisor"),
              value: supervisorId ? t("tiv.autoFromProject") : t("tiv.notSet"),
            },
          ]}
        />
      </section>

      {/* 3 — extracted line items */}
      <section className="rounded-lg border border-border bg-card p-3">
        <h2 className="text-sm font-bold">{t("tiv.extractedLines")}</h2>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {[
            { label: t("tiv.linesCount"), value: lineItems.length },
            { label: t("tiv.linesHigh"), value: highConfidence },
            { label: t("tiv.linesNeedReview"), value: needsReview },
          ].map((c) => (
            <div key={c.label} className="rounded-md border border-border bg-muted/40 p-2">
              <p className="text-base font-bold">{c.value}</p>
              <p className="text-[10px] leading-tight text-muted-foreground">{c.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{t("tiv.reviewAfterSave")}</p>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => save("tech_verified")} className="gap-1.5">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          {t("tiv.saveDraft")}
        </Button>
        <Button disabled={busy} variant="secondary" onClick={() => save("needs_review")} className="gap-1.5">
          <Send className="size-4" aria-hidden />
          {t("tiv.saveAndReview")}
        </Button>
        <Button variant="outline" asChild className="gap-1.5">
          <Link to="/verify-invoice">
            <ArrowLeft className="size-4" aria-hidden />
            {t("tiv.backToResult")}
          </Link>
        </Button>
        <Button variant="ghost" onClick={() => navigate({ to: "/invoices" })}>
          {t("common.cancel")}
        </Button>
      </div>

      {/* duplicate dialog */}
      <Dialog open={Boolean(duplicate)} onOpenChange={(o) => !o && setDuplicate(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Copy className="size-4 text-warning" aria-hidden />
              {t("tiv.duplicateTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="text-[11px] text-muted-foreground">
              {t("tiv.duplicateReasons")}:{" "}
              {(duplicate?.reasons ?? []).map((r) => t(`tiv.dupReason.${r}`)).join(" · ")}
            </p>
            {(duplicate?.invoices ?? []).map((inv) => (
              <div key={inv.id} className="rounded-md border border-border p-2">
                <InfoTable
                  dense
                  rows={[
                    { label: t("tiv.invoiceNo"), value: inv.invoice_no ?? inv.internal_no },
                    { label: t("tiv.invoiceDate"), value: formatDate(inv.invoice_date) },
                    { label: t("tiv.totalWithTax"), value: formatMoney(inv.total_amount, locale) },
                    { label: t("tiv.status"), value: t(`status.${inv.status}`) },
                    { label: t("tiv.duplicateReasons"), value: t(`tiv.dupReason.${inv.reason}`) },
                  ]}
                />
                <Button size="sm" variant="outline" asChild className="mt-2 h-7 text-[11px]">
                  <Link to="/invoices/$id/lines" params={{ id: inv.id }}>
                    {t("tiv.openPrevious")}
                  </Link>
                </Button>
              </div>
            ))}
            {(isAccountant || can("invoices.approve")) && (
              <div className="space-y-1.5 border-t border-border pt-2">
                <Label htmlFor="dup-reason">{t("tiv.overrideReason")}</Label>
                <Textarea
                  id="dup-reason"
                  rows={2}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            {(isAccountant || can("invoices.approve")) && (
              <Button
                disabled={busy || overrideReason.trim().length < 4}
                onClick={() => {
                  setDuplicate(null);
                  void save("needs_review", overrideReason.trim());
                }}
              >
                {t("tiv.overrideSave")}
              </Button>
            )}
            <Button variant="outline" onClick={() => setDuplicate(null)}>
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

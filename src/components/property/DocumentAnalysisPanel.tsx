import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Check,
  FileSearch,
  Loader2,
  Pencil,
  RefreshCw,
  ScrollText,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { pdb, type PropertyRow } from "@/lib/property";
import {
  ANALYSIS_STATUS_LABELS,
  CONFIDENCE_LABELS,
  DOC_TYPE_LABELS,
  MATCH_LABELS,
  METHOD_LABELS,
  STAGE_LABELS,
  confidenceBand,
  maskValue,
  type DocType,
  type ExtractionMethod,
  type MatchState,
} from "@/lib/doc-analysis";
import { findReusableAnalysis, startAnalysis, type RunHandle, type RunProgress } from "@/lib/doc-analysis-run";

const L = (locale: string, pair: [string, string] | undefined, fallback = "—") =>
  pair ? (locale === "ar" ? pair[0] : pair[1]) : fallback;

const MATCH_TONE: Record<MatchState, string> = {
  match: "border-emerald-500/40 text-emerald-600",
  close: "border-amber-500/40 text-amber-600",
  different: "border-destructive/40 text-destructive",
  missing_in_project: "border-primary/40 text-primary",
  missing_in_document: "border-border text-muted-foreground",
  needs_review: "border-border text-muted-foreground",
};

/** Local analysis + review panel for a single project document. */
export function DocumentAnalysisPanel({
  document,
  projectId,
}: {
  document: PropertyRow;
  projectId: string;
}) {
  const { locale } = useI18n();
  const qc = useQueryClient();
  const { profile, can, isAccountant } = useSession() as unknown as {
    profile: { user_id?: string } | null;
    can: (p: never) => boolean;
    isAccountant: boolean;
  };
  const documentId = String(document["id"]);
  const runRef = useRef<RunHandle | null>(null);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [rawText, setRawText] = useState<string | null>(null);

  const allow = (p: string) => isAccountant || can(p as never);
  const canAnalyze = allow("property_documents.analyze");
  const canReview = allow("property_documents.review_analysis");
  const canApprove = allow("property_documents.approve_analysis");
  const canApply = allow("property_documents.apply_analysis");
  const canRaw = allow("property_documents.view_raw_text");
  const canSeeSensitive = canApprove;

  const analysisQuery = useQuery({
    queryKey: ["doc-analysis", documentId],
    queryFn: async () => {
      const { data, error } = await pdb
        .from("document_analyses")
        .select("*")
        .eq("document_id", documentId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] as PropertyRow | undefined) ?? null;
    },
  });
  const analysis = analysisQuery.data ?? null;
  const analysisId = analysis ? String(analysis["id"]) : null;

  const fieldsQuery = useQuery({
    enabled: !!analysisId,
    queryKey: ["doc-analysis-fields", analysisId],
    queryFn: async () => {
      const { data, error } = await pdb
        .from("document_analysis_fields")
        .select("*")
        .eq("analysis_id", analysisId)
        .order("field_key");
      if (error) throw error;
      return (data ?? []) as PropertyRow[];
    },
  });

  const conflictsQuery = useQuery({
    enabled: !!analysisId,
    queryKey: ["doc-analysis-conflicts", analysisId],
    queryFn: async () => {
      const { data, error } = await pdb
        .from("document_analysis_conflicts")
        .select("*")
        .eq("analysis_id", analysisId)
        .order("severity");
      if (error) throw error;
      return (data ?? []) as PropertyRow[];
    },
  });

  const fields = fieldsQuery.data ?? [];
  const conflicts = conflictsQuery.data ?? [];
  const openHigh = conflicts.filter((c) => c["status"] === "open" && c["severity"] === "high");
  const pendingCount = fields.filter((f) => f["status"] === "proposed").length;

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["doc-analysis", documentId] });
    await qc.invalidateQueries({ queryKey: ["doc-analysis-fields", analysisId] });
    await qc.invalidateQueries({ queryKey: ["doc-analysis-conflicts", analysisId] });
  };

  async function run(quick: boolean, force: boolean) {
    if (!canAnalyze) return;
    try {
      if (!force) {
        const reusable = await findReusableAnalysis(
          documentId,
          (document["file_hash"] as string | null) ?? null,
        );
        if (reusable && String(reusable["status"]) !== "failed") {
          await invalidate();
          toast.info(
            locale === "ar"
              ? "يوجد تحليل سابق لنفس النسخة — تم عرضه بدل إعادة التحليل"
              : "An analysis already exists for this version — showing it instead",
          );
          return;
        }
      }
      setProgress({ stage: "preparing", percent: 2 });
      const handle = await startAnalysis({
        document,
        projectId,
        quick,
        locale: locale === "ar" ? "ar" : "en",
        userId: profile?.user_id ?? null,
        onProgress: setProgress,
      });
      runRef.current = handle;
      const outcome = await handle.done;
      runRef.current = null;
      setProgress(null);
      await invalidate();
      if (outcome.status === "failed") {
        toast.error(
          locale === "ar"
            ? `تعذّر تحليل المستند: ${outcome.message ?? ""}`
            : `Analysis failed: ${outcome.message ?? ""}`,
        );
      } else if (outcome.status === "ready_for_review") {
        toast.success(locale === "ar" ? "التحليل جاهز للمراجعة" : "Analysis ready for review");
      }
    } catch (e) {
      setProgress(null);
      const msg = (e as Error).message;
      toast.error(
        msg === "FILE_TOO_LARGE"
          ? locale === "ar"
            ? "الملف أكبر من الحد المسموح للتحليل"
            : "File is larger than the analysis limit"
          : msg,
      );
    }
  }

  function cancel() {
    runRef.current?.cancel();
    runRef.current = null;
    setProgress(null);
    void invalidate();
    toast.info(locale === "ar" ? "أُلغي التحليل" : "Analysis cancelled");
  }

  const review = useMutation({
    mutationFn: async (input: { id: string; action: "confirm" | "edit" | "reject"; value?: string }) => {
      const { error } = await supabase.rpc("document_analysis_review_field", {
        _field_id: input.id,
        _action: input.action,
        ...(input.value !== undefined ? { _value: input.value } : {}),
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(translateError(locale, e.message)),
  });

  const resolve = useMutation({
    mutationFn: async (input: { id: string; keep: "project" | "document"; reason: string }) => {
      const { error } = await supabase.rpc("document_analysis_resolve_conflict", {
        _conflict_id: input.id,
        _resolution: input.reason,
        _keep: input.keep,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(translateError(locale, e.message)),
  });

  const apply = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("document_analysis_apply", {
        _analysis_id: analysisId as string,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      await qc.invalidateQueries({ queryKey: ["property-summary", projectId] });
      await qc.invalidateQueries({ queryKey: ["property"] });
      toast.success(locale === "ar" ? "تم تطبيق القيم المعتمدة" : "Approved values applied");
    },
    onError: (e: Error) => toast.error(translateError(locale, e.message)),
  });

  async function loadRaw() {
    const { data, error } = await supabase.rpc("document_analysis_raw_text", {
      _analysis_id: analysisId as string,
    });
    if (error) {
      toast.error(translateError(locale, error.message));
      return;
    }
    setRawText((data as string | null) ?? "");
  }

  const busy = !!progress;

  return (
    <div className="mt-3 rounded-md border border-border p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <FileSearch className="size-4" aria-hidden />
          {locale === "ar" ? "التحليل المحلي للمستند" : "Local document analysis"}
        </p>
        {analysis && (
          <Badge variant="outline" className="text-xs">
            {L(locale, ANALYSIS_STATUS_LABELS[String(analysis["status"])], String(analysis["status"]))}
          </Badge>
        )}
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {locale === "ar"
          ? "يعمل التحليل داخل جهازك فقط بدون أي خدمة مدفوعة، والقيم لا تُطبّق قبل مراجعتك."
          : "Analysis runs on your device only, with no paid service, and nothing is applied before your review."}
      </p>

      {busy && (
        <div className="mt-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              {L(locale, STAGE_LABELS[progress.stage])}
              {progress.note ? <span className="num text-muted-foreground">{progress.note}</span> : null}
            </span>
            <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={cancel}>
              <Ban className="size-3.5" aria-hidden />
              {locale === "ar" ? "إلغاء" : "Cancel"}
            </Button>
          </div>
          <Progress value={progress.percent} className="mt-1.5 h-1.5" />
        </div>
      )}

      {canAnalyze && !busy && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" className="h-8 gap-1 px-2 text-xs" onClick={() => void run(false, !!analysis)}>
            <FileSearch className="size-3.5" aria-hidden />
            {analysis
              ? locale === "ar"
                ? "إعادة تحليل"
                : "Re-analyze"
              : locale === "ar"
                ? "تحليل المستند"
                : "Analyze document"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 px-2 text-xs"
            onClick={() => void run(true, true)}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            {locale === "ar" ? "تحليل سريع (بدون OCR)" : "Quick (no OCR)"}
          </Button>
        </div>
      )}

      {analysis && (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>
              {locale === "ar" ? "النوع المتوقع: " : "Detected type: "}
              {L(locale, DOC_TYPE_LABELS[(analysis["document_type_detected"] as DocType) ?? "unknown"])}
            </span>
            <span>·</span>
            <span>
              {locale === "ar" ? "الطريقة: " : "Method: "}
              {L(locale, METHOD_LABELS[(analysis["extraction_method"] as ExtractionMethod) ?? "pdf_text"])}
            </span>
            <span>·</span>
            <span>
              {locale === "ar" ? "الثقة: " : "Confidence: "}
              {L(locale, CONFIDENCE_LABELS[confidenceBand(analysis["overall_confidence"] as number)])}
            </span>
            {analysis["page_count"] ? (
              <>
                <span>·</span>
                <span className="num">
                  {locale === "ar" ? "الصفحات: " : "Pages: "}
                  {String(analysis["page_count"])}
                </span>
              </>
            ) : null}
            {analysis["quick_mode"] ? (
              <>
                <span>·</span>
                <span>{locale === "ar" ? "تحليل سريع" : "Quick mode"}</span>
              </>
            ) : null}
          </div>

          {String(analysis["status"]) === "failed" && (
            <p className="mt-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
              {locale === "ar"
                ? "تعذّر التحليل. يمكنك إدخال البيانات يدويًا أو إعادة المحاولة بملف أوضح."
                : "Analysis failed. Enter the data manually or retry with a clearer file."}
            </p>
          )}

          {openHigh.length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-500/10 p-2 text-xs text-amber-700">
              <AlertTriangle className="size-3.5" aria-hidden />
              {locale === "ar"
                ? "يوجد تعارض عالي الخطورة يجب حلّه قبل التطبيق."
                : "A high-severity conflict must be resolved before applying."}
            </p>
          )}

          {conflicts.filter((c) => c["status"] === "open").length > 0 && (
            <div className="mt-2 space-y-2">
              <p className="text-xs font-medium">{locale === "ar" ? "التعارضات" : "Conflicts"}</p>
              {conflicts
                .filter((c) => c["status"] === "open")
                .map((c) => {
                  const id = String(c["id"]);
                  const key = String(c["field_key"]);
                  return (
                    <div key={id} className="rounded-md border border-border p-2 text-xs">
                      <p className="font-medium">{key}</p>
                      <p className="mt-0.5 text-muted-foreground">
                        {locale === "ar" ? "المستند: " : "Document: "}
                        <span className="num">
                          {maskValue(key, c["document_value"] as string, canSeeSensitive)}
                        </span>
                        {" · "}
                        {locale === "ar" ? "المشروع: " : "Project: "}
                        <span className="num">
                          {maskValue(key, c["project_value"] as string, canSeeSensitive)}
                        </span>
                        {" · "}
                        {String(c["severity"])}
                      </p>
                      {canApprove && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Input
                            className="h-7 w-40 text-xs"
                            placeholder={locale === "ar" ? "سبب القرار (مطلوب)" : "Decision reason"}
                            value={reasonById[id] ?? ""}
                            onChange={(e) => setReasonById((s) => ({ ...s, [id]: e.target.value }))}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            disabled={!reasonById[id]?.trim()}
                            onClick={() =>
                              resolve.mutate({ id, keep: "document", reason: reasonById[id] ?? "" })
                            }
                          >
                            {locale === "ar" ? "اعتماد قيمة المستند" : "Keep document value"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            disabled={!reasonById[id]?.trim()}
                            onClick={() =>
                              resolve.mutate({ id, keep: "project", reason: reasonById[id] ?? "" })
                            }
                          >
                            {locale === "ar" ? "الإبقاء على قيمة المشروع" : "Keep project value"}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          {fields.length > 0 ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium">
                  {locale === "ar" ? "الحقول المستخرجة" : "Extracted fields"}{" "}
                  <span className="num text-muted-foreground">
                    ({fields.length - pendingCount}/{fields.length})
                  </span>
                </p>
                {canRaw && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => (rawText === null ? void loadRaw() : setRawText(null))}
                  >
                    <ScrollText className="size-3.5" aria-hidden />
                    {rawText === null
                      ? locale === "ar"
                        ? "عرض النص الخام"
                        : "Show raw text"
                      : locale === "ar"
                        ? "إخفاء النص الخام"
                        : "Hide raw text"}
                  </Button>
                )}
              </div>

              {rawText !== null && (
                <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 text-[11px] leading-5 whitespace-pre-wrap">
                  {rawText || (locale === "ar" ? "لا يوجد نص مستخرج." : "No extracted text.")}
                </pre>
              )}

              <Separator />

              {fields.map((f) => {
                const id = String(f["id"]);
                const key = String(f["field_key"]);
                const status = String(f["status"]);
                const match = (f["match_state"] as MatchState) ?? "needs_review";
                const value = (f["normalized_value"] as string) ?? (f["extracted_value"] as string);
                const sensitive = !!f["is_sensitive"];
                const locked = sensitive && !canApprove;
                return (
                  <div key={id} className="rounded-md border border-border p-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{String(f["field_label"] ?? key)}</span>
                      <Badge variant="outline" className={`text-[10px] ${MATCH_TONE[match]}`}>
                        {L(locale, MATCH_LABELS[match])}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {L(locale, CONFIDENCE_LABELS[confidenceBand(f["confidence"] as number)])}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {L(locale, METHOD_LABELS[(f["extraction_method"] as ExtractionMethod) ?? "ocr"])}
                      </Badge>
                      {f["page_number"] ? (
                        <span className="num text-muted-foreground">
                          {locale === "ar" ? "ص" : "p"}
                          {String(f["page_number"])}
                        </span>
                      ) : null}
                      {sensitive && (
                        <Badge variant="outline" className="border-destructive/40 text-[10px] text-destructive">
                          {locale === "ar" ? "حساس" : "Sensitive"}
                        </Badge>
                      )}
                      {status !== "proposed" && (
                        <Badge variant="secondary" className="text-[10px]">
                          {status === "confirmed"
                            ? locale === "ar"
                              ? "مؤكد"
                              : "Confirmed"
                            : status === "edited"
                              ? locale === "ar"
                                ? "معدّل"
                                : "Edited"
                              : locale === "ar"
                                ? "مرفوض"
                                : "Rejected"}
                        </Badge>
                      )}
                    </div>

                    <p className="mt-1">
                      <span className="text-muted-foreground">
                        {locale === "ar" ? "من المستند: " : "From document: "}
                      </span>
                      <span className="num">{maskValue(key, value, canSeeSensitive)}</span>
                    </p>
                    <p className="mt-0.5">
                      <span className="text-muted-foreground">
                        {locale === "ar" ? "في المشروع: " : "In project: "}
                      </span>
                      <span className="num">
                        {maskValue(key, f["current_project_value"] as string, canSeeSensitive)}
                      </span>
                    </p>
                    {f["original_text"] ? (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        “{String(f["original_text"])}”
                      </p>
                    ) : null}

                    {canReview && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-xs"
                          disabled={locked}
                          onClick={() => review.mutate({ id, action: "confirm" })}
                        >
                          <Check className="size-3.5" aria-hidden />
                          {locale === "ar" ? "تأكيد" : "Confirm"}
                        </Button>
                        <Input
                          className="h-7 w-36 text-xs"
                          placeholder={locale === "ar" ? "قيمة معدّلة" : "Edited value"}
                          value={edit[id] ?? ""}
                          onChange={(e) => setEdit((s) => ({ ...s, [id]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-xs"
                          disabled={locked || !edit[id]?.trim()}
                          onClick={() => review.mutate({ id, action: "edit", value: edit[id] ?? "" })}
                        >
                          <Pencil className="size-3.5" aria-hidden />
                          {locale === "ar" ? "حفظ التعديل" : "Save edit"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 px-2 text-xs text-destructive"
                          onClick={() => review.mutate({ id, action: "reject" })}
                        >
                          <X className="size-3.5" aria-hidden />
                          {locale === "ar" ? "رفض" : "Reject"}
                        </Button>
                        {locked && (
                          <span className="text-[11px] text-muted-foreground">
                            {locale === "ar"
                              ? "يحتاج اعتماد الموظف المختص"
                              : "Needs approval by the responsible officer"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {canApply && (
                <Button
                  size="sm"
                  className="h-8 gap-1 px-2 text-xs"
                  disabled={
                    openHigh.length > 0 ||
                    apply.isPending ||
                    !fields.some((f) => f["status"] === "confirmed" || f["status"] === "edited")
                  }
                  onClick={() => apply.mutate()}
                >
                  <BadgeCheck className="size-3.5" aria-hidden />
                  {locale === "ar" ? "تطبيق القيم المعتمدة على المشروع" : "Apply approved values"}
                </Button>
              )}
            </div>
          ) : (
            analysis &&
            String(analysis["status"]) !== "failed" && (
              <p className="mt-2 text-xs text-muted-foreground">
                {locale === "ar"
                  ? "لم يُستخرج أي حقل تلقائيًا من هذا المستند — أدخل البيانات يدويًا في تبويبات الملف."
                  : "No field was extracted automatically — enter the data manually in the file tabs."}
              </p>
            )
          )}
        </>
      )}
    </div>
  );
}

function translateError(locale: string, message: string): string {
  const map: Record<string, [string, string]> = {
    REVIEW_FORBIDDEN: ["لا تملك صلاحية مراجعة الحقول", "You cannot review fields"],
    APPROVE_FORBIDDEN: ["لا تملك صلاحية حل التعارضات", "You cannot resolve conflicts"],
    APPLY_FORBIDDEN: ["لا تملك صلاحية تطبيق القيم", "You cannot apply values"],
    RAW_TEXT_FORBIDDEN: ["لا تملك صلاحية عرض النص الخام", "You cannot view the raw text"],
    SENSITIVE_APPROVAL_REQUIRED: [
      "هذا الحقل حساس ويحتاج اعتماد الموظف المختص",
      "This field is sensitive and needs an approver",
    ],
    UNRESOLVED_CONFLICTS: [
      "يوجد تعارض عالي الخطورة غير محلول",
      "There is an unresolved high-severity conflict",
    ],
    REASON_REQUIRED: ["سبب القرار مطلوب", "A decision reason is required"],
    NOT_ALLOWED: ["لا تملك صلاحية الوصول لهذا المستند", "You cannot access this document"],
  };
  for (const [code, pair] of Object.entries(map)) {
    if (message.includes(code)) return locale === "ar" ? pair[0] : pair[1];
  }
  return message;
}

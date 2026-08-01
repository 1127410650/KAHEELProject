/**
 * Client orchestration for local document analysis.
 * Owns the DB lifecycle (analysis row, run row, fields, conflicts) and the worker lifecycle.
 * Nothing leaves the browser except the analysis results written to our own database.
 */
import { supabase } from "@/integrations/supabase/client";
import { BUCKET, signedUrl } from "@/lib/attachments";
import { pdb } from "@/lib/property";
import {
  allowsNumericTolerance,
  ANALYZER_VERSION,
  compareValue,
  conflictSeverity,
  type AnalyzeResult,
  type ProgressStage,
} from "@/lib/doc-analysis";
import type { WorkerRequest, WorkerResponse } from "@/workers/doc-analysis.worker";

export interface RunProgress {
  stage: ProgressStage;
  percent: number;
  note?: string;
}

export interface RunHandle {
  analysisId: string;
  cancel: () => void;
  done: Promise<{ status: "ready_for_review" | "cancelled" | "failed"; message?: string }>;
}

const MAX_ANALYSIS_BYTES = 25 * 1024 * 1024;

/** Column groups that the apply RPC understands; used to fetch the current project value. */
async function currentProjectValues(projectId: string): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  const put = (prefix: string, row: Record<string, unknown> | null) => {
    if (!row) return;
    for (const [k, v] of Object.entries(row)) {
      if (v === null || v === undefined || typeof v === "object") continue;
      out[`${prefix}.${k}`] = String(v);
    }
  };

  const land = await pdb.from("property_land").select("*").eq("project_id", projectId).maybeSingle();
  put("land", (land.data as Record<string, unknown> | null) ?? null);

  const deed = await pdb
    .from("property_deeds")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_current", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  put("deed", (deed.data as Record<string, unknown> | null) ?? null);

  const license = await pdb
    .from("property_licenses")
    .select("*")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  put("license", (license.data as Record<string, unknown> | null) ?? null);

  return out;
}

async function fetchDocumentBytes(storagePath: string): Promise<ArrayBuffer> {
  const direct = await supabase.storage.from(BUCKET).download(storagePath);
  if (direct.data) return direct.data.arrayBuffer();
  const url = await signedUrl(storagePath);
  if (!url) throw new Error("DOWNLOAD_FAILED");
  const res = await fetch(url);
  if (!res.ok) throw new Error("DOWNLOAD_FAILED");
  return res.arrayBuffer();
}

/** Reuses the newest non-failed analysis for the same file hash and analyzer version. */
export async function findReusableAnalysis(documentId: string, fileHash: string | null) {
  const query = pdb
    .from("document_analyses")
    // raw_text is excluded on purpose (permission-checked RPC only).
    .select("id,status,file_hash,analyzer_version,document_type_detected,overall_confidence,created_at")
    .eq("document_id", documentId)
    .eq("analyzer_version", ANALYZER_VERSION)
    .not("status", "in", "(failed,cancelled)")
    .order("created_at", { ascending: false })
    .limit(1);
  const { data } = fileHash ? await query.eq("file_hash", fileHash) : await query;
  return (data?.[0] as Record<string, unknown> | undefined) ?? null;
}

export async function startAnalysis(input: {
  document: Record<string, unknown>;
  projectId: string;
  quick: boolean;
  locale: "ar" | "en";
  userId: string | null;
  onProgress: (p: RunProgress) => void;
}): Promise<RunHandle> {
  const documentId = String(input.document["id"]);
  const storagePath = String(input.document["storage_path"]);
  const fileName = String(input.document["file_name"] ?? "document");
  const mime = String(input.document["mime_type"] ?? "");
  const fileSize = Number(input.document["file_size"] ?? 0);
  if (fileSize > MAX_ANALYSIS_BYTES) throw new Error("FILE_TOO_LARGE");

  const insert = await pdb
    .from("document_analyses")
    .insert({
      document_id: documentId,
      project_id: input.projectId,
      analyzer_version: ANALYZER_VERSION,
      status: "preparing",
      quick_mode: input.quick,
      file_hash: (input.document["file_hash"] as string | null) ?? null,
      document_version: Number(input.document["version"] ?? 1),
      started_at: new Date().toISOString(),
      created_by: input.userId,
    })
    .select("id")
    .single();
  if (insert.error) throw insert.error;
  const analysisId = String((insert.data as { id: string }).id);

  const runInsert = await pdb
    .from("document_analysis_runs")
    .insert({
      analysis_id: analysisId,
      analyzer_version: ANALYZER_VERSION,
      device_info: {
        ua: navigator.userAgent.slice(0, 200),
        cores: navigator.hardwareConcurrency ?? null,
        quick: input.quick,
      },
    })
    .select("id")
    .single();
  const runId = (runInsert.data as { id: string } | null)?.id ?? null;

  let worker: Worker | null = null;
  let cancelled = false;
  const startedAt = Date.now();

  const finishRun = async (result: string) => {
    if (!runId) return;
    await pdb
      .from("document_analysis_runs")
      .update({
        result,
        completed_at: new Date().toISOString(),
        performance_metrics: { duration_ms: Date.now() - startedAt },
      })
      .eq("id", runId);
  };

  const done = new Promise<{ status: "ready_for_review" | "cancelled" | "failed"; message?: string }>(
    (resolve) => {
      void (async () => {
        try {
          input.onProgress({ stage: "preparing", percent: 3 });
          const bytes = await fetchDocumentBytes(storagePath);
          if (cancelled) return;

          worker = new Worker(new URL("../workers/doc-analysis.worker.ts", import.meta.url), {
            type: "module",
          });

          worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
            const msg = event.data;
            if (msg.kind === "progress") {
              input.onProgress({ stage: msg.stage, percent: msg.percent, ...(msg.note ? { note: msg.note } : {}) });
              void pdb.from("document_analyses").update({ status: msg.stage }).eq("id", analysisId);
              return;
            }
            if (msg.kind === "error") {
              void (async () => {
                await pdb
                  .from("document_analyses")
                  .update({
                    status: "failed",
                    failure_code: msg.code,
                    failure_message: msg.message.slice(0, 400),
                    completed_at: new Date().toISOString(),
                  })
                  .eq("id", analysisId);
                await finishRun("failed");
                worker?.terminate();
                resolve({ status: "failed", message: msg.message });
              })();
              return;
            }
            void (async () => {
              try {
                await persist(analysisId, input.projectId, msg.result);
                await finishRun("success");
                worker?.terminate();
                resolve({ status: "ready_for_review" });
              } catch (e) {
                await pdb
                  .from("document_analyses")
                  .update({
                    status: "failed",
                    failure_code: "SAVE_FAILED",
                    failure_message: (e as Error).message.slice(0, 400),
                  })
                  .eq("id", analysisId);
                await finishRun("failed");
                resolve({ status: "failed", message: (e as Error).message });
              }
            })();
          };

          worker.onerror = () => {
            void (async () => {
              await pdb
                .from("document_analyses")
                .update({ status: "failed", failure_code: "WORKER", failure_message: "WORKER_ERROR" })
                .eq("id", analysisId);
              await finishRun("failed");
              resolve({ status: "failed", message: "WORKER_ERROR" });
            })();
          };

          const request: WorkerRequest = {
            bytes,
            mime,
            fileName,
            quick: input.quick,
            locale: input.locale,
          };
          worker.postMessage(request, [bytes]);
        } catch (e) {
          await pdb
            .from("document_analyses")
            .update({
              status: "failed",
              failure_code: "PREPARE",
              failure_message: (e as Error).message.slice(0, 400),
            })
            .eq("id", analysisId);
          await finishRun("failed");
          resolve({ status: "failed", message: (e as Error).message });
        }
      })();
    },
  );

  return {
    analysisId,
    cancel: () => {
      cancelled = true;
      worker?.terminate();
      void pdb
        .from("document_analyses")
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", analysisId);
      void finishRun("cancelled");
    },
    done,
  };
}

/** Writes fields + conflicts and flips the analysis to ready_for_review. */
async function persist(analysisId: string, projectId: string, result: AnalyzeResult) {
  const projectValues = await currentProjectValues(projectId);

  const rows = result.fields.map((f) => {
    const documentValue = f.normalized_value ?? f.extracted_value;
    const projectValue = projectValues[f.field_key] ?? null;
    return {
      analysis_id: analysisId,
      field_key: f.field_key,
      field_label: f.field_label,
      extracted_value: f.extracted_value,
      normalized_value: f.normalized_value,
      original_text: f.original_text.slice(0, 500),
      page_number: f.page_number,
      extraction_method: f.extraction_method,
      confidence: Number(f.confidence.toFixed(2)),
      is_sensitive: f.is_sensitive,
      current_project_value: projectValue,
      match_state: compareValue(documentValue, projectValue, allowsNumericTolerance(f.field_key)),
      status: "proposed",
    };
  });

  if (rows.length) {
    const { error } = await pdb.from("document_analysis_fields").insert(rows);
    if (error) throw error;
  }

  const conflicts = rows
    .filter((r) => r.match_state === "different" || r.match_state === "close")
    .map((r) => ({
      analysis_id: analysisId,
      field_key: r.field_key,
      document_value: r.normalized_value ?? r.extracted_value,
      project_value: r.current_project_value,
      conflict_type: r.match_state === "close" ? "close_value" : "value_mismatch",
      severity: conflictSeverity(r.field_key),
      status: "open",
    }));
  if (conflicts.length) {
    const { error } = await pdb.from("document_analysis_conflicts").insert(conflicts);
    if (error) throw error;
  }

  const overall = rows.length
    ? Number((rows.reduce((n, r) => n + r.confidence, 0) / rows.length).toFixed(2))
    : 0;

  const { error } = await pdb
    .from("document_analyses")
    .update({
      status: "ready_for_review",
      document_type_detected: result.documentType,
      language_detected: result.language,
      extraction_method: result.method,
      page_count: result.pageCount,
      raw_text: result.rawText.slice(0, 200000),
      qr_findings: result.qr as never,
      overall_confidence: overall,
      completed_at: new Date().toISOString(),
    })
    .eq("id", analysisId);
  if (error) throw error;
}

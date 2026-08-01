import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileUp, Layers, RotateCcw, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { InfoTable } from "@/components/InfoTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatDate } from "@/lib/format";
import { ACCEPT, BUCKET, isAllowedFile, isAllowedSize, signedUrl } from "@/lib/attachments";
import {
  DOC_CATEGORY_LABELS,
  DOC_VISIBILITY_LABELS,
  labelOf,
  pdb,
  type PropertyRow,
} from "@/lib/property";

async function sha256(file: File): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

function safeName(name: string) {
  return (
    name
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^\w.\-\u0600-\u06FF]/g, "")
      .slice(-120) || "file"
  );
}

/** Document library: categories, versions, visibility levels, change/delete requests. */
export function PropertyDocuments({
  projectId,
  canUpload,
  canManage,
  isAccountant,
}: {
  projectId: string;
  canUpload: boolean;
  canManage: boolean;
  isAccountant: boolean;
}) {
  const { locale } = useI18n();
  const qc = useQueryClient();
  const { profile } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("other");
  const [visibility, setVisibility] = useState("project_shared");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});

  const queryKey = ["property", "property_documents", projectId];

  const { data: docs = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await pdb
        .from("property_documents")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PropertyRow[];
    },
  });

  const { data: changeRequests = [] } = useQuery({
    queryKey: ["property-doc-requests", projectId],
    queryFn: async () => {
      const { data, error } = await pdb
        .from("property_document_requests")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PropertyRow[];
    },
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey });
    await qc.invalidateQueries({ queryKey: ["property-doc-requests", projectId] });
    await qc.invalidateQueries({ queryKey: ["property-summary", projectId] });
  };

  async function upload(previousId?: string) {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error(locale === "ar" ? "اختر ملفًا أولاً" : "Pick a file first");
      return;
    }
    if (!isAllowedFile(file)) {
      toast.error(locale === "ar" ? "نوع الملف غير مسموح" : "File type not allowed");
      return;
    }
    if (!isAllowedSize(file)) {
      toast.error(locale === "ar" ? "حجم الملف كبير" : "File too large");
      return;
    }
    setBusy(true);
    try {
      const hash = await sha256(file);
      const id = crypto.randomUUID();
      const path = `projects/${projectId}/${id}/${safeName(file.name)}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: false,
        ...(file.type ? { contentType: file.type } : {}),
      });
      if (up.error) throw up.error;

      if (previousId) {
        const { error } = await supabase.rpc("property_document_add_version", {
          _previous_id: previousId,
          _payload: {
            title: title.trim() || file.name,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type || null,
            file_hash: hash,
            storage_path: path,
          } as never,
        });
        if (error) throw error;
      } else {
        const { error } = await pdb.from("property_documents").insert({
          id,
          project_id: projectId,
          doc_category: category,
          visibility,
          title: title.trim() || file.name,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || null,
          file_hash: hash,
          storage_path: path,
          created_by: profile?.user_id ?? null,
        });
        if (error) throw error;
      }
      if (fileRef.current) fileRef.current.value = "";
      setTitle("");
      await invalidate();
      toast.success(locale === "ar" ? "تم رفع المستند" : "Document uploaded");
    } catch (e) {
      const msg = (e as Error).message;
      toast.error(
        msg.includes("duplicate")
          ? locale === "ar"
            ? "هذا الملف مرفوع مسبقًا في هذا المشروع"
            : "This file already exists in this project"
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  const askChange = useMutation({
    mutationFn: async (input: { documentId: string; action: "edit" | "delete"; reason: string }) => {
      const { error } = await pdb.from("property_document_requests").insert({
        document_id: input.documentId,
        project_id: projectId,
        action: input.action,
        reason: input.reason,
        created_by: profile?.user_id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success(locale === "ar" ? "أُرسل الطلب للموظف المختص" : "Request sent for review");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async (input: { id: string; approve: boolean; reason: string }) => {
      const { error } = await supabase.rpc("property_document_request_decide", {
        _id: input.id,
        _approve: input.approve,
        _reason: input.reason,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("property_document_restore", {
        _document_id: id,
        _reason: locale === "ar" ? "استعادة بواسطة المحاسب" : "Restored by accountant",
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  async function open(path: string, download?: string) {
    try {
      const url = download
        ? (
            await supabase.storage.from(BUCKET).createSignedUrl(path, 300, { download })
          ).data?.signedUrl
        : await signedUrl(path);
      if (!url) throw new Error("SIGNED_URL");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const pending = changeRequests.filter((r) => r["status"] === "pending");

  return (
    <div className="space-y-3">
      {canUpload && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">
              {locale === "ar" ? "رفع مستند" : "Upload document"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 p-4 pt-0 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground" htmlFor="doc-title">
                {locale === "ar" ? "اسم المستند" : "Document title"}
              </Label>
              <Input
                id="doc-title"
                className="h-9"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground" htmlFor="doc-cat">
                {locale === "ar" ? "التصنيف" : "Category"}
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="doc-cat" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {locale === "ar" ? v[0] : v[1]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground" htmlFor="doc-vis">
                {locale === "ar" ? "مستوى الرؤية" : "Visibility"}
              </Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger id="doc-vis" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_VISIBILITY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {locale === "ar" ? v[0] : v[1]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground" htmlFor="doc-file">
                {locale === "ar" ? "الملف" : "File"}
              </Label>
              <Input id="doc-file" type="file" accept={ACCEPT} ref={fileRef} className="h-9" />
            </div>
            <div className="sm:col-span-2">
              <Button size="sm" className="h-9 gap-1" disabled={busy} onClick={() => void upload()}>
                <FileUp className="size-4" aria-hidden />
                {locale === "ar" ? "رفع" : "Upload"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canManage && pending.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldAlert className="size-4" aria-hidden />
              {locale === "ar" ? "طلبات تعديل/حذف المستندات" : "Document change requests"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0">
            {pending.map((r) => (
              <div key={String(r["id"])} className="rounded-md border border-border p-2.5">
                <p className="text-sm font-medium">
                  {r["action"] === "delete"
                    ? locale === "ar"
                      ? "طلب حذف"
                      : "Delete request"
                    : locale === "ar"
                      ? "طلب تعديل"
                      : "Edit request"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{String(r["reason"] ?? "")}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Input
                    className="h-8 w-44 text-xs"
                    placeholder={locale === "ar" ? "سبب القرار (مطلوب)" : "Decision reason"}
                    value={reasonById[String(r["id"])] ?? ""}
                    onChange={(e) =>
                      setReasonById((s) => ({ ...s, [String(r["id"])]: e.target.value }))
                    }
                  />
                  <Button
                    size="sm"
                    className="h-8 px-2 text-xs"
                    disabled={!reasonById[String(r["id"])]?.trim()}
                    onClick={() =>
                      decide.mutate({
                        id: String(r["id"]),
                        approve: true,
                        reason: reasonById[String(r["id"])] ?? "",
                      })
                    }
                  >
                    {locale === "ar" ? "اعتماد" : "Approve"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs text-destructive"
                    disabled={!reasonById[String(r["id"])]?.trim()}
                    onClick={() =>
                      decide.mutate({
                        id: String(r["id"]),
                        approve: false,
                        reason: reasonById[String(r["id"])] ?? "",
                      })
                    }
                  >
                    {locale === "ar" ? "رفض" : "Reject"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">
            {locale === "ar" ? "مكتبة المستندات" : "Document library"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {docs.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {locale === "ar" ? "لا توجد مستندات." : "No documents yet."}
            </p>
          ) : (
            <Accordion type="single" collapsible className="divide-y divide-border">
              {docs.map((d) => {
                const id = String(d["id"]);
                const deleted = !!d["deleted_at"];
                return (
                  <AccordionItem key={id} value={id} className="border-0">
                    <AccordionTrigger className="py-2.5 text-start hover:no-underline">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {String(d["title"] ?? d["file_name"])}
                          {deleted && (
                            <span className="ms-1 text-xs text-destructive">
                              {locale === "ar" ? "(محذوف)" : "(deleted)"}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {labelOf(locale, DOC_CATEGORY_LABELS, d["doc_category"] as string)} ·{" "}
                          {labelOf(locale, DOC_VISIBILITY_LABELS, d["visibility"] as string)} ·{" "}
                          <span className="num">v{String(d["version"])}</span>
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-3">
                      <InfoTable
                        dense
                        rows={[
                          { label: locale === "ar" ? "الملف" : "File", value: String(d["file_name"]) },
                          {
                            label: locale === "ar" ? "الحجم" : "Size",
                            value: d["file_size"] ? `${Math.round(Number(d["file_size"]) / 1024)} KB` : "—",
                          },
                          { label: locale === "ar" ? "تاريخ الإضافة" : "Added", value: formatDate(d["created_at"] as string) },
                          {
                            label: locale === "ar" ? "سبب الحذف" : "Delete reason",
                            value: (d["delete_reason"] as string) ?? "—",
                            hideIfEmpty: true,
                          },
                        ]}
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 px-2 text-xs"
                          onClick={() => void open(String(d["storage_path"]))}
                        >
                          <Layers className="size-3.5" aria-hidden />
                          {locale === "ar" ? "عرض" : "View"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 px-2 text-xs"
                          onClick={() =>
                            void open(String(d["storage_path"]), String(d["file_name"]))
                          }
                        >
                          <Download className="size-3.5" aria-hidden />
                          {locale === "ar" ? "تنزيل" : "Download"}
                        </Button>
                        {canUpload && !deleted && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 px-2 text-xs"
                            disabled={busy}
                            onClick={() => void upload(id)}
                          >
                            <FileUp className="size-3.5" aria-hidden />
                            {locale === "ar" ? "إصدار جديد (من الملف المختار)" : "New version"}
                          </Button>
                        )}
                        {isAccountant && deleted && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 px-2 text-xs"
                            onClick={() => restore.mutate(id)}
                          >
                            <RotateCcw className="size-3.5" aria-hidden />
                            {locale === "ar" ? "استعادة" : "Restore"}
                          </Button>
                        )}
                      </div>

                      {!deleted && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Input
                            className="h-8 w-44 text-xs"
                            placeholder={locale === "ar" ? "سبب الطلب" : "Request reason"}
                            value={reasonById[id] ?? ""}
                            onChange={(e) =>
                              setReasonById((s) => ({ ...s, [id]: e.target.value }))
                            }
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs"
                            disabled={!reasonById[id]?.trim()}
                            onClick={() =>
                              askChange.mutate({
                                documentId: id,
                                action: "edit",
                                reason: reasonById[id] ?? "",
                              })
                            }
                          >
                            {locale === "ar" ? "طلب تعديل" : "Request edit"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 px-2 text-xs text-destructive"
                            disabled={!reasonById[id]?.trim()}
                            onClick={() =>
                              askChange.mutate({
                                documentId: id,
                                action: "delete",
                                reason: reasonById[id] ?? "",
                              })
                            }
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                            {locale === "ar" ? "طلب حذف" : "Request delete"}
                          </Button>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

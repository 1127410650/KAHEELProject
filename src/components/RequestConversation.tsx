import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell,
  CheckCheck,
  FileText,
  HelpCircle,
  MessageSquare,
  Paperclip,
  Reply,
  Send,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import {
  ACCEPT,
  isAllowedFile,
  isAllowedSize,
  openAttachment,
  uploadAttachments,
} from "@/lib/attachments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MESSAGE_VISIBILITIES,
  VISIBILITY_LABELS_AR,
  VISIBILITY_LABELS_EN,
  type MessageVisibility,
} from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Kind = "message" | "info_request" | "supervisor_reply" | "reminder";

const KIND_ICON: Record<Kind, typeof MessageSquare> = {
  message: MessageSquare,
  info_request: HelpCircle,
  supervisor_reply: Reply,
  reminder: Bell,
};

interface MessageRow {
  id: string;
  request_id: string;
  body: string;
  msg_kind: string;
  author_id: string | null;
  author_role: string | null;
  reply_to_id: string | null;
  created_at: string;
  is_draft: boolean;
  due_date: string | null;
  priority: string | null;
  items: unknown;
  visibility: string | null;
  deleted_at: string | null;
}

interface Props {
  requestId: string;
  projectId: string | null;
  /** Supervisor/requester of the request — controls which composer is offered. */
  canAskInfo: boolean;
  canReply: boolean;
  infoState: string;
}

/** Unified conversation: messages, info requests, supervisor replies and reminders in one thread. */
export function RequestConversation({
  requestId,
  projectId,
  canAskInfo,
  canReply,
  infoState,
}: Props) {
  const { t, locale } = useI18n();
  const { session, role, isSupervisor, isAccountant } = useSession();
  /** Only staff may mark a message internal or requester-only. */
  const canChooseVisibility = isAccountant || !isSupervisor;
  const visibilityLabels = locale === "ar" ? VISIBILITY_LABELS_AR : VISIBILITY_LABELS_EN;
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<"message" | "info_request" | "supervisor_reply">(
    canReply && infoState === "awaiting_supervisor" ? "supervisor_reply" : "message",
  );
  const [dueDate, setDueDate] = useState("");
  const [visibility, setVisibility] = useState<MessageVisibility>("shared");
  const tokenRef = useRef(crypto.randomUUID());

  const messagesQuery = useQuery({
    queryKey: ["request", requestId, "messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_messages")
        .select("*")
        .eq("request_id", requestId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MessageRow[];
    },
  });

  const messages = messagesQuery.data ?? [];

  const attachmentsQuery = useQuery({
    queryKey: ["request", requestId, "message-attachments", messages.length],
    enabled: messages.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attachments")
        .select("id, entity_id, file_name, storage_path, version, created_at")
        .eq("entity_type", "request_message")
        .in("entity_id", messages.map((m) => m.id))
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const byMessage = useMemo(() => {
    const map = new Map<string, { id: string; file_name: string; storage_path: string; version: number }[]>();
    for (const a of attachmentsQuery.data ?? []) {
      const list = map.get(a.entity_id) ?? [];
      list.push(a);
      map.set(a.entity_id, list);
    }
    return map;
  }, [attachmentsQuery.data]);

  const authors = useMemo(
    () => Array.from(new Set(messages.map((m) => m.author_id).filter(Boolean) as string[])),
    [messages],
  );

  const { data: profiles = [] } = useQuery({
    queryKey: ["request", requestId, "message-authors", authors.join(",")],
    enabled: authors.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", authors);
      if (error) throw error;
      return data ?? [];
    },
  });

  const nameOf = (userId: string | null) =>
    profiles.find((p) => p.user_id === userId)?.full_name ?? t("conversation.system");

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["request", requestId] });
    void queryClient.invalidateQueries({ queryKey: ["requests"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  const post = useMutation({
    mutationFn: async () => {
      const text = body.trim();
      if (!text) throw new Error("BODY_REQUIRED");
      if (files.some((f) => !isAllowedFile(f))) throw new Error("FILE_TYPE");
      if (files.some((f) => !isAllowedSize(f))) throw new Error("FILE_SIZE");

      let messageId: string;
      if (mode === "info_request") {
        const { data, error } = await supabase.rpc("request_ask_info", {
          _request_id: requestId,
          _body: text,
          ...(dueDate ? { _due_date: dueDate } : {}),
        });
        if (error) throw error;
        messageId = data as string;
      } else if (mode === "supervisor_reply") {
        const { data, error } = await supabase.rpc("request_supervisor_reply", {
          _request_id: requestId,
          _body: text,
          _client_token: tokenRef.current,
        });
        if (error) throw error;
        messageId = data as string;
      } else {
        const { data, error } = await supabase.rpc("request_post_message", {
          _request_id: requestId,
          _body: text,
          _client_token: tokenRef.current,
          ...(canChooseVisibility ? { _visibility: visibility } : {}),
          ...(replyTo ? { _reply_to: replyTo.id } : {}),
        });
        if (error) throw error;
        messageId = data as string;
      }

      if (files.length && messageId) {
        await uploadAttachments(files, {
          projectId,
          requestId,
          entityType: "request_message",
          entityId: messageId,
          kind: mode,
          uploaderRole: role,
          userId: session?.user.id ?? null,
        });
      }
    },
    onSuccess: () => {
      toast.success(t("conversation.sent"));
      setBody("");
      setFiles([]);
      setReplyTo(null);
      setDueDate("");
      setVisibility("shared");
      tokenRef.current = crypto.randomUUID();
      if (fileInput.current) fileInput.current.value = "";
      invalidate();
    },
    onError: (error: Error) => {
      const message = error.message ?? "";
      if (message.includes("DUPLICATE_FILE")) toast.error(t("attachments.duplicate"));
      else if (message.includes("FILE_TYPE")) toast.error(t("attachments.fileType"));
      else if (message.includes("FILE_SIZE")) toast.error(t("attachments.fileSize"));
      else if (message.includes("BODY_REQUIRED")) toast.error(t("conversation.bodyRequired"));
      else if (message.includes("FORBIDDEN")) toast.error(t("common.notAllowed"));
      else toast.error(t("conversation.sendFailed"));
    },
  });

  const markRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("request_mark_read", { _request_id: requestId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("conversation.allRead"));
      invalidate();
    },
  });

  const composerModes: { key: typeof mode; label: string; show: boolean }[] = [
    { key: "message", label: t("conversation.modeMessage"), show: true },
    { key: "info_request", label: t("conversation.modeInfoRequest"), show: canAskInfo },
    { key: "supervisor_reply", label: t("conversation.modeReply"), show: canReply },
  ];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{t("conversation.title")}</CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => markRead.mutate()}
          disabled={markRead.isPending}
        >
          <CheckCheck className="size-4" aria-hidden />
          {t("conversation.markRead")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-3">
          {messages.length === 0 && (
            <li className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {t("conversation.empty")}
            </li>
          )}
          {messages.map((message) => {
            const kind = (message.msg_kind as Kind) ?? "message";
            const Icon = KIND_ICON[kind] ?? MessageSquare;
            const mine = message.author_id === session?.user.id;
            const parent = message.reply_to_id
              ? messages.find((m) => m.id === message.reply_to_id)
              : null;
            const attachments = byMessage.get(message.id) ?? [];
            return (
              <li
                key={message.id}
                className={cn(
                  "rounded-xl border p-3 text-sm",
                  kind === "info_request"
                    ? "border-warning/40 bg-warning/10"
                    : kind === "supervisor_reply"
                      ? "border-info/30 bg-info/5"
                      : kind === "reminder"
                        ? "border-primary/25 bg-primary/5"
                        : mine
                          ? "border-primary/20 bg-secondary/60"
                          : "border-border bg-card",
                )}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Icon className="size-3.5" aria-hidden />
                  <span className="font-semibold text-foreground">{nameOf(message.author_id)}</span>
                  {message.author_role && <span>· {t(`roles.${message.author_role}`)}</span>}
                  <span>· {t(`conversation.kind.${kind}`)}</span>
                  <span className="num">· {formatDateTime(message.created_at)}</span>
                  {message.visibility && message.visibility !== "shared" && (
                    <span className="rounded-full bg-warning/20 px-2 py-0.5 font-semibold text-warning-foreground">
                      {message.visibility === "internal"
                        ? t("conversation.internalBadge")
                        : t("conversation.requesterOnlyBadge")}
                    </span>
                  )}
                  {message.due_date && (
                    <span className="num text-warning-foreground">
                      · {t("conversation.due")} {message.due_date}
                    </span>
                  )}
                </div>
                {parent && (
                  <p className="mb-2 border-s-2 border-border ps-2 text-xs text-muted-foreground">
                    {parent.body.slice(0, 120)}
                  </p>
                )}
                <p className="whitespace-pre-wrap">{message.body}</p>
                {attachments.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {attachments.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => void openAttachment(a.storage_path)}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs hover:bg-secondary/70"
                        >
                          <FileText className="size-3" aria-hidden />
                          {a.file_name}
                          <span className="num text-muted-foreground">v{a.version}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("message");
                      setReplyTo(message);
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    {t("conversation.reply")}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="space-y-3 rounded-xl border border-border p-3">
          <div className="flex flex-wrap gap-2">
            {composerModes
              .filter((m) => m.show)
              .map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMode(m.key)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    mode === m.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary text-muted-foreground",
                  )}
                >
                  {m.label}
                </button>
              ))}
          </div>

          {replyTo && (
            <p className="flex items-center gap-2 rounded-lg bg-secondary p-2 text-xs text-muted-foreground">
              {t("conversation.replyingTo")}: {replyTo.body.slice(0, 80)}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setReplyTo(null)}
              >
                {t("common.cancel")}
              </button>
            </p>
          )}

          <Textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              mode === "info_request"
                ? t("conversation.infoPlaceholder")
                : t("conversation.placeholder")
            }
            aria-label={t("conversation.title")}
          />

          {canChooseVisibility && mode === "message" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("conversation.visibility")}:</span>
              {MESSAGE_VISIBILITIES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    visibility === v
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-secondary text-muted-foreground",
                  )}
                >
                  {visibilityLabels[v]}
                </button>
              ))}
            </div>
          )}

          {mode === "info_request" && (
            <div className="max-w-52 space-y-2">
              <Label htmlFor="info_due">{t("conversation.due")}</Label>
              <Input
                id="info_due"
                type="date"
                dir="ltr"
                className="num"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Input
              ref={fileInput}
              type="file"
              multiple
              accept={ACCEPT}
              className="max-w-72"
              aria-label={t("attachments.add")}
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && (
              <span className="num inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Paperclip className="size-3" aria-hidden />
                {files.length}
              </span>
            )}
            <Button
              type="button"
              className="gap-2"
              onClick={() => post.mutate()}
              disabled={post.isPending || !body.trim()}
            >
              <Send className="size-4 ltr:rotate-180" aria-hidden />
              {t("conversation.send")}
            </Button>
            <span className="text-xs text-muted-foreground">
              {locale === "ar" ? "PDF أو صور، بلا استبدال للملفات السابقة" : "PDF or images; never replaces earlier files"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

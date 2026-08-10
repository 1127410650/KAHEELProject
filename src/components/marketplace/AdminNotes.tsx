import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock } from "lucide-react";

import { useI18n } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import { adminErrorMessage } from "@/lib/mkt-platform";
import {
  addSubjectNote,
  loadSubjectNotes,
  type NoteSubject,
} from "@/lib/mkt-admin-detail";
import { EmptyState, Panel } from "@/components/marketplace/AdminDetail";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

/**
 * Internal administrative notes for any subject.
 *
 * Notes are append-only by design: the database exposes no update or delete
 * path, so a note that was written stays exactly as written, with its author
 * and timestamp. They are never shown to the account being discussed — reading
 * them requires a staff permission the server verifies on every call.
 */
export function AdminNotes({
  subjectType,
  subjectId,
  canRead,
  canWrite,
}: {
  subjectType: NoteSubject;
  subjectId: string;
  canRead: boolean;
  canWrite: boolean;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const notes = useQuery({
    queryKey: ["mkt", "admin", "notes", subjectType, subjectId],
    enabled: canRead,
    queryFn: () => loadSubjectNotes(subjectType, subjectId),
  });

  const save = useMutation({
    mutationFn: () => addSubjectNote(subjectType, subjectId, body.trim()),
    onSuccess: async () => {
      setBody("");
      toast.success(t("admin.noteSaved"));
      await queryClient.invalidateQueries({
        queryKey: ["mkt", "admin", "notes", subjectType, subjectId],
      });
    },
    onError: (error) => toast.error(adminErrorMessage(error, t("admin.actionFailed"))),
  });

  if (!canRead) {
    return (
      <Panel title={t("admin.detail.notes")}>
        <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" aria-hidden />
          {t("admin.detail.notesDenied")}
        </p>
      </Panel>
    );
  }

  const rows = notes.data ?? [];

  return (
    <Panel title={t("admin.detail.notes")}>
      <p className="text-desc text-muted-foreground">{t("admin.detail.notesHint")}</p>

      {canWrite && (
        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (body.trim().length < 3) return;
            save.mutate();
          }}
        >
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            placeholder={t("admin.detail.notePlaceholder")}
            aria-label={t("admin.detail.notes")}
          />
          <div className="mt-2 flex justify-end">
            <Button
              type="submit"
              size="sm"
              className="min-h-11"
              disabled={save.isPending || body.trim().length < 3}
            >
              {t("admin.detail.addNote")}
            </Button>
          </div>
        </form>
      )}

      <div className="mt-3 space-y-2">
        {notes.isLoading ? (
          <Skeleton className="h-20 w-full rounded-lg" />
        ) : rows.length === 0 ? (
          <EmptyState label={t("admin.detail.noNotes")} />
        ) : (
          rows.map((note) => (
            <article key={note.id} className="rounded-lg border border-border bg-background p-3">
              <p className="whitespace-pre-wrap text-sm text-foreground">{note.body}</p>
              <p className="mt-[var(--sp-2)] text-desc tabular-nums text-muted-foreground">
                {note.author_name || t("admin.detail.unknownActor")} · {formatDateTime(note.created_at)}
              </p>
            </article>
          ))
        )}
      </div>
    </Panel>
  );
}

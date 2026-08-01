import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { downloadAttachment } from "@/lib/attachments";

export const Route = createFileRoute("/_authenticated/my-documents")({
  head: () => ({
    meta: [
      { title: "مستنداتي — تحقّق | My documents — Tahqaq" },
      {
        name: "description",
        content: "المستندات التي رفعتها بنفسك داخل الحساب الحالي، بروابط تحميل مؤقتة قصيرة المدة.",
      },
      { property: "og:title", content: "مستنداتي — تحقّق" },
      { property: "og:description", content: "Documents you uploaded on Tahqaq." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyDocumentsPage,
});

function MyDocumentsPage() {
  const { t } = useI18n();
  const { session } = useSession();
  const userId = session?.user.id ?? null;

  const docs = useQuery({
    queryKey: ["my-documents", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attachments")
        .select("id, file_name, kind, storage_path, created_at")
        .eq("created_by", userId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = docs.data ?? [];

  return (
    <div className="space-y-3 md:space-y-5">
      <PageHeader title={t("me.myDocuments")} description={t("docs.mySubtitle")} />

      {docs.isLoading ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
      ) : rows.length === 0 ? (
        <p className="surface p-4 text-[12px] text-muted-foreground sm:text-sm">
          {t("docs.myEmpty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="surface flex min-w-0 items-center gap-2.5 p-2.5 sm:p-3.5">
              <FileText className="size-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="wrap-anywhere text-[12px] font-semibold leading-snug sm:text-sm">
                  {row.file_name}
                </p>
                <p className="num text-[11px] leading-snug text-muted-foreground">
                  {formatDate(row.created_at)}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5"
                onClick={() => void downloadAttachment(row.storage_path, row.file_name)}
              >
                <Download className="size-4" aria-hidden />
                <span className="hidden text-xs sm:inline">{t("docs.download")}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

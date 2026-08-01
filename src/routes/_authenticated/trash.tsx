import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { PageHeader } from "@/components/AppLayout";
import { MobileCards, MobileEmpty, RecordCard } from "@/components/RecordCard";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDateTime, pickName } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/trash")({
  head: () => ({
    meta: [
      { title: "المحذوفات — تحقّق | Trash — Tahqaq" },
      { name: "description", content: "السجلات المحذوفة مؤقتًا مع سبب الحذف وإمكانية الاستعادة." },
      { property: "og:title", content: "المحذوفات — تحقّق" },
      { property: "og:description", content: "Soft-deleted records with reasons and restore." },
    ],
  }),
  component: TrashPage,
});

type Entity = "supervisors" | "projects" | "custody_transactions";

function TrashPage() {
  const { t, locale } = useI18n();
  const { isAccountant, session } = useSession();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Entity>("supervisors");

  const { data: rows = [] } = useQuery({
    queryKey: ["trash", tab],
    queryFn: async () => {
      const columns =
        tab === "custody_transactions"
          ? "id, serial_no, amount, deleted_at, delete_reason"
          : "id, name_ar, name_en, deleted_at, delete_reason";
      const { data, error } = await supabase
        .from(tab)
        .select(columns)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        name_ar?: string;
        name_en?: string;
        serial_no?: number;
        deleted_at: string;
        delete_reason: string | null;
      }>;
    },
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(tab)
        .update({ deleted_at: null, delete_reason: null })
        .eq("id", id);
      if (error) throw error;
      await logAudit({
        actorId: session?.user.id,
        entityType: tab,
        entityId: id,
        action: "restore",
      });
    },
    onSuccess: () => {
      toast.success(t("trash.restored"));
      void queryClient.invalidateQueries({ queryKey: ["trash"] });
      void queryClient.invalidateQueries({ queryKey: ["supervisors"] });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["custody"] });
    },
    onError: () => toast.error(t("errors.saveFailed")),
  });

  return (
    <>
      <PageHeader title={t("trash.title")} description={t("trash.description")} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Entity)}>
        <TabsList>
          <TabsTrigger value="supervisors">{t("nav.supervisors")}</TabsTrigger>
          <TabsTrigger value="projects">{t("nav.projects")}</TabsTrigger>
          <TabsTrigger value="custody_transactions">{t("nav.custody")}</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <MobileCards>
            {rows.length === 0 && <MobileEmpty>{t("trash.empty")}</MobileEmpty>}
            {rows.map((row) => (
              <RecordCard
                key={row.id}
                title={
                  row.serial_no != null
                    ? `#${row.serial_no}`
                    : pickName(locale, row.name_ar, row.name_en)
                }
                fields={[
                  {
                    label: t("trash.deletedAt"),
                    value: formatDateTime(row.deleted_at),
                    num: true,
                    wide: true,
                  },
                  {
                    label: t("trash.deleteReason"),
                    value: row.delete_reason ?? "—",
                    wide: true,
                  },
                ]}
                actions={
                  isAccountant ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 px-2 text-xs"
                      onClick={() => restore.mutate(row.id)}
                    >
                      <RotateCcw className="size-3.5" aria-hidden />
                      {t("common.restore")}
                    </Button>
                  ) : null
                }
              />
            ))}
          </MobileCards>

          <div className="surface hidden overflow-hidden sm:block">
            <div className="overflow-x-auto">

              <table className="w-full text-sm">
                <thead className="bg-secondary/60">
                  <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 text-start font-semibold">{t("common.details")}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t("trash.deletedAt")}</th>
                    <th className="px-4 py-3 text-start font-semibold">
                      {t("trash.deleteReason")}
                    </th>
                    <th className="px-4 py-3 text-start font-semibold">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                        {t("trash.empty")}
                      </td>
                    </tr>
                  )}
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-secondary/40">
                      <td className="px-4 py-3 font-medium">
                        {row.serial_no != null
                          ? `#${row.serial_no}`
                          : pickName(locale, row.name_ar, row.name_en)}
                      </td>
                      <td className="num px-4 py-3">{formatDateTime(row.deleted_at)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.delete_reason ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {isAccountant && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2"
                            onClick={() => restore.mutate(row.id)}
                          >
                            <RotateCcw className="size-4" aria-hidden />
                            {t("common.restore")}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

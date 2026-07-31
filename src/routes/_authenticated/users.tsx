import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { PageHeader } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "المستخدمون والصلاحيات — تحقّق | Users — Tahqaq" },
      { name: "description", content: "إدارة أدوار المستخدمين وصلاحياتهم داخل نظام تحقّق." },
      { property: "og:title", content: "المستخدمون والصلاحيات — تحقّق" },
      { property: "og:description", content: "Manage user roles and access in Tahqaq." },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const { t } = useI18n();
  const { isAccountant, session } = useSession();
  const queryClient = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["users"],
    enabled: isAccountant,
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (error) throw error;
      return (profiles ?? []).map((p) => ({
        ...p,
        role: (roles ?? []).find((r) => r.user_id === p.user_id)?.role ?? null,
      }));
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
      await logAudit({
        actorId: session?.user.id,
        entityType: "user_role",
        entityId: userId,
        action: "update",
        newValue: { role },
      });
    },
    onSuccess: () => {
      toast.success(t("users.roleUpdated"));
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: () => toast.error(t("errors.saveFailed")),
  });

  if (!isAccountant) {
    return (
      <>
        <PageHeader title={t("users.title")} />
        <div className="surface p-10 text-center text-muted-foreground">
          {t("users.restricted")}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("users.title")} description={t("users.description")} />

      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 text-start font-semibold">{t("users.fullName")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("users.email")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("users.role")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.status")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("common.createdAt")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    {t("users.empty")}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-secondary/40">
                  <td className="px-4 py-3 font-medium">{row.full_name}</td>
                  <td className="num px-4 py-3 text-muted-foreground" dir="ltr">
                    {row.email ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={row.role ?? "employee"}
                      onValueChange={(v) =>
                        setRole.mutate({ userId: row.user_id, role: v as AppRole })
                      }
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="accountant">{t("roles.accountant")}</SelectItem>
                        <SelectItem value="employee">{t("roles.employee")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.is_active ? "active" : "inactive"} />
                  </td>
                  <td className="num px-4 py-3">{formatDate(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

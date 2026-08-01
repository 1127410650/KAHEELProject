import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MailOpen } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/invitations")({
  head: () => ({
    meta: [
      { title: "الدعوات الواردة — تحقّق | My invitations — Tahqaq" },
      {
        name: "description",
        content: "الدعوات المعلّقة الموجّهة إلى بريدك للانضمام إلى مساحات عمل في تحقّق.",
      },
      { property: "og:title", content: "الدعوات الواردة — تحقّق" },
      { property: "og:description", content: "Pending workspace invitations on Tahqaq." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitationsPage,
});

interface Invitation {
  id: string;
  tenant_id: string;
  tenant_name_ar: string | null;
  tenant_name_en: string | null;
  invited_role: string | null;
  invitation_type: string | null;
  expires_at: string | null;
}

export function useMyInvitations() {
  return useQuery({
    queryKey: ["my-invitations"],
    queryFn: async (): Promise<Invitation[]> => {
      const { data, error } = await supabase.rpc("my_invitations");
      if (error) throw error;
      return (data ?? []) as Invitation[];
    },
  });
}

function InvitationsPage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const invitations = useMyInvitations();

  const accept = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("invitation_accept_by_id", { _id: id });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(t("invite.accepted"));
      await queryClient.invalidateQueries();
      window.location.replace("/select-account");
    },
    onError: (error: { message?: string }) => {
      const message = error?.message ?? "";
      const key = message.includes("EMAIL_MISMATCH")
        ? "invite.emailMismatch"
        : message.includes("INVITATION_EXPIRED")
          ? "invite.expired"
          : message.includes("INVITATION_REVOKED")
            ? "invite.revoked"
            : message.includes("INVITATION_USED")
              ? "invite.used"
              : message.includes("RATE_LIMITED")
                ? "invite.rateLimited"
                : "invite.invalid";
      toast.error(t(key));
      void invitations.refetch();
    },
  });

  const rows = invitations.data ?? [];

  return (
    <div className="space-y-3 md:space-y-5">
      <PageHeader title={t("me.invitations")} description={t("invites.subtitle")} />

      {invitations.isLoading ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
      ) : rows.length === 0 ? (
        <p className="surface p-4 text-[12px] text-muted-foreground sm:text-sm">
          {t("me.noInvites")}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="surface flex min-w-0 items-start gap-2.5 p-2.5 sm:p-4">
              <MailOpen className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="wrap-anywhere text-[13px] font-bold leading-snug sm:text-sm">
                  {(locale === "en" ? row.tenant_name_en || row.tenant_name_ar : row.tenant_name_ar) ??
                    "—"}
                </p>
                <p className="wrap-anywhere text-[11px] leading-snug text-muted-foreground">
                  {t(`team.roles.${row.invited_role ?? "viewer"}`)} — {t("invite.expiresAt")}{" "}
                  <span className="num">{formatDate(row.expires_at)}</span>
                </p>
              </div>
              <Button
                size="sm"
                className="shrink-0"
                disabled={accept.isPending}
                onClick={() => accept.mutate(row.id)}
              >
                {accept.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {t("invite.accept")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

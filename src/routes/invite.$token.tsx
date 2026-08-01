import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, MailWarning, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "دعوة للانضمام — تحقّق | Invitation — Tahqaq" },
      {
        name: "description",
        content: "قبول دعوة الانضمام إلى مساحة عمل في نظام تحقّق بدور وصلاحيات محددة.",
      },
      { property: "og:title", content: "دعوة للانضمام — تحقّق" },
      { property: "og:description", content: "Accept your Tahqaq workspace invitation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitePage,
});

interface Preview {
  state: string;
  tenant_name_ar: string | null;
  tenant_name_en: string | null;
  invited_role: string | null;
  invitation_type: string | null;
  masked_email: string | null;
  expires_at: string | null;
}

function InvitePage() {
  const { token } = useParams({ from: "/invite/$token" });
  const { t, locale, dir } = useI18n();
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [accepted, setAccepted] = useState<{ multi: boolean } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  const preview = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: async (): Promise<Preview> => {
      const { data, error } = await supabase.rpc("invitation_preview", { _token: token });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as Preview | undefined;
      return row ?? { ...({} as Preview), state: "invalid" };
    },
    retry: false,
  });

  const accept = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("invitation_accept", { _token: token });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as
        | { tenant_id: string; activated: boolean; memberships: number }
        | undefined;
      return row;
    },
    onSuccess: (row) => {
      setAccepted({ multi: (row?.memberships ?? 1) > 1 });
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
      void preview.refetch();
    },
  });

  const row = preview.data;
  const workspace =
    (locale === "en" ? row?.tenant_name_en || row?.tenant_name_ar : row?.tenant_name_ar) ?? "—";

  return (
    <div dir={dir} className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <span className="text-base font-bold text-foreground">{t("app.name")}</span>
        </div>

        <div className="surface p-5">
          {preview.isLoading || signedIn === null ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
          ) : accepted ? (
            <>
              <CheckCircle2 className="size-6 text-primary" aria-hidden />
              <h1 className="mt-3 text-lg font-bold text-foreground">{t("invite.accepted")}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {accepted.multi ? t("invite.switchNote") : t("invite.acceptedBody")}
              </p>
              <Button className="mt-4 w-full" onClick={() => navigate({ to: "/dashboard" })}>
                {t("invite.goWorkspace")}
              </Button>
            </>
          ) : row?.state !== "valid" ? (
            <>
              <MailWarning className="size-6 text-destructive" aria-hidden />
              <h1 className="mt-3 text-lg font-bold text-foreground">
                {t(
                  row?.state === "expired"
                    ? "invite.expired"
                    : row?.state === "revoked"
                      ? "invite.revoked"
                      : row?.state === "accepted"
                        ? "invite.used"
                        : "invite.invalid",
                )}
              </h1>
              <Button asChild variant="outline" className="mt-4 w-full">
                <Link to="/auth">{t("signup.signIn")}</Link>
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-lg font-bold text-foreground">{t("invite.title")}</h1>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">{t("invite.workspace")}</dt>
                  <dd className="wrap-anywhere font-semibold text-foreground">{workspace}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">{t("invite.role")}</dt>
                  <dd className="font-semibold text-foreground">
                    {t(`team.roles.${row?.invited_role ?? "viewer"}`)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">{t("invite.email")}</dt>
                  <dd className="num wrap-anywhere text-foreground" dir="ltr">
                    {row?.masked_email}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">{t("invite.expiresAt")}</dt>
                  <dd className="num text-foreground">{formatDate(row?.expires_at ?? null)}</dd>
                </div>
              </dl>

              {signedIn ? (
                <Button
                  className="mt-5 w-full"
                  disabled={accept.isPending}
                  onClick={() => accept.mutate()}
                >
                  {accept.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  {accept.isPending ? t("invite.accepting") : t("invite.accept")}
                </Button>
              ) : (
                <div className="mt-5 space-y-2">
                  <p className="text-xs text-muted-foreground">{t("invite.signInFirst")}</p>
                  <Button asChild className="w-full">
                    <Link to="/auth" search={{ next: `/invite/${token}` } as never}>
                      {t("signup.signIn")}
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/register" search={{ invite: token } as never}>
                      {t("signup.createAccount")}
                    </Link>
                  </Button>
                  <p className="text-xs text-muted-foreground">{t("invite.createAccountFirst")}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Loader2, LogOut, Plus, User } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { useActiveAccount, type MktAccount } from "@/lib/mkt-account";
import { VerifiedBadge } from "@/components/marketplace/ListingCard";
import { BusinessQuickCreate } from "@/components/marketplace/BusinessQuickCreate";
import { Button } from "@/components/ui/button";

interface ChooseSearch {
  next?: string | undefined;
}

export const Route = createFileRoute("/choose-account")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): ChooseSearch => {
    const raw = search["next"];
    return typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")
      ? { next: raw }
      : {};
  },
  head: () => ({
    meta: [
      { title: "اختر الحساب — سوق تحقّق" },
      {
        name: "description",
        content:
          "اختر الحساب الذي تريد الدخول إليه في سوق تحقّق: حسابك الشخصي أو إحدى منشآتك، وتعمل المنصة تحت هذا الحساب فقط.",
      },
      { property: "og:title", content: "اختر الحساب — سوق تحقّق" },
      { property: "og:description", content: "الدخول إلى السوق تحت حساب واحد بعزل كامل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChooseAccountPage,
});

function AccountAvatar({ account }: { account: MktAccount }) {
  const Icon = account.kind === "business" ? Building2 : User;
  if (account.avatar_url) {
    return (
      <img
        src={account.avatar_url}
        alt=""
        className="size-11 shrink-0 rounded-full object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

function ChooseAccountPage() {
  const { t } = useI18n();
  const { session, loading: sessionLoading } = useSession();
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const { accounts, loading, select } = useActiveAccount();
  const [pending, setPending] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (!sessionLoading && !session) {
      void navigate({ to: "/auth", replace: true });
    }
  }, [sessionLoading, session, navigate]);

  async function enter(account: MktAccount) {
    setPending(account.account_key);
    const ok = await select(account.account_key);
    setPending(null);
    if (!ok) {
      toast.error(t("market.entry.revoked"));
      return;
    }
    void navigate({ to: next ?? "/marketplace", replace: true });
  }

  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto w-full max-w-xl px-3 py-6 sm:py-10">
      <div className="mb-5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="wrap-anywhere text-lg font-bold leading-tight sm:text-2xl">
            {t("market.entry.title")}
          </h1>
          <p className="wrap-anywhere mt-1 text-xs leading-snug text-muted-foreground sm:text-sm">
            {t("market.entry.subtitle")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void signOut()} className="shrink-0 gap-1.5">
          <LogOut className="size-4" aria-hidden />
          <span className="hidden sm:inline">{t("nav.signOut")}</span>
        </Button>
      </div>

      {loading ? (
        <div className="grid place-items-center rounded-xl border border-border bg-card p-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden />
        </div>
      ) : (
        <ul className="space-y-2.5">
          {accounts.map((account) => (
            <li key={account.account_key}>
              <button
                type="button"
                disabled={!!pending}
                onClick={() => void enter(account)}
                className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-3 text-start hover:border-primary/50 disabled:opacity-60"
              >
                <AccountAvatar account={account} />
                <span className="min-w-0 flex-1">
                  <span className="wrap-anywhere block text-sm font-semibold leading-snug text-foreground">
                    {account.name || t("market.account.fallbackName")}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] leading-snug text-muted-foreground">
                    {t(`market.entry.kind.${account.kind}`)}
                    <VerifiedBadge status={account.verification_status} size="xs" />
                  </span>
                </span>
                {pending === account.account_key ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
                ) : (
                  <span className="shrink-0 text-xs font-medium text-primary">
                    {t("market.entry.enter")}
                  </span>
                )}
              </button>
            </li>
          ))}

          <li>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-input p-3 text-start text-sm text-muted-foreground hover:border-primary/40"
            >
              <Plus className="size-4 shrink-0" aria-hidden />
              {t("market.biz.addBusiness")}
            </button>
          </li>
        </ul>
      )}

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        <Link to="/" className="underline">
          {t("market.entry.browsePublic")}
        </Link>
      </p>

      <BusinessQuickCreate
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => {
          setAddOpen(false);
          toast.success(t("market.entry.businessCreated"));
        }}
      />
    </div>
  );
}

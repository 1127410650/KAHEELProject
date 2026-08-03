import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, LogOut, ShieldCheck, Search } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { markManualSignOut } from "@/lib/auth-session";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { useAccounts, useEnterAccount, sortAccounts, type Account } from "@/hooks/use-accounts";
import { LanguageToggle } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/select-account")({
  head: () => ({
    meta: [
      { title: "اختيار الحساب — تحقّق | Select account — Tahqaq" },
      {
        name: "description",
        content: "اختر الحساب الذي تريد الدخول إليه: حسابك الشخصي أو أحد الكيانات التي تملك فيها عضوية فعالة.",
      },
      { property: "og:title", content: "اختيار الحساب — تحقّق" },
      { property: "og:description", content: "Pick the account you want to open." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SelectAccountPage,
});

function initial(name: string) {
  return name.trim().charAt(0) || "?";
}

function SelectAccountPage() {
  const { t, locale } = useI18n();
  const { profile } = useSession();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const { data: accounts = [], isLoading } = useAccounts();
  const enterAccount = useEnterAccount();

  const sorted = useMemo(() => sortAccounts(accounts), [accounts]);
  const label = (a: Account) =>
    (locale === "en" ? a.name_en || a.name_ar : a.name_ar) ||
    t("account.personalName");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((a) => label(a).toLowerCase().includes(q));
  }, [sorted, query, locale]);

  function enter(a: Account) {
    setPending(a.tenant_id);
    enterAccount.mutate(a.tenant_id, {
      onError: () => {
        setPending(null);
        toast.error(t("account.enterFailed"));
      },
    });
  }

  // A single allowed account opens directly, unless the user asked to always pick.
  useEffect(() => {
    if (isLoading || pending) return;
    if (sorted.length === 1 && !profile?.always_select_account) enter(sorted[0]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, sorted.length, profile?.always_select_account]);

  async function signOut() {
    markManualSignOut();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-6 sm:py-10">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <ShieldCheck className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="wrap-anywhere text-lg font-bold leading-tight sm:text-2xl">
            {t("account.title")}
          </h1>
          <p className="wrap-anywhere mt-0.5 text-[11px] leading-snug text-muted-foreground sm:text-sm">
            {t("account.subtitle")}
          </p>
        </div>
        <LanguageToggle compact />
        <Button variant="outline" size="sm" onClick={signOut} className="shrink-0 gap-1.5">
          <LogOut className="size-4" aria-hidden />
          <span className="hidden sm:inline">{t("nav.signOut")}</span>
        </Button>
      </div>

      {sorted.length > 5 && (
        <div className="relative mb-3">
          <Search
            className="pointer-events-none absolute inset-inline-start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("account.search")}
            className="ps-9"
            aria-label={t("account.search")}
          />
        </div>
      )}

      {isLoading ? (
        <div className="surface grid place-items-center p-8 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden />
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface p-6 text-center text-sm text-muted-foreground">
          {t("account.empty")}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((a) => (
            <li key={a.tenant_id}>
              <div className="surface flex min-w-0 items-center gap-2.5 p-2.5 sm:gap-3 sm:p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-sm font-bold text-foreground">
                  {initial(label(a))}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="wrap-anywhere text-[13px] font-semibold leading-snug sm:text-sm">
                    {label(a)}
                  </p>
                  <p className="wrap-anywhere text-[11px] leading-snug text-muted-foreground">
                    {t(`account.types.${a.tenant_type}`)} — {t(`team.roles.${a.role}`)}
                    {a.masked_ref ? ` · ${a.masked_ref}` : ""}
                  </p>
                  <p className="text-[10.5px] leading-snug text-muted-foreground">
                    {t("account.membershipActive")}
                    {a.last_seen_at ? ` · ${t("account.lastSeen")}: ${formatDate(a.last_seen_at)}` : ""}
                  </p>

                </div>
                <Button
                  size="sm"
                  className="shrink-0"
                  disabled={!!pending}
                  onClick={() => enter(a)}
                >
                  {pending === a.tenant_id ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    t("account.enter")
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

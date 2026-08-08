import { useState } from "react";
import { Loader2, ShieldCheck, Store, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { markManualSignOut } from "@/lib/auth-session";
import { useSession } from "@/lib/session";

import type { Copy } from "./copy";
import { MARKET_AUTH_URL, MARKET_URL, REGISTER_URL } from "./copy";
import { Card } from "./ui";

export function ProviderMarketAccess({
  copy,
  locale,
  loading = false,
}: {
  copy: Copy;
  locale: "ar" | "en";
  loading?: boolean;
}) {
  const isAr = locale === "ar";
  const session = useSession();
  const [leavingFor, setLeavingFor] = useState<"signin" | "register" | null>(null);

  async function continueInMarket(target: string, action: "signin" | "register") {
    if (session.status !== "authenticated") {
      window.location.assign(target);
      return;
    }

    setLeavingFor(action);
    try {
      // A phone-only appointment session has no Market profile. Clear only this
      // browser session before handing registration back to KAHEEL Market, so
      // the Market auth/register routes do not immediately redirect it back.
      markManualSignOut();
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      window.location.assign(target);
    } catch {
      toast.error(
        isAr
          ? "تعذر الانتقال إلى تسجيل سوق كَحيل. حاول مرة أخرى."
          : "Could not continue to KAHEEL Market registration. Try again.",
      );
      setLeavingFor(null);
    }
  }

  if (loading) {
    return (
      <section className="mx-auto grid min-h-[50dvh] max-w-xl place-items-center px-4 py-16">
        <Loader2
          className="size-7 animate-spin text-primary"
          aria-label={isAr ? "جاري التحميل" : "Loading"}
        />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-14 sm:py-20">
      <Card className="p-6 text-center sm:p-9">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
          <UsersRound className="size-7" />
        </span>
        <h1 className="mt-5 text-2xl font-black sm:text-3xl">{copy.providerEmpty}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
          {copy.providerEmptyBody}
        </p>
        {session.status === "authenticated" ? (
          <p className="mx-auto mt-3 max-w-xl rounded-2xl bg-secondary/70 p-3 text-xs leading-6 text-muted-foreground">
            {isAr
              ? "حساب المواعيد مخصص للحجز فقط. عند المتابعة سننهي جلسة المواعيد في هذا المتصفح ثم نفتح تسجيل سوق كَحيل لمقدمي الخدمة."
              : "The appointment account is for booking only. Continuing will close this browser session and open KAHEEL Market provider registration."}
          </p>
        ) : null}

        <div className="mx-auto mt-6 flex max-w-md flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="min-h-11 flex-1"
            disabled={leavingFor !== null}
            onClick={() => void continueInMarket(MARKET_AUTH_URL, "signin")}
          >
            {leavingFor === "signin" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            {isAr ? "دخول حساب كَحيل" : "Sign in with KAHEEL"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 flex-1"
            disabled={leavingFor !== null}
            onClick={() => void continueInMarket(REGISTER_URL, "register")}
          >
            {leavingFor === "register" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UsersRound className="size-4" />
            )}
            {isAr ? "التسجيل كمقدم خدمة" : "Provider registration"}
          </Button>
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <a
            href={MARKET_URL}
            className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary"
          >
            <Store className="size-4" />
            {isAr ? "اذهب إلى سوق كَحيل" : "Go to KAHEEL Market"}
          </a>
        </div>
      </Card>
    </section>
  );
}

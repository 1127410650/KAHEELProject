import { Loader2, ShieldCheck, Store, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";

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

  if (loading) {
    return (
      <section className="mx-auto grid min-h-[50dvh] max-w-xl place-items-center px-4 py-16">
        <Loader2 className="size-7 animate-spin text-primary" aria-label={isAr ? "جاري التحميل" : "Loading"} />
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

        <div className="mx-auto mt-6 flex max-w-md flex-col gap-2 sm:flex-row">
          <Button asChild className="min-h-11 flex-1">
            <a href={MARKET_AUTH_URL}>
              <ShieldCheck className="size-4" />
              {isAr ? "دخول حساب كَحيل" : "Sign in with KAHEEL"}
            </a>
          </Button>
          <Button asChild variant="outline" className="min-h-11 flex-1">
            <a href={REGISTER_URL}>
              <UsersRound className="size-4" />
              {isAr ? "التسجيل كمقدم خدمة" : "Provider registration"}
            </a>
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

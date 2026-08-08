import { useI18n } from "@/i18n";

/**
 * Shared body for the public policy/help pages. Content comes from i18n so both
 * locales stay in sync; the page never links into the admin console or the
 * internal system.
 */
export function MarketStaticPage({
  pageKey,
  email,
}: {
  pageKey: "about" | "help" | "terms" | "privacy" | "contact";
  email?: string;
}) {
  const { t } = useI18n();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-6">
      <header className="market-page-intro">
        <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
          {t(`market.pages.${pageKey}.title`)}
        </h1>
      </header>
      <MarketStaticSection pageKey={pageKey} hideTitle {...(email ? { email } : {})} />
    </div>
  );
}

export function MarketStaticSection({
  pageKey,
  email,
  hideTitle = false,
}: {
  pageKey: "about" | "help" | "terms" | "privacy" | "contact";
  email?: string;
  hideTitle?: boolean;
}) {
  const { t } = useI18n();
  return (
    <article id={pageKey} className="market-section mt-4 scroll-mt-24 p-5 sm:p-7">
      {!hideTitle ? (
        <h2 className="text-lg font-black text-foreground">{t(`market.pages.${pageKey}.title`)}</h2>
      ) : null}
      <p className={`${hideTitle ? "" : "mt-3 "}text-sm leading-8 text-muted-foreground`}>
        {t(`market.pages.${pageKey}.body`)}
      </p>
      {email ? (
        <a
          href={`mailto:${email}`}
          dir="ltr"
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-market-blue-soft px-4 text-sm font-bold text-primary transition hover:bg-primary hover:text-primary-foreground"
        >
          {email}
        </a>
      ) : null}
    </article>
  );
}

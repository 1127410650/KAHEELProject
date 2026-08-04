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
    <div className="mx-auto w-full max-w-3xl px-4 pb-8 pt-6">
      <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        {t(`market.pages.${pageKey}.title`)}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {t(`market.pages.${pageKey}.body`)}
      </p>
      {email ? (
        <a
          href={`mailto:${email}`}
          dir="ltr"
          className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
        >
          {email}
        </a>
      ) : null}
    </div>
  );
}

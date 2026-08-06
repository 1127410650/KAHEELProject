import { createFileRoute, Link } from "@tanstack/react-router";
import { QrCode, ShieldCheck, LogIn } from "lucide-react";

import { useI18n } from "@/i18n";
import { InvoiceVerifier } from "@/components/InvoiceVerifier";
import { stashVerification } from "@/lib/invoice-save";

export const Route = createFileRoute("/verify-invoice")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "التحقق من الفاتورة الضريبية — كَحيل | Tax Invoice Verification" },
      {
        name: "description",
        content:
          "افحص رمز QR للفاتورة الضريبية السعودية محليًا داخل متصفحك: اسم البائع، الرقم الضريبي، التاريخ، الإجمالي والضريبة، والمنتجات والأسعار.",
      },
      { property: "og:title", content: "التحقق من الفاتورة الضريبية — كَحيل" },
      {
        property: "og:description",
        content: "Scan and verify a Saudi tax invoice QR code locally in your browser — free.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VerifyInvoicePage,
});

function VerifyInvoicePage() {
  const { t, locale, setLocale, dir } = useI18n();

  // Small, self-dismissing note instead of a permanent full-width banner.


  return (
    <div dir={dir} className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" aria-hidden />
            </span>
            <span className="truncate text-sm font-bold text-foreground">{t("app.name")}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary p-1">
              <button
                type="button"
                onClick={() => setLocale("ar")}
                className={
                  locale === "ar"
                    ? "rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
                    : "rounded-full px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                }
              >
                ع
              </button>
              <button
                type="button"
                onClick={() => setLocale("en")}
                className={
                  locale === "en"
                    ? "rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
                    : "rounded-full px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                }
              >
                EN
              </button>
            </div>
            <Link
              to="/auth"
              className="inline-flex items-center gap-1 rounded-md border border-input px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
            >
              <LogIn className="size-3.5" aria-hidden />
              {t("auth.signIn")}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-3 py-3 sm:px-4 sm:py-6">
        <div className="mb-2.5 flex items-start gap-2 sm:mb-5 sm:gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-secondary text-foreground sm:size-10">
            <QrCode className="size-4 sm:size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-[18px] leading-tight font-bold text-foreground sm:text-xl">
              {t("verify.title")}
            </h1>
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground sm:text-xs">
              {t("verify.publicIntro")}
            </p>
          </div>
        </div>

        <InvoiceVerifier
          onResult={stashVerification}
          footer={
            <div className="flex flex-col items-start gap-2 px-1">
                              <p className="rounded-md bg-secondary px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground">
                  {t("verify.publicSaveHint")}
                </p>
              <Link
                to="/auth"
                search={{ next: "/invoices/verified/new" }}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
              >
                <LogIn className="size-3.5" aria-hidden />
                {t("verify.signInToSave")}
              </Link>
            </div>
          }
        />
      </main>
    </div>
  );
}

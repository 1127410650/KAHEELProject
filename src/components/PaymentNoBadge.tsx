import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

export function PaymentNoBadge({
  paymentNo,
  className,
  withLabel = true,
}: {
  paymentNo: string | null | undefined;
  className?: string;
  withLabel?: boolean;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  if (!paymentNo) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning-foreground",
        className,
      )}
    >
      {withLabel && <span>{t("requests.paymentNo")}:</span>}
      <span className="num" dir="ltr">
        {paymentNo}
      </span>
      <button
        type="button"
        aria-label={t("requests.copyPaymentNo")}
        title={t("requests.copyPaymentNo")}
        className="opacity-70 transition hover:opacity-100"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void navigator.clipboard?.writeText(paymentNo).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      </button>
    </span>
  );
}

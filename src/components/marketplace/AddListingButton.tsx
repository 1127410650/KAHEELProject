import { Plus } from "lucide-react";

import { useI18n } from "@/i18n";

type Props = {
  href: string;
  className?: string;
};

/**
 * زر «إنشاء إعلان» — دائرة بيضاء بعلامة زائد بلون الهوية البنفسجي، مع نبضة
 * هادئة بلون الهوية. يُرسم فورًا مع أول رسم للصفحة: بلا تحميل متأخّر، وبلا أي
 * حركة ظهور أو حساب عرض مرتبط بتقدّم التمرير (`--p`)، فلا يظهر فارغًا أبدًا.
 * هدف اللمس 44px، والنبضة تتوقف مع تفضيل تقليل الحركة.
 */
export function AddListingButton({ href, className }: Props) {
  const { t } = useI18n();
  const label = t("market.addListing");

  return (
    <a
      href={href}
      title={label}
      aria-label={label}
      className={[
        "k-cta-pulse relative grid size-11 shrink-0 place-items-center rounded-full",
        "bg-[var(--kt-cta-bg)] text-[var(--kt-cta-fg)] shadow-md outline-none",
        "focus-visible:ring-2 focus-visible:ring-card",
        className ?? "",
      ].join(" ")}
    >
      <Plus className="relative z-[1] size-5" strokeWidth={2.5} aria-hidden />
    </a>
  );
}

export default AddListingButton;

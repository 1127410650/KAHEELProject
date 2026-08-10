import { Plus } from "lucide-react";

import { useI18n } from "@/i18n";

type Props = {
  href: string;
  className?: string;
};

/**
 * زر «إنشاء إعلان» الذهبي — كبسولة ممتلئة تُرسم فورًا مع أول رسم للصفحة:
 * بلا تحميل متأخّر، وبلا أي حركة ظهور أو حساب عرض مرتبط بتقدّم التمرير
 * (`--p`)، فلا يمكن أن يظهر فارغًا أو مقصوصًا في أي لحظة. الأيقونة والنص
 * موجودان دائمًا، والانكماش يحدث للصف بأكمله لا للزر.
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
        "inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-full px-4",
        "bg-gradient-to-l from-[#F5B301] to-[#FFCE3D] text-[#1B1B1F]",
        "text-desc font-extrabold leading-none shadow-sm outline-none",
        "focus-visible:ring-2 focus-visible:ring-white",
        className ?? "",
      ].join(" ")}
    >
      <Plus className="size-4 shrink-0" strokeWidth={3} aria-hidden />
      <span className="whitespace-nowrap">{label}</span>
    </a>
  );
}

export default AddListingButton;

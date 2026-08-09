import { Plus } from "lucide-react";

import { useI18n } from "@/i18n";

type Props = {
  href: string;
  /** كبسولة بنص «إعلان +» أو زر دائري بأيقونة فقط على المقاسات الضيقة. */
  className?: string;
};

/**
 * زر «إنشاء إعلان» الذهبي — يعيش في الهيدر بجانب الجرس.
 * الحركة على transform/opacity فقط، وتتوقف تمامًا مع prefers-reduced-motion.
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
        "k-add-cta group relative grid h-10 min-w-10 shrink-0 place-items-center gap-1 rounded-full",
        "bg-[linear-gradient(140deg,#ffe6a3_0%,#f9c22e_46%,#e08c0b_100%)] text-[#240046]",
        "shadow-[0_6px_18px_rgb(224_140_11/0.42)] ring-1 ring-inset ring-white/55",
        "outline-none transition-transform duration-150 will-change-transform",
        "hover:-translate-y-0.5 active:scale-95",
        "focus-visible:ring-2 focus-visible:ring-white",
        "xs:h-10 xs:min-w-0 xs:flex xs:items-center xs:gap-1 xs:px-3",
        className ?? "",
      ].join(" ")}
    >
      <Plus className="size-5 shrink-0" strokeWidth={3} aria-hidden />
      <span className="hidden text-[11px] font-black leading-none xs:inline sm:text-xs">
        {label}
      </span>
    </a>
  );
}

export default AddListingButton;

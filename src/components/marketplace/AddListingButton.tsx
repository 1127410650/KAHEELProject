import { Plus } from "lucide-react";

import { useI18n } from "@/i18n";

type Props = {
  href: string;
  className?: string;
};

/**
 * زر «إنشاء إعلان» الذهبي — يعيش في الهيدر بجانب الجرس.
 * أيقونة فقط على الشاشات الضيقة (≤419px) وكبسولة بنص من 420px.
 * كل الحركات على transform/opacity فقط وتتوقف مع prefers-reduced-motion.
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
        "k-add-cta relative inline-flex size-11 shrink-0 items-center justify-center gap-1 rounded-full",
        "bg-[linear-gradient(140deg,#ffe9ae_0%,#f9c22e_46%,#e08c0b_100%)] text-brand-950",
        "shadow-[0_6px_18px_rgb(224_140_11/0.45)] ring-1 ring-inset ring-white/60",
        "outline-none transition-transform duration-150 will-change-transform",
        "hover:-translate-y-0.5 active:scale-95",
        "focus-visible:ring-2 focus-visible:ring-white",
        "min-[420px]:size-auto min-[420px]:h-11 min-[420px]:px-3.5",
        className ?? "",
      ].join(" ")}
    >
      <Plus className="size-5 shrink-0" strokeWidth={3} aria-hidden />
      <span className="hidden whitespace-nowrap text-[11px] font-black leading-none min-[420px]:inline sm:text-xs">
        {label}
      </span>
    </a>
  );
}

export default AddListingButton;

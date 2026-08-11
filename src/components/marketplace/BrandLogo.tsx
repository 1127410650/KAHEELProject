/**
 * شعار كَحيل — يقرأ من فتحات الوسائط (`brand.logo.*`) ويعود إلى الشعار المضمّن
 * في الحزمة عند غياب فتحة معتمدة.
 *
 * وجود هذا المكوّن يعني أن تغيير الشعار في «المظهر ← الوسائط» يسري على الهيدر
 * والتذييل معًا بلا نشر جديد ولا شعار مكرّر داخل المكوّنات.
 */
import bundledLogo from "@/assets/kaheel-logo.png";
import { slotUrl, useMediaSlots } from "@/lib/mkt-media-slots";

export type BrandLogoPlacement = "header" | "footer";

/** رابط الشعار الحالي للموضع المطلوب. */
export function useBrandLogo(placement: BrandLogoPlacement = "header"): string {
  const slots = useMediaSlots();
  const key = placement === "footer" ? "brand.logo.footer" : "brand.logo.header.light";
  return slotUrl(slots.data, key, bundledLogo);
}

export function BrandLogo({
  placement = "header",
  className,
}: {
  placement?: BrandLogoPlacement;
  className?: string;
}) {
  const src = useBrandLogo(placement);
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      width={1024}
      height={1024}
      loading="lazy"
      className={className}
    />
  );
}

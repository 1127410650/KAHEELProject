/**
 * «كَحيلان يطلّ برأسه» — إطلالة خفيفة من حافة الشاشة.
 *
 * الرأس والكتف فقط: نفس الأصل المعتمد لكَحيلان (لا رسم ثانٍ ولا هوية ثانية)،
 * لكن داخل نافذة قصّ بارتفاع الرأس والكتف فقط، وباقي الجسم خارج النافذة. لذلك
 * لا يوجد أصل جديد يُحمَّل ولا حجم إضافي على الصفحة.
 *
 * الضوابط:
 *  • أبعاد النافذة ثابتة (`w`/`h` بالكلاس) ⇒ صفر هزّة تخطيط.
 *  • ميلة رأس خفيفة دائمة تُعطَّل تحت `prefers-reduced-motion`.
 *  • الصورة `pointer-events-none`: لا تعترض تمريرًا ولا ضغطة.
 */
import { Mascot } from "@/components/marketplace/campaign/Mascot";

/** نسبة القصّ: الرأس والكتف ≈ الثلث الأعلى من الأصل الكامل. */
const CROP_HEIGHT = "h-[7rem]";
const IMAGE_HEIGHT = "h-[24rem]";

export function MascotPeek({
  lang = "ar",
  animated = true,
}: {
  lang?: "ar" | "en";
  animated?: boolean;
}) {
  return (
    <div
      className={`pointer-events-none relative ${CROP_HEIGHT} w-[7.5rem] shrink-0 overflow-hidden`}
      aria-hidden
    >
      <div
        className={`absolute inset-x-0 top-0 flex justify-center ${
          animated ? "animate-[mascot-peek-tilt_3.4s_ease-in-out_infinite] motion-reduce:animate-none" : ""
        }`}
        style={{ transformOrigin: "bottom center" }}
      >
        <Mascot
          name="kaheelan"
          pose="idle"
          lang={lang}
          animated={false}
          className={`${IMAGE_HEIGHT} w-auto max-w-none`}
        />
      </div>
    </div>
  );
}

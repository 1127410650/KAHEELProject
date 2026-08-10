/**
 * بانر «سوريا 🇸🇾 فخرنا» — بطاقة بعرض الصفحة تحت الهيدر مباشرة.
 *
 * • الصورة رسم دافئ بنفس أسلوب «جيب لي»: رجل سوري يرفع العلم الجديد
 *   (أخضر/أبيض/أسود بثلاث نجوم حمراء) فوق معالم سورية عند الغروب.
 * • الفتحة `home.pride.banner` قابلة للاستبدال من `/admin/appearance` بلا كود.
 * • النسبة 16/5 محجوزة (`aspect-[16/5]`) والأبعاد صريحة ⇒ صفر هزّة تخطيط.
 */
import { useI18n } from "@/i18n";
import { slotAlt, slotUrl, useMediaSlots } from "@/lib/mkt-media-slots";

import prideArt from "@/assets/market/home-syria-pride.jpg";

export const PRIDE_SLOT_KEY = "home.pride.banner";

export function SyriaPrideBanner() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const slots = useMediaSlots();
  const src = slotUrl(slots.data, PRIDE_SLOT_KEY, prideArt);
  const alt = slotAlt(
    slots.data,
    PRIDE_SLOT_KEY,
    ar ? "رجل سوري يرفع علم سوريا فوق معالم البلد" : "A Syrian man raising the Syrian flag",
  );

  return (
    <section
      data-kslot={PRIDE_SLOT_KEY}
      aria-label={ar ? "سوريا فخرنا" : "Syria our pride"}
      className="relative isolate overflow-hidden rounded-[14px] bg-secondary"
      style={{ aspectRatio: "16 / 5" }}
    >
      <img
        src={src}
        alt={alt}
        width={1920}
        height={600}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 size-full object-cover"
      />
      {/* تعتيم متدرّج من جهة البداية فقط: يضمن تباين النص فوق أي صورة يرفعها المالك. */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to ${ar ? "left" : "right"}, rgb(0 0 0 / 0.45), rgb(0 0 0 / 0.18) 48%, rgb(0 0 0 / 0))`,
        }}
      />

      <div className="relative flex size-full flex-col justify-center gap-1 px-[var(--sp-4)]">
        <p className="text-lg font-extrabold leading-[1.3] text-primary-foreground">
          {ar ? "سوريا 🇸🇾 فخرنا" : "Syria 🇸🇾 our pride"}
        </p>
        <p className="text-desc leading-[1.6] text-primary-foreground/85">
          {ar
            ? "كل إعلان هون بيبني بلدنا من جديد — منتجات ومهن وأصحاب أرض واحدة."
            : "Every listing here rebuilds our country — products, trades and one shared land."}
        </p>
      </div>
    </section>
  );
}

export default SyriaPrideBanner;

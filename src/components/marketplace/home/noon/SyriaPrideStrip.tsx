/**
 * شريط رفيع بعرض الشاشة: «سوريا 🇸🇾 فخرنا» — خلفية رمادية فاتحة ونص في الوسط.
 * الارتفاع ثابت (32px) فلا يحرّك ما تحته.
 */
import { useI18n } from "@/i18n";

export function SyriaPrideStrip() {
  const { locale } = useI18n();
  return (
    <div data-kslot="home.pride_strip" className="-mx-3 flex h-8 items-center justify-center bg-secondary px-3 sm:-mx-5 lg:-mx-8">
      <p className="truncate text-desc font-black tracking-tight text-foreground sm:text-sm">
        {locale === "ar" ? "سوريا 🇸🇾 فخرنا" : "Syria 🇸🇾 our pride"}
      </p>
    </div>
  );
}

import { Languages } from "lucide-react";

import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";

/**
 * Standalone language switch, kept after the retired internal `AppLayout` shell
 * was removed. Used by the bare screens (`/register`, `/market-setup`).
 */
export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();
  const { profile } = useSession();

  async function change(next: "ar" | "en") {
    if (next === locale) return;
    setLocale(next);
    if (profile) {
      await supabase.from("profiles").update({ locale: next }).eq("user_id", profile.user_id);
    }
  }

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-secondary p-0.5 md:gap-1 md:p-1",
        compact && "scale-95",
      )}
    >
      <Languages className="mx-1 hidden size-3.5 text-muted-foreground md:block" aria-hidden />
      <button
        type="button"
        onClick={() => change("ar")}
        className={cn(
          "rounded-full px-1.5 py-1 text-desc font-semibold leading-none transition-colors md:px-3 md:text-desc",
          locale === "ar"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span className="lg:hidden">ع</span>
        <span className="hidden lg:inline">العربية</span>
      </button>
      <button
        type="button"
        onClick={() => change("en")}
        className={cn(
          "rounded-full px-1.5 py-1 text-desc font-semibold leading-none transition-colors md:px-3 md:text-desc",
          locale === "en"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span className="lg:hidden">EN</span>
        <span className="hidden lg:inline">English</span>
      </button>
    </div>
  );
}

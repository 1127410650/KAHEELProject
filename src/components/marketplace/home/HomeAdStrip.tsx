/**
 * The compact horizontal ad slot that sits between the main field cards and the
 * benefits strip.
 *
 * The box height is fixed (84px mobile / 104px from `sm`) and reserved before
 * any campaign data arrives, so the slot can never shift the page — with a live
 * campaign, with the elegant fallback, or while loading. Assets mount lazily
 * through `CampaignAsset`, which also honours `prefers-reduced-motion`.
 */
import { Link } from "@tanstack/react-router";
import { ChevronLeft, Megaphone } from "lucide-react";

import { CampaignAsset } from "@/components/marketplace/campaign/CampaignAsset";
import { useI18n } from "@/i18n";
import { trackCampaign, useLiveCampaigns } from "@/lib/mkt-campaigns";

const BOX = "relative h-[84px] w-full overflow-hidden rounded-[20px] sm:h-[104px]";

export function HomeAdStrip({ addHref }: { addHref: string }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { data } = useLiveCampaigns("home_strip");
  const campaign = data?.[0];

  if (!campaign) {
    return (
      <section aria-label={ar ? "مساحة إعلانية" : "Ad slot"}>
        <Link
          to={addHref}
          className={`${BOX} group flex items-center gap-3 bg-[linear-gradient(120deg,#10002b,#3c096c_58%,#7b2cbf)] px-3.5 text-white outline-none ring-1 ring-white/10 focus-visible:ring-2 focus-visible:ring-[#c77dff] sm:px-5`}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 sm:size-11">
            <Megaphone className="size-4 text-[#e0aaff] sm:size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-xs font-black sm:text-base">
              {ar ? "مساحتك الإعلانية على كَحيل" : "Your ad space on Kaheel"}
            </strong>
            <span className="mt-0.5 block truncate text-[9px] text-white/65 sm:text-xs">
              {ar
                ? "أوصل عرضك لجمهور السوق في المكان الأبرز"
                : "Put your offer in front of the whole marketplace"}
            </span>
          </span>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[#3c096c] shadow-md transition group-hover:-translate-x-1 sm:size-9 rtl:group-hover:translate-x-1">
            <ChevronLeft className="size-4 ltr:rotate-180 rtl:rotate-0" aria-hidden />
          </span>
        </Link>
      </section>
    );
  }

  return (
    <section aria-label={ar ? "مساحة إعلانية" : "Ad slot"}>
      <a
        href={campaign.click_url ?? "#"}
        onClick={() => void trackCampaign(campaign.id, "click")}
        className={`${BOX} block bg-[#240046] outline-none ring-1 ring-[#c77dff]/25 focus-visible:ring-2 focus-visible:ring-[#7b2cbf]`}
      >
        <CampaignAsset campaign={campaign} />
        <span className="absolute bottom-1.5 end-2 z-10 rounded-full bg-black/45 px-2 py-0.5 text-[8px] font-black text-white/90 sm:text-[9px]">
          {ar ? "إعلان" : "Ad"}
        </span>
      </a>
    </section>
  );
}

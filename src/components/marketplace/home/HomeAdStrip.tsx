/**
 * The compact horizontal ad slot that sits between the main field cards and the
 * benefits strip.
 *
 * The box height is fixed (84px mobile / 104px from `sm`) and reserved before
 * any campaign data arrives, so the slot can never shift the page — with a live
 * campaign, with the elegant fallback, or while loading. Assets mount lazily
 * through `CampaignAsset`, which also honours `prefers-reduced-motion`.
 */
import { useEffect } from "react";
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

  useEffect(() => {
    if (campaign) trackCampaign(campaign.id, "impression");
  }, [campaign]);

  if (!campaign) {
    return (
      <section aria-label={ar ? "مساحة إعلانية" : "Ad slot"}>
        {/* نفس بطاقة الصفحة الموحّدة، بلا كتلة بنفسجية مصمتة. */}
        <Link
          to={addHref}
          className={`${BOX} k-surface k-lift group flex items-center gap-3 px-[var(--sp-4)] text-brand-950 outline-none focus-visible:ring-2 focus-visible:ring-brand-700`}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-[var(--r-card)] border-2 border-white bg-[radial-gradient(circle_at_32%_25%,rgb(138_79_255/0.1),rgb(138_79_255/0.35)_78%)] text-primary sm:size-11">
            <Megaphone className="size-4 sm:size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-desc font-black sm:text-base">
              {ar ? "مساحتك الإعلانية على كَحيل" : "Your ad space on Kaheel"}
            </strong>
            <span className="mt-0.5 block truncate text-desc text-brand-800 sm:text-desc">
              {ar
                ? "أوصل عرضك لجمهور السوق في المكان الأبرز"
                : "Put your offer in front of the whole marketplace"}
            </span>
          </span>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[linear-gradient(140deg,#8A4FFF,#C3ABFF)] text-white shadow-md transition group-hover:-translate-x-1 sm:size-9 rtl:group-hover:translate-x-1">
            <ChevronLeft className="size-4 ltr:rotate-180 rtl:rotate-0" aria-hidden />
          </span>
        </Link>
      </section>
    );
  }

  return (
    <section aria-label={ar ? "مساحة إعلانية" : "Ad slot"}>
      <a
        href={campaign.click_url}
        onClick={() => trackCampaign(campaign.id, "click")}
        className={`${BOX} k-surface block outline-none focus-visible:ring-2 focus-visible:ring-brand-700`}
      >

        <CampaignAsset campaign={campaign} />
        <span className="absolute bottom-1.5 end-2 z-10 rounded-full bg-black/45 px-2 py-0.5 text-desc font-black text-white/90 sm:text-desc">
          {ar ? "إعلان" : "Ad"}
        </span>
      </a>
    </section>
  );
}

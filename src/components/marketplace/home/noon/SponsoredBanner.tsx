/**
 * إعلان ممول بشكل «نون» بالضبط: بانر عريض بصورة، ووسم «إعلان» صغير جدًا رمادي
 * في الزاوية. الصندوق محجوز بنسبة أبعاد ثابتة ⇒ صفر هزّة تخطيط.
 */
import { useEffect } from "react";

import { CampaignAsset } from "@/components/marketplace/campaign/CampaignAsset";
import { useI18n } from "@/i18n";
import { trackCampaign, useLiveCampaigns } from "@/lib/mkt-campaigns";
import fallbackImage from "@/assets/market/kaheel-home-hero-v2.webp";

export function SponsoredBanner() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { data } = useLiveCampaigns("home_strip");
  const campaign = data?.[0];

  useEffect(() => {
    if (campaign) trackCampaign(campaign.id, "impression");
  }, [campaign]);

  const label = (
    <span className="absolute bottom-1 end-2 z-10 text-[8px] font-bold text-muted-foreground">
      {ar ? "إعلان" : "Ad"}
    </span>
  );

  const box =
    "relative block aspect-[16/6] w-full overflow-hidden rounded-2xl border border-border bg-card outline-none focus-visible:ring-2 focus-visible:ring-primary/45";

  if (!campaign)
    return (
      <section aria-label={ar ? "إعلان ممول" : "Sponsored"}>
        <a href="/search" className={box}>
          <img
            src={fallbackImage}
            alt=""
            width={1600}
            height={600}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
          {label}
        </a>
      </section>
    );

  return (
    <section aria-label={ar ? "إعلان ممول" : "Sponsored"}>
      <a
        href={campaign.click_url}
        onClick={() => trackCampaign(campaign.id, "click")}
        className={box}
      >
        <CampaignAsset campaign={campaign} />
        {label}
      </a>
    </section>
  );
}

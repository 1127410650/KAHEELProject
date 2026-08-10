/**
 * إعلان ممول بشكل «نون» بالضبط: بانر عريض بصورة، ووسم «إعلان» صغير جدًا رمادي
 * في الزاوية. الصندوق محجوز بنسبة أبعاد ثابتة ⇒ صفر هزّة تخطيط.
 */
import { useEffect } from "react";

import { CampaignAsset } from "@/components/marketplace/campaign/CampaignAsset";
import { useI18n } from "@/i18n";
import { trackCampaign, useLiveCampaigns } from "@/lib/mkt-campaigns";
import { slotCampaignId, slotTemplateId, useMediaSlots } from "@/lib/mkt-media-slots";
import { DesignCard } from "@/components/marketplace/design/DesignCard";
import { useDesignLibrary, useDesignTemplates } from "@/lib/mkt-design-library";
import fallbackImage from "@/assets/market/kaheel-home-hero-v2.webp";

export function SponsoredBanner() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { data } = useLiveCampaigns("home_strip");
  /* الحملة المربوطة بالفتحة من وضع التحرير تتقدّم، وإلا فالأولوية التلقائية. */
  const slots = useMediaSlots();
  const boundId = slotCampaignId(slots.data, "home.sponsored");
  /* بطاقة مبنية من اللوحة على هذه الفتحة تتقدّم على كل شيء. */
  const templateId = slotTemplateId(slots.data, "home.sponsored");
  const templates = useDesignTemplates(!!templateId);
  const lib = useDesignLibrary(!!templateId);
  const template = templateId ? templates.data?.find((item) => item.id === templateId) : undefined;
  const campaign = (boundId ? data?.find((item) => item.id === boundId) : undefined) ?? data?.[0];

  useEffect(() => {
    if (campaign) trackCampaign(campaign.id, "impression");
  }, [campaign]);

  /* وسم الإفصاح كما في نون: كبسولة رمادية صغيرة في الزاوية تبقى مقروءة فوق
     أي صورة — وهي الاستثناء الوحيد المسموح بحجم أصغر من 14px. */
  const label = (
    <span className="absolute bottom-1.5 end-2 z-10 rounded-md bg-secondary/90 px-1.5 py-0.5 text-micro font-bold text-muted-foreground backdrop-blur-sm">
      {ar ? "إعلان" : "Ad"}
    </span>
  );


  const box =
    "relative block aspect-[16/6] w-full overflow-hidden rounded-2xl border border-border bg-card outline-none focus-visible:ring-2 focus-visible:ring-primary/45";

  if (template)
    return (
      <section aria-label={ar ? "إعلان ممول" : "Sponsored"} data-kslot="home.sponsored" className="relative">
        <DesignCard template={template} library={lib.data} />
        {label}
      </section>
    );

  if (!campaign)
    return (
      <section aria-label={ar ? "إعلان ممول" : "Sponsored"}>
        <a href="/search" data-kslot="home.sponsored" className={box}>
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
        data-kslot="home.sponsored"
        className={box}
      >
        <CampaignAsset campaign={campaign} />
        {label}
      </a>
    </section>
  );
}

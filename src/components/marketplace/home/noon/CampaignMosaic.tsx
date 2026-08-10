/**
 * الإعلانات بإيقاع متفاوت (نمط «نون»).
 *
 * المحتوى كله من الحملات التي يديرها مدير النظام في `/admin/campaigns`
 * (موضع `home_banner`): أول حملة تأخذ البطاقة العريضة، ثم صف من بطاقتين، ثم
 * يتناوب النمط. عند غياب الحملات تُعرض بطاقة عريضة واحدة بالنص الافتراضي
 * «جينا لخدمتكم» — بنفس الصندوق المحجوز فلا هزّة تخطيط.
 */
import { useEffect } from "react";

import restaurantsImg from "@/assets/market/cat-restaurants-hero.webp";
import groceriesImg from "@/assets/market/cat-groceries-hero.webp";
import realEstateImg from "@/assets/market/cat-real-estate-hero.webp";
import carsImg from "@/assets/market/cat-cars.webp";
import { CampaignAsset } from "@/components/marketplace/campaign/CampaignAsset";
import { useI18n } from "@/i18n";
import { trackCampaign, useLiveCampaigns, type LiveCampaign } from "@/lib/mkt-campaigns";

const WIDE = "h-[132px] sm:h-[190px]";
const HALF = "h-[112px] sm:h-[150px]";


function CampaignTile({
  campaign,
  className,
  fallbackTitle,
  fallbackHref,
  fallbackImage,
}: {
  campaign?: LiveCampaign | undefined;
  className: string;
  fallbackTitle: string;
  fallbackHref: string;
  fallbackImage?: string;
}) {
  useEffect(() => {
    if (campaign) trackCampaign(campaign.id, "impression");
  }, [campaign]);

  const box = `relative block w-full overflow-hidden rounded-3xl border border-border bg-card shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/45 ${className}`;

  /* الطبقة الأساسية: صورة القسم + تدرّج بنفسجي فوقها والنص — تضمن ألّا يظهر
     صندوق أبيض فارغ إذا كان أصل الحملة شفافًا أو تعذّر تحميله. */
  const base = (
    <>
      {fallbackImage ? (
        <img
          src={fallbackImage}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
      <span
        aria-hidden
        className={
          fallbackImage
            ? "absolute inset-0 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--primary)_82%,transparent),color-mix(in_oklab,var(--primary)_18%,transparent))]"
            : "absolute inset-0 bg-[radial-gradient(120%_120%_at_88%_0%,color-mix(in_oklab,var(--primary)_16%,transparent),transparent_62%)]"
        }
      />
      <span className="absolute inset-0 z-0 flex flex-col justify-center gap-1 px-4 sm:px-6">
        <strong
          className={`text-lg font-black tracking-tight sm:text-2xl ${
            fallbackImage ? "text-primary-foreground" : ""
          }`}
        >
          {fallbackTitle}
        </strong>
      </span>
    </>
  );

  if (!campaign)
    return (
      <a href={fallbackHref} className={box}>
        {base}
      </a>
    );

  return (
    <a
      href={campaign.click_url}
      onClick={() => trackCampaign(campaign.id, "click")}
      className={box}
    >

      {base}
      <span className="absolute inset-0 z-10">
        <CampaignAsset campaign={campaign} />
      </span>
    </a>
  );
}


export function CampaignMosaic() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { data } = useLiveCampaigns("home_banner");
  const campaigns = data ?? [];
  const fallbackTitle = ar ? "جينا لخدمتكم" : "Here to serve you";

  // مجموعات متناوبة: واحدة عريضة، ثم اثنتان، ثم واحدة عريضة…
  const groups: LiveCampaign[][] = [];
  let cursor = 0;
  let wide = true;
  while (cursor < campaigns.length) {
    const size = wide ? 1 : 2;
    groups.push(campaigns.slice(cursor, cursor + size));
    cursor += size;
    wide = !wide;
  }

  return (
    <section aria-label={ar ? "إعلانات كَحيل" : "Kaheel ads"} className="space-y-2.5">
      {groups.length === 0 ? (
        <CampaignTile
          className={WIDE}
          fallbackTitle={fallbackTitle}
          fallbackHref="/search"
        />
      ) : (
        groups.map((group, index) =>
          group.length === 1 ? (
            <CampaignTile
              key={group[0]!.id}
              campaign={group[0]!}
              className={WIDE}
              fallbackTitle={fallbackTitle}
              fallbackHref="/search"
            />
          ) : (
            <div key={`pair-${index}`} className="grid grid-cols-2 gap-2.5">
              {group.map((campaign) => (
                <CampaignTile
                  key={campaign.id}
                  campaign={campaign}
                  className={HALF}
                  fallbackTitle={fallbackTitle}
                  fallbackHref="/search"
                />
              ))}
            </div>
          ),
        )
      )}
    </section>
  );
}

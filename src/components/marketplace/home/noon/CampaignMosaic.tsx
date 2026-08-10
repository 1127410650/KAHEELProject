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
import { DesignCard } from "@/components/marketplace/design/DesignCard";
import { useDesignLibrary, useDesignTemplates } from "@/lib/mkt-design-library";
import { slotTemplateId, useMediaSlots } from "@/lib/mkt-media-slots";

const WIDE = "h-[132px] sm:h-[190px]";
const HALF = "h-[112px] sm:h-[150px]";


function CampaignTile({
  campaign,
  slotKey,
  className,
  fallbackTitle,
  fallbackHref,
  fallbackImage,
}: {
  campaign?: LiveCampaign | undefined;
  slotKey: string;
  className: string;
  fallbackTitle: string;
  fallbackHref: string;
  fallbackImage?: string;
}) {
  useEffect(() => {
    if (campaign) trackCampaign(campaign.id, "impression");
  }, [campaign]);

  /* بطاقة مبنية من «تصاميمي» ومربوطة بهذه الفتحة تتقدّم على الحملة والافتراضي. */
  const slots = useMediaSlots();
  const templateId = slotTemplateId(slots.data, slotKey);
  const templates = useDesignTemplates(!!templateId);
  const lib = useDesignLibrary(!!templateId);
  const template = templateId ? templates.data?.find((item) => item.id === templateId) : undefined;

  // الأساس لافندر خفيف (لا أبيض) كي لا يبدو الموضع فارغًا مع أصل حملة شفاف.
  const box = `relative block w-full overflow-hidden rounded-3xl border border-border bg-secondary shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/45 ${className}`;


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

  if (template)
    return (
      <div data-kslot={slotKey} className={box}>
        <DesignCard template={template} library={lib.data} className={`size-full ${className}`} />
      </div>
    );

  if (!campaign)
    return (
      <a href={fallbackHref} data-kslot={slotKey} className={box}>
        {base}
      </a>
    );

  return (
    <a
      href={campaign.click_url}
      onClick={() => trackCampaign(campaign.id, "click")}
      data-kslot={slotKey}
      className={box}
    >

      {base}
      <span className="absolute inset-0 z-10">
        <CampaignAsset campaign={campaign} />
      </span>
    </a>
  );
}


/** بطاقات القسم الافتراضية: تُكمل الإيقاع حين تقل الحملات المُدارة عن أربع. */
type Slot = { campaign?: LiveCampaign; title: string; href: string; image?: string };

export function CampaignMosaic() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { data } = useLiveCampaigns("home_banner");
  const campaigns = data ?? [];
  const fallbackTitle = ar ? "جينا لخدمتكم" : "Here to serve you";

  const fillers: Slot[] = [
    { title: fallbackTitle, href: "/search", image: restaurantsImg },
    { title: ar ? "مقاضي البيت" : "Groceries", href: "/search?domain=product", image: groceriesImg },
    { title: ar ? "سيارات" : "Cars", href: "/search?category=cars", image: carsImg },
    {
      title: ar ? "عقارات للإيجار والبيع" : "Homes to rent and buy",
      href: "/aqar",
      image: realEstateImg,
    },
  ];

  /* الإيقاع ثابت دائمًا: عريضة ← بطاقتان ← عريضة. الحملات المُدارة تأخذ المواضع
     أولًا، وما تبقّى يُكمَل ببطاقات أقسام حقيقية بصور — فلا موضع أبيض فارغ ولا
     إيقاع منقوص ببطاقة واحدة. */
  const slots: Slot[] = Array.from({ length: 4 }, (_, index) => {
    const campaign = campaigns[index];
    const filler = fillers[index]!;
    return campaign ? { campaign, title: fallbackTitle, href: "/search" } : filler;
  });

  const tile = (slot: Slot, className: string, key: string, slotKey: string) => (
    <CampaignTile
      key={key}
      slotKey={slotKey}
      campaign={slot.campaign}
      className={className}
      fallbackTitle={slot.title}
      fallbackHref={slot.href}
      {...(slot.image ? { fallbackImage: slot.image } : {})}
    />
  );

  return (
    <section aria-label={ar ? "إعلانات كَحيل" : "Kaheel ads"} className="space-y-2.5">
      {tile(slots[0]!, WIDE, "wide-1", "home.campaign.1")}
      <div className="grid grid-cols-2 gap-2.5">
        {tile(slots[1]!, HALF, "half-1", "home.campaign.2")}
        {tile(slots[2]!, HALF, "half-2", "home.campaign.3")}
      </div>
      {tile(slots[3]!, WIDE, "wide-2", "home.campaign.4")}
    </section>
  );
}

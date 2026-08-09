/**
 * One campaign asset, whatever its kind: Lottie JSON, animated WebP, MP4 or a
 * plain photo.
 *
 * Layout stability is the parent's job (a fixed box or an `aspect-ratio`), so
 * this component only ever fills the box it is given — nothing here can shift
 * the page. Heavy kinds (Lottie, video) mount only once the box is near the
 * viewport, and video is muted, inline and `playsInline` so mobile browsers
 * autoplay it without going fullscreen. `prefers-reduced-motion` freezes video
 * on its poster and Lottie on its first frame.
 */
import { useEffect, useRef, useState } from "react";

import { LottieBox } from "@/components/marketplace/campaign/LottieBox";
import type { LiveCampaign } from "@/lib/mkt-campaigns";

export function CampaignAsset({
  campaign,
  eager = false,
}: {
  campaign: LiveCampaign;
  eager?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(eager);

  useEffect(() => {
    if (near) return;
    const box = boxRef.current;
    if (!box) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setNear(true);
      },
      { rootMargin: "300px" },
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, [near]);

  const url = campaign.assetUrl;

  return (
    <div ref={boxRef} className="absolute inset-0 size-full overflow-hidden">
      {!url ? null : campaign.asset_kind === "lottie" ? (
        near ? (
          <LottieBox src={url} className="size-full [&>svg]:size-full" />
        ) : null
      ) : campaign.asset_kind === "mp4" ? (
        <video
          src={near ? url : undefined}
          {...(campaign.posterUrl ? { poster: campaign.posterUrl } : {})}
          width={campaign.asset_width}
          height={campaign.asset_height}
          muted
          loop
          autoPlay
          playsInline
          preload="none"
          disablePictureInPicture
          className="size-full object-cover object-center"
          aria-hidden
        />
      ) : (
        <img
          src={url}
          alt=""
          width={campaign.asset_width}
          height={campaign.asset_height}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "low"}
          decoding="async"
          className="size-full object-cover object-center"
          aria-hidden
        />
      )}
    </div>
  );
}

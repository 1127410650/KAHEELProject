/**
 * Lottie surface. `lottie-web`'s light player is imported dynamically, so the
 * ~40 KB runtime is fetched only when a live Lottie campaign actually exists —
 * it never lands in the home-page bundle. The JSON is fetched once and animated
 * on the compositor-friendly SVG renderer.
 *
 * Under `prefers-reduced-motion` the animation is rendered as a single still
 * frame instead of playing.
 */
import { useEffect, useRef } from "react";

export function LottieBox({
  src,
  loop = true,
  className,
  /** `slice` fills a banner; `meet` keeps a small illustration fully visible. */
  fit = "slice",
}: {
  src: string;
  loop?: boolean;
  className?: string;
  fit?: "slice" | "meet";
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    type Anim = { destroy: () => void; goToAndStop: (value: number, isFrame?: boolean) => void };
    let animation: Anim | null = null;

    void (async () => {
      try {
        // The ESM build is imported by path: the package ships no `exports` map,
        // and the UMD entry cannot be pre-bundled here.
        const [{ default: lottie }, response] = await Promise.all([
          import("lottie-web/build/player/esm/lottie_light.min.js"),
          fetch(src, { cache: "force-cache" }),
        ]);
        if (disposed || !response.ok) return;
        const animationData = (await response.json()) as unknown;
        if (disposed) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        animation = lottie.loadAnimation({
          container: host,
          renderer: "svg",
          loop: reduced ? false : loop,
          autoplay: !reduced,
          animationData,
          rendererSettings: { progressiveLoad: true, preserveAspectRatio: `xMidYMid ${fit}` },
        }) as unknown as Anim;
        if (reduced) animation?.goToAndStop(0, true);
      } catch {
        /* a failed campaign asset must never break the page */
      }
    })();


    return () => {
      disposed = true;
      animation?.destroy();
    };
  }, [src, loop, fit]);

  return <div ref={hostRef} className={className} aria-hidden />;
}

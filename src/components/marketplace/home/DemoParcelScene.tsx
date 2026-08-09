/**
 * Playful parcel scene for the live-demo card.
 *
 * The static icon square is replaced by a small cartoon skit: a parcel drops
 * in, the lid flips open and a smiling character pops out with a line in light
 * Syrian tone. One of the lines/scenes is picked per mount, so the card feels
 * alive across visits without ever being loud.
 *
 * Cost and stability rules:
 *  - the box is a fixed square with a reserved size, so the card's height is
 *    identical before and after the animation loads (zero layout shift),
 *  - the ~40 KB Lottie player and the JSON are only fetched once the card is
 *    actually scrolled into view (`IntersectionObserver`),
 *  - `prefers-reduced-motion` gets the first frame as a still image — handled
 *    inside `LottieBox` — and the CSS wrapper animation is disabled too.
 */
import { useEffect, useMemo, useRef, useState } from "react";

import { LottieBox } from "@/components/marketplace/campaign/LottieBox";

/** Lottie scenes, kept deliberately tiny (~8-12 KB each). */
const SCENES = ["/lottie/kaheel-parcel-drop.json", "/lottie/kaheel-parcel-peek.json"] as const;

export interface DemoSceneCopy {
  titleAr: string;
  subtitleAr: string;
  titleEn: string;
  subtitleEn: string;
  /** Which skit fits the line: the drop for "I fell", the peek for "look out". */
  scene: (typeof SCENES)[number];
}

const COPY: DemoSceneCopy[] = [
  {
    titleAr: "أوف… وصلتك بخير! 📦",
    subtitleAr: "امسك العرض يا كابتن، في ناس رح تسرقه منك 😄",
    titleEn: "Phew… delivered in one piece! 📦",
    subtitleEn: "Grab the offer, captain — someone else is eyeing it 😄",
    scene: SCENES[0],
  },
  {
    titleAr: "شوف شو صار فيني! 😅",
    subtitleAr: "كل هالطريق مشان أوصّلك هالعرض",
    titleEn: "Look what happened to me! 😅",
    subtitleEn: "All this way just to bring you this offer",
    scene: SCENES[0],
  },
  {
    titleAr: "لك أنا وقعت وإنت واقف؟ 🙃",
    subtitleAr: "تعا امسك العرض قبل ما يفوت",
    titleEn: "I took the fall and you're just standing there? 🙃",
    subtitleEn: "Come grab the offer before it's gone",
    scene: SCENES[0],
  },
  {
    titleAr: "انتبه! طرد جاي 📦",
    subtitleAr: "وفيه عرض ما بيتفوّت",
    titleEn: "Heads up! Parcel incoming 📦",
    subtitleEn: "And there's an offer inside you can't miss",
    scene: SCENES[1],
  },
];

/** Picked on the client only, so SSR and hydration render the same first frame. */
export function useDemoSceneCopy(): DemoSceneCopy {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(Math.floor(Math.random() * COPY.length));
  }, []);
  return COPY[index] ?? COPY[0]!;
}

export function DemoParcelScene({ scene }: { scene: DemoSceneCopy["scene"] }) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const box = useMemo(
    () => (inView ? <LottieBox src={scene} className="size-full" /> : null),
    [inView, scene],
  );

  return (
    <span
      ref={hostRef}
      // Fixed square: the space is reserved whether or not the animation loads.
      className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/15 bg-white/10 motion-safe:animate-[kaheel-demo-float_4.5s_ease-in-out_infinite] sm:size-20"
      aria-hidden
    >
      <span className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_50%_35%,rgb(224_170_255/0.35),transparent_70%)]" />
      <span className="relative size-full">{box}</span>
    </span>
  );
}

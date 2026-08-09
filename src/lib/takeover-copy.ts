/**
 * Default copy for the popup campaigns (welcome takeover, category popups).
 *
 * Providers can set `title_ar/subtitle_ar` (and the English pair) per campaign
 * from the admin panel. When a campaign leaves them empty we fall back to one of
 * these friendly lines — simplified Modern Standard Arabic with a light Syrian
 * touch, always warm and respectful.
 */
export type PopupCopy = { title: string; subtitle: string };

const AR_POOL: PopupCopy[] = [
  { title: "لا تروح بعيد… كل شي بتدوّر عليه هون بكَحيل 👋", subtitle: "تصفّح العروض القريبة منك بخطوة واحدة" },
  { title: "شو رأيك تشوف العروض قبل ما تطير؟ 🎁", subtitle: "عروض اليوم مختارة بعناية لك" },
  { title: "عم نجهّزلك أحلى العروض… تفضّل شوفها", subtitle: "مزوّدون موثوقون وأسعار واضحة" },
  { title: "فرصتك اليوم… وبكرا منشوف غيرها 😊", subtitle: "ألقِ نظرة سريعة قبل أن تنتهي" },
  { title: "أهلًا فيك بكَحيل… خلّينا نوفّر عليك الوقت", subtitle: "كل الخدمات والمتاجر في مكان واحد" },
];

const EN_POOL: PopupCopy[] = [
  { title: "Everything you need is right here 👋", subtitle: "Browse nearby offers in one tap" },
  { title: "Care to see today's offers first? 🎁", subtitle: "Hand-picked deals, just for you" },
  { title: "We lined up the best offers for you", subtitle: "Trusted providers, clear prices" },
  { title: "Today's chance — tomorrow brings more 😊", subtitle: "Take a quick look before it ends" },
];

/** Picks a stable random line for the current mount. */
export function pickPopupCopy(ar: boolean, seed = Math.random()): PopupCopy {
  const pool = ar ? AR_POOL : EN_POOL;
  return pool[Math.floor(seed * pool.length) % pool.length]!;
}

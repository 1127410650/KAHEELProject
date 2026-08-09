/**
 * Default copy for the popup campaigns (welcome takeover, category popups).
 *
 * Providers can set `title_ar/subtitle_ar` (and the English pair) per campaign
 * from the admin panel. When a campaign leaves them empty we fall back to one of
 * these friendly lines — simplified Modern Standard Arabic with a light Syrian
 * touch, always warm and respectful. Each line names the mascot that fits it, so
 * the drawing and the wording always tell the same little joke.
 */
import type { MascotKind } from "@/components/marketplace/campaign/PopupMascot";

export type PopupCopy = { title: string; subtitle: string; mascot: MascotKind };

// Add new lines by appending to these arrays — nothing else needs to change.
const AR_POOL: PopupCopy[] = [
  { title: "يا حرام… زعلتني عليك 😂", subtitle: "كنت ضايع بدوني!", mascot: "lounge" },
  { title: "لك وين مسرّع؟ 🏍️", subtitle: "العرض هون… ما بدو منك غير ثانيتين", mascot: "moto" },
  { title: "ماشي… روح 👋", subtitle: "بس لا تقول ما قلتلك في عرض", mascot: "wave" },
  { title: "عم راقبك 👀", subtitle: "شكلك محتاج هالعرض", mascot: "peek" },
  { title: "لا تروح بعيد… كل شي بتدوّر عليه هون بكَحيل 👋", subtitle: "تصفّح العروض القريبة منك بخطوة واحدة", mascot: "wave" },
  { title: "شو رأيك تشوف العروض قبل ما تطير؟ 🎁", subtitle: "عروض اليوم مختارة بعناية لك", mascot: "moto" },
  { title: "عم نجهّزلك أحلى العروض… تفضّل شوفها", subtitle: "مزوّدون موثوقون وأسعار واضحة", mascot: "lounge" },
  { title: "فرصتك اليوم… وبكرا منشوف غيرها 😊", subtitle: "ألقِ نظرة سريعة قبل أن تنتهي", mascot: "peek" },
  { title: "أهلًا فيك بكَحيل… خلّينا نوفّر عليك الوقت", subtitle: "كل الخدمات والمتاجر في مكان واحد", mascot: "wave" },
  { title: "وين رايح؟ 🏃‍♂️", subtitle: "العرض لسا ما خلص… تعا شوفه دقيقة وبعدين روح", mascot: "moto" },
  { title: "لك شو هالسرعة! 😄", subtitle: "خمس ثواني بس… يمكن تلاقي شي يعجبك", mascot: "moto" },
  { title: "ما بدنا نزعجك… بس 👀", subtitle: "في عرض هون كتير منيح، وحرام يفوتك", mascot: "peek" },
  { title: "إذا سكّرت رح تندم 😌", subtitle: "مو تهديد… نصيحة من قلب", mascot: "lounge" },
  { title: "تعا لهون شوي 👋", subtitle: "كَحيل جمّعلك كل شي… وما بقى إلا تشوف", mascot: "peek" },
  { title: "صراحة؟ العرض هيدا حلو 🔥", subtitle: "وإذا ما عجبك، سكّر ونحنا مو زعلانين", mascot: "lounge" },
  { title: "دقيقة بس وبتكفّي ⏱️", subtitle: "شوف العروض وبعدين إنت وشطارتك", mascot: "moto" },
  { title: "لا تقلي ما شفت! 🙈", subtitle: "خلص صار عندك علم… القرار إلك", mascot: "peek" },
  { title: "العرض عم يستنّاك 🎁", subtitle: "وإذا تأخرت… بيروح لغيرك", mascot: "wave" },
  { title: "كَحيل بيحبك 💜", subtitle: "وعشان هيك جابلك أحلى العروض", mascot: "lounge" },
];

const EN_POOL: PopupCopy[] = [
  { title: "Aww… you left without me 😂", subtitle: "Admit it, you were lost", mascot: "lounge" },
  { title: "Where's the rush? 🏍️", subtitle: "The offer is right here — two seconds, tops", mascot: "moto" },
  { title: "Fine… off you go 👋", subtitle: "Just don't say we never mentioned an offer", mascot: "wave" },
  { title: "I'm watching you 👀", subtitle: "Looks like you need this one", mascot: "peek" },
  { title: "Everything you need is right here 👋", subtitle: "Browse nearby offers in one tap", mascot: "wave" },
  { title: "Care to see today's offers first? 🎁", subtitle: "Hand-picked deals, just for you", mascot: "moto" },
  { title: "We lined up the best offers for you", subtitle: "Trusted providers, clear prices", mascot: "lounge" },
  { title: "Today's chance — tomorrow brings more 😊", subtitle: "Take a quick look before it ends", mascot: "peek" },
  { title: "Welcome to Kaheel — let's save you time", subtitle: "Every service and store in one place", mascot: "wave" },
  { title: "Where are you off to? 🏃‍♂️", subtitle: "The offer is still on — one minute, then go", mascot: "moto" },
  { title: "Whoa, that was fast! 😄", subtitle: "Five seconds… you might spot something you like", mascot: "moto" },
  { title: "We won't bother you… but 👀", subtitle: "There's a really good offer here, don't miss it", mascot: "peek" },
  { title: "You might regret closing this 😌", subtitle: "Not a threat — friendly advice", mascot: "lounge" },
  { title: "Come over here a sec 👋", subtitle: "Kaheel gathered it all — all that's left is a look", mascot: "peek" },
  { title: "Honestly? This one is good 🔥", subtitle: "And if you don't like it, close it — no hard feelings", mascot: "lounge" },
  { title: "One minute is plenty ⏱️", subtitle: "See the offers, then it's all yours", mascot: "moto" },
  { title: "Don't say we didn't tell you! 🙈", subtitle: "Now you know — the call is yours", mascot: "peek" },
  { title: "The offer is waiting 🎁", subtitle: "Wait too long and someone else takes it", mascot: "wave" },
  { title: "Kaheel loves you 💜", subtitle: "That's why we brought you the best offers", mascot: "lounge" },
];

/** Picks a stable random line for the current mount. */
export function pickPopupCopy(ar: boolean, seed = Math.random()): PopupCopy {
  const pool = ar ? AR_POOL : EN_POOL;
  return pool[Math.floor(seed * pool.length) % pool.length]!;
}

// ── Entry side ─────────────────────────────────────────────────────────────
export type PopupSide = "bottom" | "top" | "left" | "right";
export const POPUP_SIDES: PopupSide[] = ["bottom", "top", "left", "right"];

/** Random side, used when a campaign leaves `popup_side` on `auto`. */
export function pickPopupSide(seed = Math.random()): PopupSide {
  return POPUP_SIDES[Math.floor(seed * POPUP_SIDES.length) % POPUP_SIDES.length]!;
}

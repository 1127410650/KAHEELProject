/**
 * Default copy for the popup campaigns (welcome takeover, category popups).
 *
 * Providers can set `title_ar/subtitle_ar` (and the English pair) per campaign
 * from the admin panel. When a campaign leaves them empty we fall back to one of
 * these friendly lines — simplified Modern Standard Arabic with a light Syrian
 * touch, always warm and respectful.
 */
export type PopupCopy = { title: string; subtitle: string };

// Add new lines by appending to these arrays — nothing else needs to change.
const AR_POOL: PopupCopy[] = [
  { title: "لا تروح بعيد… كل شي بتدوّر عليه هون بكَحيل 👋", subtitle: "تصفّح العروض القريبة منك بخطوة واحدة" },
  { title: "شو رأيك تشوف العروض قبل ما تطير؟ 🎁", subtitle: "عروض اليوم مختارة بعناية لك" },
  { title: "عم نجهّزلك أحلى العروض… تفضّل شوفها", subtitle: "مزوّدون موثوقون وأسعار واضحة" },
  { title: "فرصتك اليوم… وبكرا منشوف غيرها 😊", subtitle: "ألقِ نظرة سريعة قبل أن تنتهي" },
  { title: "أهلًا فيك بكَحيل… خلّينا نوفّر عليك الوقت", subtitle: "كل الخدمات والمتاجر في مكان واحد" },
  { title: "وين رايح؟ 🏃‍♂️", subtitle: "العرض لسا ما خلص… تعا شوفه دقيقة وبعدين روح" },
  { title: "لك شو هالسرعة! 😄", subtitle: "خمس ثواني بس… يمكن تلاقي شي يعجبك" },
  { title: "ما بدنا نزعجك… بس 👀", subtitle: "في عرض هون كتير منيح، وحرام يفوتك" },
  { title: "إذا سكّرت رح تندم 😌", subtitle: "مو تهديد… نصيحة من قلب" },
  { title: "تعا لهون شوي 👋", subtitle: "كَحيل جمّعلك كل شي… وما بقى إلا تشوف" },
  { title: "صراحة؟ العرض هيدا حلو 🔥", subtitle: "وإذا ما عجبك، سكّر ونحنا مو زعلانين" },
  { title: "دقيقة بس وبتكفّي ⏱️", subtitle: "شوف العروض وبعدين إنت وشطارتك" },
  { title: "لا تقلي ما شفت! 🙈", subtitle: "خلص صار عندك علم… القرار إلك" },
  { title: "العرض عم يستنّاك 🎁", subtitle: "وإذا تأخرت… بيروح لغيرك" },
  { title: "كَحيل بيحبك 💜", subtitle: "وعشان هيك جابلك أحلى العروض" },
];

const EN_POOL: PopupCopy[] = [
  { title: "Everything you need is right here 👋", subtitle: "Browse nearby offers in one tap" },
  { title: "Care to see today's offers first? 🎁", subtitle: "Hand-picked deals, just for you" },
  { title: "We lined up the best offers for you", subtitle: "Trusted providers, clear prices" },
  { title: "Today's chance — tomorrow brings more 😊", subtitle: "Take a quick look before it ends" },
  { title: "Where are you off to? 🏃‍♂️", subtitle: "The offer is still on — one minute, then go" },
  { title: "Whoa, that was fast! 😄", subtitle: "Five seconds… you might spot something you like" },
  { title: "We won't bother you… but 👀", subtitle: "There's a really good offer here, don't miss it" },
  { title: "You might regret closing this 😌", subtitle: "Not a threat — friendly advice" },
  { title: "Come over here a sec 👋", subtitle: "Kaheel gathered it all — all that's left is a look" },
  { title: "Honestly? This one is good 🔥", subtitle: "And if you don't like it, close it — no hard feelings" },
  { title: "One minute is plenty ⏱️", subtitle: "See the offers, then it's all yours" },
  { title: "Don't say we didn't tell you! 🙈", subtitle: "Now you know — the call is yours" },
  { title: "The offer is waiting 🎁", subtitle: "Wait too long and someone else takes it" },
  { title: "Kaheel loves you 💜", subtitle: "That's why we brought you the best offers" },
];


/** Picks a stable random line for the current mount. */
export function pickPopupCopy(ar: boolean, seed = Math.random()): PopupCopy {
  const pool = ar ? AR_POOL : EN_POOL;
  return pool[Math.floor(seed * pool.length) % pool.length]!;
}

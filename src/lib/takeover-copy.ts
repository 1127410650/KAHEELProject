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
  // مشهد الطرد الساقط
  { title: "أوف… وصلتك بخير! 📦", subtitle: "امسك العرض يا كابتن، في ناس رح تسرقه منك 😄", mascot: "parcel" },
  { title: "طلعت من الصندوق مشانك بس! 🙋‍♂️", subtitle: "وإذا ما مسكت العرض، بس بس… بس بس", mascot: "parcel" },
  { title: "كسّرت ظهري وأنا نازل! 😩", subtitle: "يعني الأقل تشوف العرض شوي", mascot: "parcel" },
  { title: "الطرد وصل… وأنا كمان 📦", subtitle: "خد العرض ولا تسأل شو صار فيني", mascot: "parcel" },
  { title: "وقعت من فوق ومو زعلان 😌", subtitle: "المهم وصلك العرض سالم", mascot: "parcel" },
  // مشهد الشخصية المستلقية
  { title: "لك يا حرام… زعلتني عليك 😂", subtitle: "كنت ضايع بدوني، اعترف!", mascot: "lounge" },
  { title: "أنا مرتاح وإنت عم تتفرّج؟ 😎", subtitle: "قوم شوف العرض وريّحني", mascot: "lounge" },
  // مشهد الدبّاب
  { title: "لك وين مسرّع يا معلّم؟ 🏍️", subtitle: "العرض هون، ما بدو منك غير ثانيتين", mascot: "moto" },
  { title: "لحقتك بالدبّاب! 🏍️💨", subtitle: "مشان ما يفوتك هالعرض، شو هالتعب", mascot: "moto" },
  // مشهد يطل بفضول
  { title: "عم راقبك من زمان 👀", subtitle: "وشكلك محتاج هالعرض أكتر مني", mascot: "peek" },
  { title: "لا تخاف… أنا بس 🙈", subtitle: "جاي أذكّرك في عرض ناطرك", mascot: "peek" },
  { title: "شفتك وإنت بتتجاهلني 😏", subtitle: "طيب شوف العرض وبعدين تجاهلني", mascot: "peek" },
  // مشهد الوداع
  { title: "ماشي… روح الله معك 👋", subtitle: "بس لا تقول ما قلتلك في عرض", mascot: "wave" },
  { title: "سكّر، سكّر… ما في زعل 😌", subtitle: "بس بكرا لا تقول ما حدا خبّرني", mascot: "wave" },
  { title: "راجع؟ عرفت إنك بترجع 😄", subtitle: "العرض لسا هون، ما راح لحدا", mascot: "wave" },
  // «الزعيم كَحيلان — ابن خالتو لكَحيل»: زعامة فكاهية بلا عدوانية
  { title: "تعرف مع مين عم تحكي؟ 😤", subtitle: "أنا الزعيم كَحيلان… وهالعرض بأمري إلك", mascot: "boss" },
  { title: "لف الشماغ وقال… 🧣", subtitle: "العرض هاد ما بيروح إلا لواحد ذكي مثلك", mascot: "boss" },
  { title: "أنا ابن خالتو لكَحيل! 😎", subtitle: "يعني العرض من عند الأهل، خدو ولا تحرجني", mascot: "boss" },
  { title: "شو؟ رح تسكّر بوجهي؟ 😠", subtitle: "طيب سكّر… بس بعد ما تشوف العرض", mascot: "boss" },
  { title: "هون أنا الزعيم 👉", subtitle: "والعرض أمر مني، ما في نقاش", mascot: "boss" },
  { title: "لا تخليني أعصّب 😤", subtitle: "شوف العرض بالذوق أحسنلك 😄", mascot: "boss" },
  { title: "كلمة زعيم وخلصنا 🧣", subtitle: "هالعرض إلك، ولا حدا بيقدر ياخده", mascot: "boss" },
  { title: "أنا ما بحب الرفض 😏", subtitle: "بس منك… ماشي، شوف العرض وبس", mascot: "boss" },
  // نصوص عامة سابقة — محفوظة كما هي
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
  { title: "العرض عم يستنّاك 🎁", subtitle: "وإذا تأخرت… بيروح لغيرك", mascot: "parcel" },
  { title: "كَحيل بيحبك 💜", subtitle: "وعشان هيك جابلك أحلى العروض", mascot: "lounge" },
  // مشهد التعارف بالشخصيتين
  {
    title: "تعرّف علينا! 👋",
    subtitle: "أنا كَحيلان… وهاد ابن خالتي كَحيل، وسوا منجيبلك أحلى العروض 😎",
    mascot: "duo",
  },
  {
    title: "صار لازم نتعرّف 🧣",
    subtitle: "أنا الزعيم كَحيلان، وهاد كَحيل… ومن هون وطالع العروض علينا",
    mascot: "duo",
  },
  {
    title: "أهلًا وسهلًا فيك 💜",
    subtitle: "كَحيل وكَحيلان بخدمتك، وما منقصّر",
    mascot: "duo",
  },
];

const EN_POOL: PopupCopy[] = [
  // Parcel drop
  { title: "Phew… delivered in one piece! 📦", subtitle: "Grab the offer, captain — someone else is eyeing it 😄", mascot: "parcel" },
  { title: "I climbed out of the box just for you! 🙋‍♂️", subtitle: "And if you skip the offer… well, well", mascot: "parcel" },
  { title: "I nearly broke my back landing here! 😩", subtitle: "The least you can do is take a look", mascot: "parcel" },
  { title: "The parcel arrived… and so did I 📦", subtitle: "Take the offer, don't ask how I got here", mascot: "parcel" },
  { title: "Fell from up there and I'm still fine 😌", subtitle: "What matters is your offer arrived safe", mascot: "parcel" },
  // Lounging
  { title: "Aww… now you got me sulking 😂", subtitle: "You were lost without me, admit it!", mascot: "lounge" },
  { title: "I'm comfy and you're just watching? 😎", subtitle: "Go check the offer and put me at ease", mascot: "lounge" },
  // Scooter
  { title: "Where's the rush, boss? 🏍️", subtitle: "The offer is right here — two seconds, tops", mascot: "moto" },
  { title: "Caught up with you on my scooter! 🏍️💨", subtitle: "All so you wouldn't miss this one", mascot: "moto" },
  // Peeking
  { title: "I've been watching a while 👀", subtitle: "And you need this offer more than I do", mascot: "peek" },
  { title: "Don't worry… it's only me 🙈", subtitle: "Just here to mention an offer waiting for you", mascot: "peek" },
  { title: "I saw you ignoring me 😏", subtitle: "Fine — see the offer, then ignore me", mascot: "peek" },
  // Farewell
  { title: "Alright… take care 👋", subtitle: "Just don't say we never mentioned an offer", mascot: "wave" },
  { title: "Close it, close it… no hard feelings 😌", subtitle: "Only don't say nobody told you tomorrow", mascot: "wave" },
  { title: "Back already? Knew you would 😄", subtitle: "The offer is still here, nobody took it", mascot: "wave" },
  // "Chief Kaheelan — Kaheel's cousin": mock bossiness, all in good fun
  { title: "Do you know who you're talking to? 😤", subtitle: "I'm Chief Kaheelan… and this offer is yours by my order", mascot: "boss" },
  { title: "He flicked the shemagh and said… 🧣", subtitle: "This offer only goes to someone smart like you", mascot: "boss" },
  { title: "I'm Kaheel's own cousin! 😎", subtitle: "So the offer comes from family — take it, don't embarrass me", mascot: "boss" },
  { title: "What? Closing it on my face? 😠", subtitle: "Fine, close it… right after you see the offer", mascot: "boss" },
  { title: "Around here, I'm the chief 👉", subtitle: "And the offer is my order — no discussion", mascot: "boss" },
  { title: "Don't make me get cross 😤", subtitle: "Just take a nice look at the offer 😄", mascot: "boss" },
  { title: "The chief has spoken 🧣", subtitle: "This offer is yours, nobody else can take it", mascot: "boss" },
  { title: "I don't take no for an answer 😏", subtitle: "But from you… fine. Just see the offer", mascot: "boss" },
  // Earlier general lines — kept as they were
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
  { title: "The offer is waiting 🎁", subtitle: "Wait too long and someone else takes it", mascot: "parcel" },
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

/** Pool size for the current locale — used by the rotation to avoid repeats. */
export function popupCopyCount(ar: boolean): number {
  return (ar ? AR_POOL : EN_POOL).length;
}

/** Copy at a given index (wrapped), so the pacer can rotate deterministically. */
export function popupCopyAt(ar: boolean, index: number): PopupCopy {
  const pool = ar ? AR_POOL : EN_POOL;
  const size = pool.length;
  return pool[((index % size) + size) % size]!;
}

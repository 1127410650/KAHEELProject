/**
 * نصوص النوافذ الترويجية، موزّعة على شخصيتَي المنصة حسب نبرة كل رسالة.
 *
 * توزيع الأدوار (مرجع ثابت):
 * • «كَحيل» — الوجه الرسمي: الترحيب، التعريف، الشكر، الطمأنة، التوجيه. نبرة
 *   مؤدبة هادئة بلا ضغط. مشاهده: `wave` / `lounge` / `peek`.
 * • «الزعيم كَحيلان» — ابن خالته وزعيم الحارة: العروض، الخصومات، التشويق،
 *   المزاح. تهديداته مزحة واضحة تنتهي بابتسامة. مشاهده: `boss` / `parcel` / `moto`.
 * • مشهد التعارف `duo` — كَحيلان يقدّم نفسه ثم يقدّم كَحيل.
 *
 * كل سطر يسمّي مشهده، فالمشهد يحدّد الشخصية عبر `MASCOT_PERSONA`، وبهذا لا
 * تختلف نبرة النص عن الشخصية الظاهرة في الرسم أبدًا.
 *
 * المزوّد يقدر يكتب `title_ar/subtitle_ar` (والزوج الإنجليزي) لكل حملة من لوحة
 * الإدارة؛ وعند تركها فارغة نستخدم أحد هذه السطور.
 */
import type { MascotKind } from "@/components/marketplace/campaign/PopupMascot";

export type PopupCopy = { title: string; subtitle: string; mascot: MascotKind };

// أضف سطورًا جديدة بإلحاقها بهذه المصفوفات — لا شيء آخر يحتاج تعديلًا.
const AR_POOL: PopupCopy[] = [
  // ── كَحيل: ترحيب وتعريف وشكر وطمأنة وتوجيه ──────────────────────────────
  { title: "أهلًا وسهلًا فيك 💜", subtitle: "نورت كَحيل، وإذا احتجت شي أنا موجود", mascot: "wave" },
  { title: "أهلًا فيك بكَحيل 👋", subtitle: "كل الخدمات والمتاجر في مكان واحد، ومنوفّر عليك الوقت", mascot: "wave" },
  { title: "تشرّفنا بزيارتك 🙏", subtitle: "تصفّح براحتك، وأنا جاهز لأي مساعدة", mascot: "wave" },
  { title: "شكرًا لثقتك 💜", subtitle: "منقدّر وقتك، ومنشتغل ليصير كل شي أسهل عليك", mascot: "wave" },
  { title: "رجعت؟ نورتنا 😊", subtitle: "كل شي مرتّب كما تركته", mascot: "wave" },
  { title: "بالخدمة دائمًا 🤝", subtitle: "كَحيل معك من أول سؤال لآخر خطوة", mascot: "wave" },
  { title: "خد وقتك بالتصفّح 😊", subtitle: "المزوّدون موثوقون والأسعار واضحة", mascot: "lounge" },
  { title: "ما في استعجال 🌿", subtitle: "راحتك أهم شي، والعروض تبقى موجودة", mascot: "lounge" },
  { title: "كل شي محفوظ عندك 👌", subtitle: "طلباتك ومحادثاتك بتلاقيها وقت ما بدك", mascot: "lounge" },
  { title: "عم نجهّزلك أحلى العروض 🌸", subtitle: "مزوّدون موثوقون وأسعار واضحة", mascot: "lounge" },
  { title: "تذكير صغير 🔔", subtitle: "في عروض قريبة منك، إذا حبيت تشوفها", mascot: "peek" },
  { title: "ما بدنا نزعجك 🙂", subtitle: "بس حبينا نخبرك في جديد بالقرب منك", mascot: "peek" },
  { title: "محتاج مساعدة؟ 💬", subtitle: "اسألنا وقت ما بدك، ومنجاوبك بأسرع وقت", mascot: "peek" },
  { title: "معلومة سريعة ℹ️", subtitle: "منقدر نوصّلك بالمزوّد المناسب بخطوة واحدة", mascot: "peek" },
  { title: "إذا ما لقيت اللي بدك 🌷", subtitle: "خبّرنا ومنساعدك نلاقيه", mascot: "peek" },

  // ── الزعيم كَحيلان: عروض وتشويق ومزاح زعامة ─────────────────────────────
  { title: "تعرف مع مين عم تحكي؟ 😤", subtitle: "أنا الزعيم كَحيلان… وهالعرض بأمري إلك", mascot: "boss" },
  { title: "لف الشماغ وقال… 🧣", subtitle: "العرض هاد ما بيروح إلا لواحد ذكي مثلك", mascot: "boss" },
  { title: "أنا ابن خالتو لكَحيل! 😎", subtitle: "يعني العرض من عند الأهل، خدو ولا تحرجني", mascot: "boss" },
  { title: "شو؟ رح تسكّر بوجهي؟ 😠", subtitle: "طيب سكّر… بس بعد ما تشوف العرض", mascot: "boss" },
  { title: "هون أنا الزعيم 👉", subtitle: "والعرض أمر مني، ما في نقاش", mascot: "boss" },
  { title: "لا تخليني أعصّب 😤", subtitle: "شوف العرض بالذوق أحسنلك 😄", mascot: "boss" },
  { title: "كلمة زعيم وخلصنا 🧣", subtitle: "هالعرض إلك، ولا حدا بيقدر ياخده", mascot: "boss" },
  { title: "أنا ما بحب الرفض 😏", subtitle: "بس منك… ماشي، شوف العرض وبس", mascot: "boss" },
  { title: "أنا مرتاح وإنت عم تتفرّج؟ 😎", subtitle: "قوم شوف العرض وريّحني", mascot: "boss" },
  { title: "لك يا حرام… زعلتني عليك 😂", subtitle: "كنت ضايع بدوني، اعترف!", mascot: "boss" },
  { title: "عم راقبك من زمان 👀", subtitle: "وشكلك محتاج هالعرض أكتر مني", mascot: "boss" },
  { title: "شفتك وإنت بتتجاهلني 😏", subtitle: "طيب شوف العرض وبعدين تجاهلني", mascot: "boss" },
  { title: "إذا سكّرت رح تندم 😌", subtitle: "مو تهديد… نصيحة من قلب 😄", mascot: "boss" },
  { title: "ماشي… روح الله معك 👋", subtitle: "بس لا تقول ما قلتلك في عرض", mascot: "boss" },
  { title: "سكّر، سكّر… ما في زعل 😌", subtitle: "بس بكرا لا تقول ما حدا خبّرني", mascot: "boss" },
  { title: "راجع؟ عرفت إنك بترجع 😄", subtitle: "العرض لسا هون، ما راح لحدا", mascot: "boss" },
  { title: "لا تقلي ما شفت! 🙈", subtitle: "خلص صار عندك علم… والقرار إلك", mascot: "boss" },
  { title: "صراحة؟ العرض هيدا حلو 🔥", subtitle: "وإذا ما عجبك، سكّر ونحنا مو زعلانين", mascot: "boss" },
  // كَحيلان يوصل العرض بنفسه — مشهد الطرد
  { title: "أوف… وصلتك بخير! 📦", subtitle: "امسك العرض يا كابتن، في ناس رح تسرقه منك 😄", mascot: "parcel" },
  { title: "طلعت من الصندوق مشانك بس! 🙋‍♂️", subtitle: "وإذا ما مسكت العرض، بس بس… بس بس", mascot: "parcel" },
  { title: "كسّرت ظهري وأنا نازل! 😩", subtitle: "يعني الأقل تشوف العرض شوي", mascot: "parcel" },
  { title: "الطرد وصل… وأنا كمان 📦", subtitle: "خد العرض ولا تسأل شو صار فيني", mascot: "parcel" },
  { title: "وقعت من فوق ومو زعلان 😌", subtitle: "المهم وصلك العرض سالم", mascot: "parcel" },
  { title: "العرض عم يستنّاك 🎁", subtitle: "وإذا تأخرت… بيروح لغيرك", mascot: "parcel" },
  // كَحيلان يلحق بالعرض — مشهد الدبّاب
  { title: "لك وين مسرّع يا معلّم؟ 🏍️", subtitle: "العرض هون، ما بدو منك غير ثانيتين", mascot: "moto" },
  { title: "لحقتك بالدبّاب! 🏍️💨", subtitle: "مشان ما يفوتك هالعرض، شو هالتعب", mascot: "moto" },
  { title: "وين رايح؟ 🏃‍♂️", subtitle: "العرض لسا ما خلص… تعا شوفه دقيقة وبعدين روح", mascot: "moto" },
  { title: "لك شو هالسرعة! 😄", subtitle: "خمس ثواني بس… يمكن تلاقي شي يعجبك", mascot: "moto" },
  { title: "دقيقة بس وبتكفّي ⏱️", subtitle: "شوف العروض وبعدين إنت وشطارتك", mascot: "moto" },
  { title: "شو رأيك تشوف العروض قبل ما تطير؟ 🎁", subtitle: "عروض اليوم مختارة بعناية إلك", mascot: "moto" },

  // ── كَحيلان بالأكلات الشامية: زيتون إدلبي بأربع لهجات ────────────────────
  { title: "جبتلك زيتون من إدلب 🫒", subtitle: "وهاد العرض كمان بواسطتي… تفضّل ولا تحرجني", mascot: "olives" },
  { title: "زيتون حلبي بالفليفلة 🌶️🫒", subtitle: "وهالعرض مدقوق دق حلبي… بواسطتي طبعًا", mascot: "olives" },
  { title: "زيتون ساحلي بزيت الزيتون 🫒", subtitle: "طازة من الجبل، متل هالعرض اللي جبتو بواسطتي", mascot: "olives" },
  { title: "زيتون شامي مرصّص 🫒", subtitle: "وهالعرض من عندي أنا، ولا تنسى الفضل", mascot: "olives" },
  // ── كَحيلان وحلاوة الجبن: شايل الصينية ويفتل شواربه ──────────────────────
  { title: "حلاوة الجبن! 🍮", subtitle: "لا من حماة ولا من حمص… حلاوة الجبن كَحيل وبس 😎", mascot: "tray" },
  { title: "شايلها بإيديّ مشانك 🍮", subtitle: "وهالعرض كمان بواسطتي، ما تنسى", mascot: "tray" },
  { title: "شفت الصينية؟ 🧔", subtitle: "متل ما جبت الحلاوة، جبتلك العروض… بواسطتي", mascot: "mustache" },
  { title: "حلاوة جبن كَحيلية أصلية 🍮", subtitle: "واللي بينكر الفضل، ما بيذوق 😄", mascot: "tray" },

  // ── مشهد التعارف: كَحيلان يقدّم نفسه ثم يقدّم كَحيل ──────────────────────
  {
    title: "أنا الزعيم كَحيلان… زعيم الحارة 🧣",
    subtitle: "وهاد ابن خالتي كَحيل، مؤدب ومحترم، ومنجيبلكم أحلى العروض سوا 😎",
    mascot: "duo",
  },
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

  // ── كَحيل: ترحيبات قصيرة جدًا (سطر واحد ≤ 35 حرفًا) للمساحات الصغيرة ─────
  { title: "يا هلا يا أبو عيون كَحيلة 😍", subtitle: "نورت كَحيل", mascot: "wave" },
  { title: "أهلين… عيونك كَحيلة والعروض أحلى ✨", subtitle: "تفضّل تصفّح", mascot: "wave" },
  { title: "يا مرحبا بأبو العيون الكَحيلة 💜", subtitle: "أهلًا فيك", mascot: "wave" },
  { title: "نوّرت… يا صاحب العيون الكَحيلة 🌟", subtitle: "بالخدمة دائمًا", mascot: "wave" },
  { title: "هلا والله… كَحيل بعيونك 😊", subtitle: "خد وقتك", mascot: "wave" },
];

const EN_POOL: PopupCopy[] = [
  // ── Kaheel: welcome, intro, thanks, reassurance, guidance ───────────────
  { title: "Welcome — glad you're here 💜", subtitle: "I'm Kaheel. If you need anything, I'm right here", mascot: "wave" },
  { title: "Welcome to Kaheel 👋", subtitle: "Every service and store in one place, to save you time", mascot: "wave" },
  { title: "Thanks for stopping by 🙏", subtitle: "Browse at your own pace — happy to help anytime", mascot: "wave" },
  { title: "Thank you for your trust 💜", subtitle: "We value your time and keep making things simpler", mascot: "wave" },
  { title: "Back again? Lovely 😊", subtitle: "Everything is just as you left it", mascot: "wave" },
  { title: "At your service, always 🤝", subtitle: "Kaheel is with you from the first question to the last step", mascot: "wave" },
  { title: "Take your time browsing 😊", subtitle: "Trusted providers and clear prices", mascot: "lounge" },
  { title: "No rush at all 🌿", subtitle: "Your comfort comes first — the offers will still be here", mascot: "lounge" },
  { title: "Everything is saved for you 👌", subtitle: "Your orders and chats are here whenever you need them", mascot: "lounge" },
  { title: "We're lining up great offers 🌸", subtitle: "Trusted providers, clear pricing", mascot: "lounge" },
  { title: "Just a small reminder 🔔", subtitle: "There are offers near you, if you'd like a look", mascot: "peek" },
  { title: "We don't mean to interrupt 🙂", subtitle: "Only letting you know what's new nearby", mascot: "peek" },
  { title: "Need a hand? 💬", subtitle: "Ask anytime — we'll get back to you quickly", mascot: "peek" },
  { title: "Quick note ℹ️", subtitle: "We can connect you with the right provider in one step", mascot: "peek" },
  { title: "Didn't find what you need? 🌷", subtitle: "Tell us and we'll help you find it", mascot: "peek" },

  // ── Chief Kaheelan: offers, teasers, playful bossiness ──────────────────
  { title: "Do you know who you're talking to? 😤", subtitle: "I'm Chief Kaheelan… and this offer is yours by my order", mascot: "boss" },
  { title: "He flicked the shemagh and said… 🧣", subtitle: "This offer only goes to someone smart like you", mascot: "boss" },
  { title: "I'm Kaheel's own cousin! 😎", subtitle: "So the offer comes from family — take it, don't embarrass me", mascot: "boss" },
  { title: "What? Closing it on my face? 😠", subtitle: "Fine, close it… right after you see the offer", mascot: "boss" },
  { title: "Around here, I'm the chief 👉", subtitle: "And the offer is my order — no discussion", mascot: "boss" },
  { title: "Don't make me get cross 😤", subtitle: "Just take a nice look at the offer 😄", mascot: "boss" },
  { title: "Chief's word, case closed 🧣", subtitle: "This offer is yours and nobody can take it", mascot: "boss" },
  { title: "I don't take no for an answer 😏", subtitle: "But from you… fine, just see the offer", mascot: "boss" },
  { title: "I'm comfy and you're just watching? 😎", subtitle: "Go check the offer and put me at ease", mascot: "boss" },
  { title: "Aww… now you got me sulking 😂", subtitle: "You were lost without me, admit it!", mascot: "boss" },
  { title: "I've been watching a while 👀", subtitle: "And you need this offer more than I do", mascot: "boss" },
  { title: "I saw you ignoring me 😏", subtitle: "Fine — see the offer, then ignore me", mascot: "boss" },
  { title: "Close it and you'll regret it 😌", subtitle: "Not a threat… friendly advice 😄", mascot: "boss" },
  { title: "Alright… take care 👋", subtitle: "Just don't say we never mentioned an offer", mascot: "boss" },
  { title: "Close it, close it… no hard feelings 😌", subtitle: "Only don't say nobody told you tomorrow", mascot: "boss" },
  { title: "Back already? Knew you would 😄", subtitle: "The offer is still here, nobody took it", mascot: "boss" },
  { title: "Don't tell me you didn't see it! 🙈", subtitle: "Now you know — the choice is yours", mascot: "boss" },
  { title: "Honestly? This offer is good 🔥", subtitle: "And if you don't like it, close it — no hard feelings", mascot: "boss" },
  // Kaheelan delivers the offer himself — parcel scene
  { title: "Phew… delivered in one piece! 📦", subtitle: "Grab the offer, captain — someone else is eyeing it 😄", mascot: "parcel" },
  { title: "I climbed out of the box just for you! 🙋‍♂️", subtitle: "And if you skip the offer… well, well", mascot: "parcel" },
  { title: "I nearly broke my back landing here! 😩", subtitle: "The least you can do is take a look", mascot: "parcel" },
  { title: "The parcel arrived… and so did I 📦", subtitle: "Take the offer, don't ask how I got here", mascot: "parcel" },
  { title: "Fell from up there and I'm still fine 😌", subtitle: "What matters is your offer arrived safe", mascot: "parcel" },
  { title: "Your offer is waiting 🎁", subtitle: "Wait too long and it goes to someone else", mascot: "parcel" },
  // Kaheelan races after you — scooter scene
  { title: "Where's the rush, boss? 🏍️", subtitle: "The offer is right here — two seconds, tops", mascot: "moto" },
  { title: "Caught up with you on my scooter! 🏍️💨", subtitle: "All so you wouldn't miss this one", mascot: "moto" },
  { title: "Where are you off to? 🏃‍♂️", subtitle: "The offer isn't over — one minute, then go", mascot: "moto" },
  { title: "What's the hurry! 😄", subtitle: "Five seconds… you might find something you like", mascot: "moto" },
  { title: "One minute is plenty ⏱️", subtitle: "See the offers, then you're on your way", mascot: "moto" },
  { title: "Fancy a look before you fly off? 🎁", subtitle: "Today's offers, hand-picked for you", mascot: "moto" },

  // ── Kaheelan and Levantine food: Idlib olives in four local accents ─────
  { title: "Brought you olives from Idlib 🫒", subtitle: "And this offer came through me too — go on, don't embarrass me", mascot: "olives" },
  { title: "Aleppo olives with chili 🌶️🫒", subtitle: "This offer is pounded Aleppo-style… through me, naturally", mascot: "olives" },
  { title: "Coastal olives in olive oil 🫒", subtitle: "Fresh off the mountain, like this offer I brought through me", mascot: "olives" },
  { title: "Damascene cracked olives 🫒", subtitle: "And this offer is from me — don't forget who to thank", mascot: "olives" },
  // ── Kaheelan with halawet el-jibn: tray in hand, mustache twirled ────────
  { title: "Halawet el-jibn! 🍮", subtitle: "Not from Hama, not from Homs… it's pure Kaheel 😎", mascot: "tray" },
  { title: "Carrying it in my own hands 🍮", subtitle: "And this offer came through me too — don't forget", mascot: "tray" },
  { title: "See the tray? 🧔", subtitle: "Just like the sweets, I brought you the offers… through me", mascot: "mustache" },
  { title: "Original Kaheelan halawet el-jibn 🍮", subtitle: "Deny who brought it, and you don't get a taste 😄", mascot: "tray" },

  // ── Intro scene: Kaheelan introduces himself, then Kaheel ───────────────
  {
    title: "I'm Chief Kaheelan… chief of the block 🧣",
    subtitle: "And this is my cousin Kaheel — polite and proper. Together we bring you the best offers 😎",
    mascot: "duo",
  },
  {
    title: "Let's get acquainted! 👋",
    subtitle: "I'm Kaheelan… and this is my cousin Kaheel. Together we bring you the best offers 😎",
    mascot: "duo",
  },
  {
    title: "About time we met 🧣",
    subtitle: "I'm Chief Kaheelan, and this is Kaheel… from here on, the offers are on us",
    mascot: "duo",
  },

  // ── Kaheel: very short one-line greetings (≤ 35 chars) for tight spots ───
  { title: "Hey there, bright eyes 😍", subtitle: "You lit up Kaheel", mascot: "wave" },
  { title: "Hello… lovely eyes, lovelier offers ✨", subtitle: "Go on, browse", mascot: "wave" },
  { title: "Welcome, you with the kohl eyes 💜", subtitle: "Glad you're here", mascot: "wave" },
  { title: "You brightened the place 🌟", subtitle: "At your service", mascot: "wave" },
  { title: "Hey! Kaheel salutes those eyes 😊", subtitle: "Take your time", mascot: "wave" },
];

/**
 * قاعدة كَحيلان الثابتة: كل عرض جاء «بواسطتي». إذا كان السطر لا يذكرها،
 * نضيف لمسة قصيرة تحفظ نبرة الزعامة الفكاهية بلا إساءة.
 */
const KAHEELAN_SCENES: MascotKind[] = ["boss", "parcel", "moto", "olives", "mustache", "tray"];
const CREDIT_RE = /بواسطتي|من عندي أنا|بأمري|through me|by my order|from me —/;

function withKaheelanCredit(copy: PopupCopy, ar: boolean): PopupCopy {
  if (!KAHEELAN_SCENES.includes(copy.mascot) || CREDIT_RE.test(copy.subtitle)) return copy;
  return {
    ...copy,
    subtitle: ar
      ? `${copy.subtitle} — وهالعرض بواسطتي 😎`
      : `${copy.subtitle} — and this offer came through me 😎`,
  };
}

export function pickPopupCopy(ar: boolean, seed = Math.random()): PopupCopy {
  const pool = ar ? AR_POOL : EN_POOL;
  return withKaheelanCredit(pool[Math.floor(seed * pool.length) % pool.length]!, ar);
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
  return withKaheelanCredit(pool[((index % size) + size) % size]!, ar);
}

// ── نصوص الزعيم كَحيلان وحده: هو الشخصية التي تسقط عند اللمس ────────────────
const AR_BOSS = AR_POOL.filter((copy) => copy.mascot === "boss");
const EN_BOSS = EN_POOL.filter((copy) => copy.mascot === "boss");

/** عدد نصوص الزعيم كَحيلان للغة الحالية. */
export function bossCopyCount(ar: boolean): number {
  return (ar ? AR_BOSS : EN_BOSS).length;
}

/** نص الزعيم كَحيلان عند فهرس معيّن (بالتدوير) مع لاحقة «بواسطتي». */
export function bossCopyAt(ar: boolean, index: number): PopupCopy {
  const pool = ar ? AR_BOSS : EN_BOSS;
  const size = pool.length;
  return withKaheelanCredit(pool[((index % size) + size) % size]!, ar);
}

// ── مزحة الكبس المتكرر: الزعيم كَحيلان يتدخّل بمزح لطيف ───────────────────
const AR_RAPID: PopupCopy[] = [
  { title: "يكفي تكبس! كسرت الشاشة 😂", subtitle: "شوي شوي عليها، الله يخليك", mascot: "boss" },
  { title: "لك شو هالكبس؟ 😅", subtitle: "الشاشة بتوجعها، ارحمها", mascot: "boss" },
  { title: "بعد كل هالكبس؟ 🤣", subtitle: "طيب خلص، شو بدك؟ أنا موجود", mascot: "mustache" },
  { title: "إيدك سريعة أكتر مني 😄", subtitle: "خفّف كبس، ما حدا عم يزاحمك", mascot: "boss" },
  { title: "لك عالراحة يا كابتن 🧣", subtitle: "الشاشة ما رح تهرب، وأنا كمان", mascot: "mustache" },
];

const EN_RAPID: PopupCopy[] = [
  { title: "Enough tapping! You broke the screen 😂", subtitle: "Go easy on it, please", mascot: "boss" },
  { title: "What's with all the tapping? 😅", subtitle: "The screen has feelings — spare it", mascot: "boss" },
  { title: "After all that tapping? 🤣", subtitle: "Fine, fine — what do you need? I'm right here", mascot: "mustache" },
  { title: "Your finger is faster than me 😄", subtitle: "Ease up, nobody is racing you", mascot: "boss" },
  { title: "Take it easy, captain 🧣", subtitle: "The screen isn't running away, and neither am I", mascot: "mustache" },
];

/** عدد نصوص مزحة الكبس للغة الحالية. */
export function rapidTapCopyCount(ar: boolean): number {
  return (ar ? AR_RAPID : EN_RAPID).length;
}

/**
 * نص مزحة الكبس عند فهرس معيّن (بالتدوير) — يستخدمه المضيف لمنع التكرار المتتالي.
 * هنا لا نضيف لاحقة «بواسطتي»: المزحة عن كثرة الكبس لا عن عرض.
 */
export function rapidTapCopyAt(ar: boolean, index: number): PopupCopy {
  const pool = ar ? AR_RAPID : EN_RAPID;
  const size = pool.length;
  return pool[((index % size) + size) % size]!;
}

// ── دخول قسم «الناس»: كَحيلان يدخل من الجانب بحركة واثقة ويلف كوفيته ───────
/**
 * مشهد الدخول المعتمد لقسم الناس. النصوص بنبرة الزعامة الفكاهية، وكل واحد
 * ينتهي ضمنًا أو صراحة بأن الفضل «بواسطتي» (نفس قاعدة كَحيلان في كل المنصة).
 */
const AR_ENTRANCE: PopupCopy[] = [
  { title: "تغطّوا يا حريم… كَحيلان داخل! 😎", subtitle: "وصل الزعيم، ومن هلق كل شي بواسطتي", mascot: "boss" },
  { title: "وصل الزعيم 🧣", subtitle: "بدّك زبّطك بواسطتي؟", mascot: "mustache" },
  { title: "افسحوا الطريق 👑", subtitle: "كَحيلان بيزبّط كل شي… بواسطتي طبعًا", mascot: "boss" },
  { title: "أنا وصلت 😏", subtitle: "وأي شي بدّك ياه، بواسطتي", mascot: "mustache" },
];

const EN_ENTRANCE: PopupCopy[] = [
  { title: "Make way — Kaheelan is in! 😎", subtitle: "The boss has arrived, and from now on everything goes through me", mascot: "boss" },
  { title: "The boss is here 🧣", subtitle: "Want me to sort it out for you? Through me, of course", mascot: "mustache" },
  { title: "Clear the path 👑", subtitle: "Kaheelan fixes everything — through me, naturally", mascot: "boss" },
  { title: "I've arrived 😏", subtitle: "Whatever you need, it comes through me", mascot: "mustache" },
];

/** عدد نصوص مشهد الدخول للغة الحالية. */
export function entranceCopyCount(ar: boolean): number {
  return (ar ? AR_ENTRANCE : EN_ENTRANCE).length;
}

/** نص مشهد الدخول عند فهرس معيّن (بالتدوير) — المضيف يمنع التكرار المتتالي. */
export function entranceCopyAt(ar: boolean, index: number): PopupCopy {
  const pool = ar ? AR_ENTRANCE : EN_ENTRANCE;
  const size = pool.length;
  return withKaheelanCredit(pool[((index % size) + size) % size]!, ar);
}

// ── ترحيبات كَحيل القصيرة جدًا للمساحات الضيقة ───────────────────────────────
/**
 * سطر واحد ≤ 35 حرفًا بنبرة كَحيل المرحّبة (ودّية أنيقة بلا مشاكسة)، مخصّص
 * للأماكن الصغيرة: الشريط المتناوب في البحث، فقاعات الترحيب القصيرة، وبطاقات
 * الستوري المصغّرة. نفس هذه السطور موجودة في `AR_POOL`/`EN_POOL` كنصوص
 * مشهد `wave`، فيقدر المشرف يستبدلها بنص حملته من لوحة الإدارة.
 */
export type ShortGreeting = { ar: string; en: string };

export const SHORT_GREETINGS: ShortGreeting[] = [
  { ar: "يا هلا يا أبو عيون كَحيلة 😍", en: "Hey there, bright eyes 😍" },
  { ar: "أهلين… عيونك كَحيلة والعروض أحلى ✨", en: "Lovely eyes, lovelier offers ✨" },
  { ar: "يا مرحبا بأبو العيون الكَحيلة 💜", en: "Welcome, you with the kohl eyes 💜" },
  { ar: "نوّرت… يا صاحب العيون الكَحيلة 🌟", en: "You brightened the place 🌟" },
  { ar: "هلا والله… كَحيل بعيونك 😊", en: "Kaheel salutes those eyes 😊" },
];

/** نص الترحيب القصير عند فهرس معيّن (بالتدوير). */
export function shortGreetingAt(ar: boolean, index: number): string {
  const size = SHORT_GREETINGS.length;
  const item = SHORT_GREETINGS[((index % size) + size) % size]!;
  return ar ? item.ar : item.en;
}

/**
 * فهرس ترحيب عشوائي مع ضمان عدم التكرار المتتالي: نختار من بين البقية فقط،
 * فلا يظهر نفس السطر مرتين وراء بعض.
 */
export function nextShortGreetingIndex(previous = -1, seed = Math.random()): number {
  const size = SHORT_GREETINGS.length;
  if (size < 2) return 0;
  if (previous < 0) return Math.floor(seed * size) % size;
  const offset = 1 + (Math.floor(seed * (size - 1)) % (size - 1));
  return (previous + offset) % size;
}

// ── «كَحيلان يطلّ برأسه»: إطلالة صغيرة من الحافة، نبرة الواسطة الفكاهية ──────
/**
 * نصوص مشهد الإطلالة (رأس وكتف فقط من حافة الشاشة). كلها لكَحيلان — الواسطة
 * الفكاهية — ولا تحتاج لاحقة «بواسطتي» لأن الواسطة هي أصل المزحة هنا.
 */
const AR_PEEK: PopupCopy[] = [
  { title: "لو محتاج شي علّمني 👀", subtitle: "ترا عندي واسطة كبيرة", mascot: "boss" },
  { title: "بس همسة… 🤫", subtitle: "أنا واسطتك هون، لا تكسف", mascot: "boss" },
  { title: "شفتك محتار 😏", subtitle: "قلّي شو بدّك وأنا بدبّرها", mascot: "boss" },
  { title: "أنا الواسطة يا معلّم 🧣", subtitle: "كلمة مني وبتمشي أمورك", mascot: "boss" },
  { title: "مطوّل بالتفكير؟ 🤨", subtitle: "خلص، أنا بزبّطك… بواسطتي", mascot: "boss" },
  { title: "تكرم عينك 😎", subtitle: "بس قول وأنا بجيبلك ياها", mascot: "boss" },
  { title: "لا تحتار وتتعب حالك 💜", subtitle: "عندك واسطة، وأنا هي", mascot: "boss" },
];

const EN_PEEK: PopupCopy[] = [
  { title: "Need anything? Just say 👀", subtitle: "I've got serious connections", mascot: "boss" },
  { title: "Just a whisper… 🤫", subtitle: "I'm your inside man here — no need to be shy", mascot: "boss" },
  { title: "You look undecided 😏", subtitle: "Tell me what you need and I'll sort it", mascot: "boss" },
  { title: "I'm the connection, boss 🧣", subtitle: "One word from me and it's done", mascot: "boss" },
  { title: "Still thinking it over? 🤨", subtitle: "Enough — I'll fix it for you… through me", mascot: "boss" },
  { title: "Consider it done 😎", subtitle: "Just say the word and I'll bring it", mascot: "boss" },
  { title: "Don't tire yourself out 💜", subtitle: "You've got a connection — it's me", mascot: "boss" },
];

/** عدد نصوص الإطلالة للغة الحالية. */
export function peekCopyCount(ar: boolean): number {
  return (ar ? AR_PEEK : EN_PEEK).length;
}

/** نص الإطلالة عند فهرس معيّن (بالتدوير) — المضيف يمنع التكرار المتتالي. */
export function peekCopyAt(ar: boolean, index: number): PopupCopy {
  const pool = ar ? AR_PEEK : EN_PEEK;
  const size = pool.length;
  return pool[((index % size) + size) % size]!;
}

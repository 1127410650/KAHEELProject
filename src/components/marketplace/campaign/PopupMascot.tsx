/**
 * شخصيتا المنصة — مرجع ثابت واحد لكل النوافذ والرسوم.
 *
 * • «كَحيل» (persona: kaheel) — الوجه الرسمي للمنصة: مؤدّب، هادئ، مرتّب.
 *   شعر مرتب، حواجب مستوية هادئة، عينان مستديرتان ودودتان، ابتسامة لطيفة.
 * • «الزعيم كَحيلان» (persona: kaheelan) — ابن خالته وزعيم الحارة: شماغ وغترة،
 *   حاجب مرفوع وابتسامة خبيثة، شماغ ملفوف حول الرقبة. مزحة دائمًا، بلا إساءة.
 *
 * الرأس والشماغ مرسومان مرة واحدة في `KaheelHead` / `KaheelanHead` ويُعاد
 * استخدامهما في كل المشاهد، فيبقى مظهر كل شخصية متطابقًا من نافذة لأخرى.
 *
 * رسوم متجهية داخلية: لا طلب شبكة، لا هزّة تخطيط، والحركة CSS فقط ومعطّلة تحت
 * `prefers-reduced-motion`.
 */
export type MascotKind =
  | "moto"
  | "lounge"
  | "wave"
  | "peek"
  | "parcel"
  | "boss"
  | "duo"
  | "olives"
  | "mustache"
  | "tray";

export const MASCOT_KINDS: MascotKind[] = [
  "moto",
  "lounge",
  "wave",
  "peek",
  "parcel",
  "boss",
  "duo",
  "olives",
  "mustache",
  "tray",
];

/** أي شخصية يمثّلها كل مشهد — الإسناد ثابت ولا يتغيّر بين النوافذ. */
export type MascotPersona = "kaheel" | "kaheelan" | "duo";

export const MASCOT_PERSONA: Record<MascotKind, MascotPersona> = {
  // كَحيل: الترحيب والطمأنة والشكر والتوجيه
  wave: "kaheel",
  lounge: "kaheel",
  peek: "kaheel",
  // كَحيلان: العروض والتشويق والمزاح
  moto: "kaheelan",
  parcel: "kaheelan",
  boss: "kaheelan",
  olives: "kaheelan",
  mustache: "kaheelan",
  tray: "kaheelan",
  // مشهد التعارف بالشخصيتين
  duo: "duo",
};

const SKIN = "#f4c9a3";
const HAIR = "#240046";
const BODY = "#7b2cbf";
const BODY_DARK = "#5a189a";
const ACCENT = "#c77dff";
const CLOTH = "#f7f2fb";
const CLOTH_DARK = "#d8c7ea";

/** رأس مرسوم في فضاء نصف قطره 13 حول الأصل، ويُقاس لأي مشهد. */
const HEAD_R = 13;

function headTransform(x: number, y: number, r: number) {
  return `translate(${x} ${y}) scale(${(r / HEAD_R).toFixed(3)})`;
}

/** «كَحيل»: ملامح مؤدبة هادئة — نفس الرسم في كل مشهد. */
function KaheelHead({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={headTransform(x, y, r)}>
      <circle cx="0" cy="0" r="13" fill={SKIN} />
      {/* شعر مرتّب */}
      <path d="M-13-1a13 13 0 0 1 26 0z" fill={HAIR} />
      <path d="M-4-11c4 3 9 4 13 3" stroke={BODY_DARK} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      {/* حواجب مستوية هادئة */}
      <path d="M-8.5-5h5M3.5-5h5" stroke={HAIR} strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="-5" cy="1.5" r="2.5" fill={HAIR} />
      <circle cx="5" cy="1.5" r="2.5" fill={HAIR} />
      {/* ابتسامة لطيفة */}
      <path d="M-5 7q5 4 10 0" stroke={HAIR} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <circle cx="-9" cy="4.5" r="1.8" fill={ACCENT} opacity="0.45" />
      <circle cx="9" cy="4.5" r="1.8" fill={ACCENT} opacity="0.45" />
    </g>
  );
}

/**
 * «الزعيم كَحيلان»: غترة وشماغ، حاجب مرفوع وابتسامة خبيثة — مزح لا عدوانية.
 * `scarf` تضيف لفّة الشماغ حول الرقبة مع حركة الطرف الواثقة.
 */
function KaheelanHead({
  x,
  y,
  r,
  scarf = true,
  twirl = false,
}: {
  x: number;
  y: number;
  r: number;
  scarf?: boolean;
  /** يبرز الشارب وقت مشهد فتل الشوارب. */
  twirl?: boolean;
}) {
  return (
    <g transform={headTransform(x, y, r)}>
      {scarf ? (
        <>
          <path d="M-18 18c8 6 28 6 36 0l3 8c-10 7-32 7-42 0z" fill={CLOTH} />
          <g
            className="origin-[14px_20px] animate-[kaheel-mascot-boss-scarf_2.8s_ease-in-out_infinite] motion-reduce:animate-none"
            style={{ transformBox: "view-box" }}
          >
            <path d="M12 20c9 1 16 6 20 14l-8 3c-4-7-9-10-14-11z" fill={CLOTH_DARK} />
          </g>
        </>
      ) : null}
      {/* أطراف الغترة على الجانبين — ملاصقة للرأس */}
      <path d="M-14-2c0 12 4 20 8 24-7-3-11-12-11-24z" fill={CLOTH_DARK} />
      <path d="M14-2c0 12-4 20-8 24 7-3 11-12 11-24z" fill={CLOTH_DARK} />
      <circle cx="0" cy="0" r="13" fill={SKIN} />
      {/* الغترة على الرأس */}
      <path d="M-14.5-2a14.5 14.5 0 0 1 29 0v3c-4-4.5-9-6.5-14.5-6.5s-10.5 2-14.5 6.5z" fill={CLOTH} />
      <path d="M-15-2h30" stroke={CLOTH_DARK} strokeWidth="2.6" strokeLinecap="round" />
      {/* حاجب مرفوع وابتسامة خبيثة */}
      <path d="M-8-7l7 3M8-7l-7 3" stroke={HAIR} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="-5" cy="1" r="2.6" fill={HAIR} />
      <circle cx="6" cy="1" r="2.6" fill={HAIR} />
      <path d="M-6 9.5c4 2.5 9 1.5 11-2" stroke={HAIR} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {/* شارب معقوف — علامة ثابتة لكَحيلان في كل المشاهد */}
      <g
        className={
          twirl
            ? "origin-[0px_5px] animate-[kaheel-mascot-mustache_2.6s_ease-in-out_infinite] motion-reduce:animate-none"
            : undefined
        }
        style={twirl ? { transformBox: "view-box" } : undefined}
      >
        <path
          d="M0 5.5C-2 3.6-6 3.4-8.4 5.2-9.6 6.1-9 7.6-7.6 7.2-6 6.7-4 6-2.6 6.6M0 5.5C2 3.6 6 3.4 8.4 5.2 9.6 6.1 9 7.6 7.6 7.2 6 6.7 4 6 2.6 6.6"
          stroke={HAIR}
          strokeWidth="1.9"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </g>
  );
}


function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      role="presentation"
      aria-hidden="true"
      className={`size-full ${className ?? ""}`}
    >
      <circle cx="48" cy="48" r="46" fill={ACCENT} opacity="0.16" />
      {children}
    </svg>
  );
}

/** كَحيلان يلحق بالعرض على الدبّاب. */
function Moto() {
  return (
    <Frame className="animate-[kaheel-mascot-ride_1.4s_ease-in-out_infinite] motion-reduce:animate-none">
      <g stroke={ACCENT} strokeWidth="3" strokeLinecap="round" opacity="0.85">
        <path d="M8 40h14M6 52h18M12 64h12" />
      </g>
      <circle cx="36" cy="72" r="9" fill={HAIR} />
      <circle cx="36" cy="72" r="3.4" fill={ACCENT} />
      <circle cx="76" cy="72" r="9" fill={HAIR} />
      <circle cx="76" cy="72" r="3.4" fill={ACCENT} />
      <path d="M34 68h40l-6-14H44z" fill={BODY} />
      <path d="M70 54l10-10" stroke={BODY_DARK} strokeWidth="5" strokeLinecap="round" />
      <path d="M46 52c2-12 8-18 16-18l8 4-6 8-8 2-4 6z" fill={BODY_DARK} />
      <KaheelanHead x={66} y={26} r={9} scarf={false} />
    </Frame>
  );
}

/** كَحيل مرتاح ومطمئن. */
function Lounge() {
  return (
    <Frame className="animate-[kaheel-mascot-breathe_2.6s_ease-in-out_infinite] motion-reduce:animate-none">
      <rect x="14" y="60" width="68" height="14" rx="7" fill={BODY_DARK} />
      <path d="M22 60c8-8 20-10 30-8l22 4-2 10H24z" fill={BODY} />
      <path d="M52 54l16-10 4 6-14 10z" fill={BODY} />
      <path d="M60 46l14-12 5 5-13 13z" fill={BODY_DARK} />
      <KaheelHead x={30} y={46} r={12} />
    </Frame>
  );
}

/** كَحيل يرحّب ويلوّح. */
function Wave() {
  return (
    <Frame>
      <path d="M30 88V60a18 18 0 0 1 36 0v28z" fill={BODY} />
      <KaheelHead x={48} y={34} r={14} />
      <g
        className="origin-[68px_58px] animate-[kaheel-mascot-wave_1s_ease-in-out_infinite] motion-reduce:animate-none"
        style={{ transformBox: "view-box" }}
      >
        <path d="M64 60l14-16" stroke={BODY_DARK} strokeWidth="8" strokeLinecap="round" />
        <circle cx="80" cy="42" r="7" fill={SKIN} />
      </g>
    </Frame>
  );
}

/** كَحيل يطلّ بلطف ليذكّر بشيء. */
function Peek() {
  return (
    <Frame className="animate-[kaheel-mascot-peek_2.2s_ease-in-out_infinite] motion-reduce:animate-none">
      <path d="M6 96V62a20 20 0 0 1 40 0v34z" fill={BODY} />
      <KaheelHead x={30} y={38} r={15} />
      <rect x="56" y="4" width="36" height="88" rx="10" fill={BODY_DARK} opacity="0.35" />
    </Frame>
  );
}

/** كَحيلان يوصل العرض بنفسه داخل طرد. */
function Parcel() {
  return (
    <Frame className="animate-[kaheel-mascot-drop_2.4s_ease-in-out_infinite] motion-reduce:animate-none">
      <ellipse cx="48" cy="86" rx="30" ry="5" fill={HAIR} opacity="0.2" />
      <KaheelanHead x={48} y={30} r={10} scarf={false} />
      <path d="M62 54l12-12" stroke={ACCENT} strokeWidth="7" strokeLinecap="round" />
      <rect x="22" y="52" width="52" height="32" rx="7" fill={BODY} />
      <rect x="43" y="52" width="10" height="32" fill={ACCENT} opacity="0.7" />
      <path d="M20 50h34l-6 -12H24z" fill={ACCENT} opacity="0.9" />
    </Frame>
  );
}


const OLIVE = "#4e7a2f";
const OLIVE_DARK = "#35551f";
const PLATE = "#efe6f7";
const SWEET = "#f3d9a4";
const SWEET_TOP = "#f7c9d9";

/** كَحيلان يقدّم طبق زيتون إدلبي بيده. */
function Olives() {
  return (
    <Frame>
      <path d="M28 92V66a20 20 0 0 1 40 0v26z" fill={BODY} />
      <KaheelanHead x={48} y={42} r={12.5} scarf />
      <g
        className="origin-[30px_70px] animate-[kaheel-mascot-offer_2.6s_ease-in-out_infinite] motion-reduce:animate-none"
        style={{ transformBox: "view-box" }}
      >
        <path d="M32 72l-12-4" stroke={BODY_DARK} strokeWidth="8" strokeLinecap="round" />
        <ellipse cx="17" cy="66" rx="15" ry="5" fill={PLATE} />
        <ellipse cx="17" cy="64.5" rx="15" ry="4.4" fill={CLOTH} />
        <ellipse cx="11" cy="63" rx="3.4" ry="2.6" fill={OLIVE} />
        <ellipse cx="18" cy="62" rx="3.4" ry="2.6" fill={OLIVE_DARK} />
        <ellipse cx="24" cy="63.4" rx="3.2" ry="2.5" fill={OLIVE} />
        <ellipse cx="15" cy="60" rx="3" ry="2.3" fill={OLIVE_DARK} />
      </g>
    </Frame>
  );
}

/** كَحيلان يفتل شواربه بفخر. */
function Mustache() {
  return (
    <Frame className="animate-[kaheel-mascot-breathe_2.8s_ease-in-out_infinite] motion-reduce:animate-none">
      <path d="M28 92V66a20 20 0 0 1 40 0v26z" fill={BODY} />
      <KaheelanHead x={48} y={42} r={13} scarf twirl />
      <g
        className="origin-[60px_66px] animate-[kaheel-mascot-twirl_2.6s_ease-in-out_infinite] motion-reduce:animate-none"
        style={{ transformBox: "view-box" }}
      >
        <path d="M62 70l-4-14" stroke={BODY_DARK} strokeWidth="7.5" strokeLinecap="round" />
        <circle cx="57" cy="50" r="5.5" fill={SKIN} />
      </g>
    </Frame>
  );
}

/** كَحيلان شايل صينية حلاوة الجبن بيديه. */
function Tray() {
  return (
    <Frame>
      <path d="M28 92V68a20 20 0 0 1 40 0v24z" fill={BODY} />
      <KaheelanHead x={48} y={40} r={12} scarf twirl />
      <path d="M32 70l-6 6M64 70l6 6" stroke={BODY_DARK} strokeWidth="7.5" strokeLinecap="round" />
      <g
        className="origin-[48px_80px] animate-[kaheel-mascot-tray_3s_ease-in-out_infinite] motion-reduce:animate-none"
        style={{ transformBox: "view-box" }}
      >
        <rect x="16" y="70" width="64" height="5" rx="2.5" fill={SWEET} />
        <rect x="20" y="63" width="56" height="8" rx="3" fill={SWEET_TOP} />
        <rect x="20" y="66" width="56" height="5" rx="2" fill={SWEET} opacity="0.85" />
        <circle cx="32" cy="64" r="2.2" fill={ACCENT} opacity="0.8" />
        <circle cx="48" cy="63" r="2.2" fill={ACCENT} opacity="0.8" />
        <circle cx="64" cy="64" r="2.2" fill={ACCENT} opacity="0.8" />
        <rect x="14" y="74" width="68" height="4" rx="2" fill={PLATE} />
      </g>
    </Frame>
  );
}

/** كَحيلان بكامل زعامته: يلف الشماغ ثم يشير بإصبعه مازحًا. */
function Boss() {
  return (
    <Frame className="animate-[kaheel-mascot-boss-enter_2.8s_ease-out_infinite] motion-reduce:animate-none">
      <path d="M28 92V64a20 20 0 0 1 40 0v28z" fill={BODY} />
      <KaheelanHead x={48} y={42} r={13} scarf />
      <g
        className="origin-[30px_68px] animate-[kaheel-mascot-boss-point_2.8s_ease-in-out_infinite] motion-reduce:animate-none"
        style={{ transformBox: "view-box" }}
      >
        <path d="M32 70l-14-6" stroke={BODY_DARK} strokeWidth="8" strokeLinecap="round" />
        <circle cx="16" cy="63" r="6" fill={SKIN} />
        <path d="M11 61l-6-3" stroke={SKIN} strokeWidth="4" strokeLinecap="round" />
      </g>
    </Frame>
  );
}

/**
 * مشهد التعارف: «الزعيم كَحيلان» يقدّم نفسه ويشير إلى «كَحيل» وهو يلوّح بأدب.
 * نفس الرأسين المستخدمين في بقية المشاهد، فالمظهر متطابق.
 */
export function PopupDuoScene() {
  return (
    <svg viewBox="0 0 168 92" role="presentation" aria-hidden="true" className="size-full">
      <ellipse cx="84" cy="86" rx="72" ry="6" fill={ACCENT} opacity="0.18" />
      <circle cx="118" cy="44" r="40" fill={ACCENT} opacity="0.14" />

      {/* الزعيم كَحيلان */}
      <g
        className="animate-[kaheel-mascot-boss-enter_3s_ease-out_infinite] motion-reduce:animate-none"
        style={{ transformBox: "view-box" }}
      >
        <path d="M18 88V64a19 19 0 0 1 38 0v24z" fill={BODY} />
        <KaheelanHead x={37} y={43} r={12.5} scarf />
        {/* الإصبع يقدّم كَحيل للناس */}
        <g
          className="origin-[54px_66px] animate-[kaheel-mascot-boss-point_3s_ease-in-out_infinite] motion-reduce:animate-none"
          style={{ transformBox: "view-box" }}
        >
          <path d="M54 66l14-4" stroke={BODY_DARK} strokeWidth="8" strokeLinecap="round" />
          <circle cx="71" cy="61" r="5.5" fill={SKIN} />
          <path d="M76 60l6-2" stroke={SKIN} strokeWidth="4" strokeLinecap="round" />
        </g>
      </g>

      {/* كَحيل يلوّح بأدب */}
      <g
        className="animate-[kaheel-mascot-duo-hop_2.4s_ease-in-out_infinite] motion-reduce:animate-none"
        style={{ transformBox: "view-box" }}
      >
        <path d="M100 88V66a17 17 0 0 1 34 0v22z" fill={BODY} />
        <path d="M100 70h34" stroke={BODY_DARK} strokeWidth="3" strokeLinecap="round" />
        <KaheelHead x={117} y={46} r={13} />
        <g
          className="origin-[136px_68px] animate-[kaheel-mascot-wave_1.1s_ease-in-out_infinite] motion-reduce:animate-none"
          style={{ transformBox: "view-box" }}
        >
          <path d="M133 68l14-14" stroke={BODY_DARK} strokeWidth="8" strokeLinecap="round" />
          <circle cx="149" cy="52" r="6.5" fill={SKIN} />
        </g>
      </g>
    </svg>
  );
}

const MAP: Record<MascotKind, () => React.ReactElement> = {
  moto: Moto,
  lounge: Lounge,
  wave: Wave,
  peek: Peek,
  parcel: Parcel,
  boss: Boss,
  olives: Olives,
  mustache: Mustache,
  tray: Tray,
  duo: Wave,
};

export function PopupMascot({ kind }: { kind: MascotKind }) {
  if (kind === "duo") {
    return (
      <div className="h-[5.5rem] w-full sm:h-24">
        <PopupDuoScene />
      </div>
    );
  }
  const Scene = MAP[kind] ?? Wave;
  return (
    <div className="size-16 shrink-0 sm:size-20">
      <Scene />
    </div>
  );
}

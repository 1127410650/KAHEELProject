/**
 * العلم السوري الرسمي — مرسوم متجهيًا (SVG) لا صورة.
 *
 * لماذا متجهي: الألوان والنسب مضبوطة بدقة ولا تتغيّر بضغط الصور — أخضر
 * `#007A3D` فوق، أبيض في الوسط، أسود أسفل، وثلاث نجوم حمراء `#CE1126`
 * خمسية الرؤوس رأسها إلى أعلى موزّعة بالتساوي في الشريط الأبيض، والنسبة ٢:٣.
 * وحجمه بايتات لا كيلوبايتات، فلا يُحمّل شيئًا من الشبكة.
 *
 * الحركة: رفرفة قماش ناعمة على `transform` فقط (`k-season-wave`) مع لمعة
 * ضوء تمرّ فوقه، وكلتاهما معلّقتان حتى تدخل الطبقة الشاشة وتتوقفان تمامًا مع
 * `prefers-reduced-motion` (القواعد في styles.css).
 */
const GREEN = "#007A3D";
const RED = "#CE1126";

/** نجمة خمسية رأسها إلى أعلى، نصف قطرها ١ ومركزها (0,0). */
const STAR_POINTS = Array.from({ length: 10 }, (_, index) => {
  const radius = index % 2 === 0 ? 1 : 0.382;
  const angle = (Math.PI / 5) * index - Math.PI / 2;
  return `${(Math.cos(angle) * radius).toFixed(4)},${(Math.sin(angle) * radius).toFixed(4)}`;
}).join(" ");

export interface SyrianFlagProps {
  className?: string;
}

export function SyrianFlag({ className }: SyrianFlagProps) {
  return (
    <div className={`k-season-wave relative ${className ?? ""}`}>
      <svg
        viewBox="0 0 300 200"
        role="presentation"
        aria-hidden
        className="block h-full w-full drop-shadow-[0_10px_24px_rgb(0_0_0/0.45)]"
        preserveAspectRatio="xMidYMid slice"
      >
        <rect width="300" height="66.667" fill={GREEN} />
        <rect y="66.667" width="300" height="66.667" fill="#FFFFFF" />
        <rect y="133.333" width="300" height="66.667" fill="#000000" />
        {[75, 150, 225].map((x) => (
          <polygon
            key={x}
            points={STAR_POINTS}
            fill={RED}
            transform={`translate(${x} 100) scale(19)`}
          />
        ))}
      </svg>
      {/* لمعة قماش: تمرّ فوق العلم فتوحي بانعكاس الضوء عند الرفرفة. */}
      <span className="k-season-shimmer absolute inset-y-0 w-1/3 opacity-70" />
    </div>
  );
}

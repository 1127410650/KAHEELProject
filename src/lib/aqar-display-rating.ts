/**
 * تقييم العرض للبطاقات: البيانات التجريبية لا تحمل تقييمات حقيقية، فتُشتق قيمة
 * ثابتة (لا تتغيّر بين التحميلات) من معرّف الإعلان لتبدو البطاقة مكتملة كما في
 * التطبيقات الناضجة. عرض فقط — لا يُكتب في قاعدة البيانات ولا يُستخدم في ترتيب.
 */

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 100000;
  return h;
}

export interface AqarDisplayRating {
  /** مثال: "9.3" */
  score: string;
  /** عدد المراجعات المعروض */
  count: number;
}

export function aqarDisplayRating(id: string): AqarDisplayRating {
  const h = hash(id);
  const score = 8.2 + (h % 17) / 10; // 8.2 → 9.8
  const count = 24 + (h % 231); // 24 → 254
  return { score: score.toFixed(1), count };
}

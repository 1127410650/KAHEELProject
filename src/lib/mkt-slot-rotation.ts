/**
 * التدوير الزمني للتصاميم على الفتحات.
 *
 * الفتحة تحمل قائمة تصاميم من مكتبة «تصاميمي» + فترة تبديل (يومي/أسبوعي/شهري)
 * + لحظة بدء. التصميم النشط يُحسب حسابيًا من مدة انقضت ÷ طول الفترة بترتيب
 * دائري — بلا مهمة مجدولة ولا كتابة في القاعدة، فالنتيجة واحدة عند كل زائر
 * وعند المدير في نفس اللحظة، وتتبدّل تلقائيًا بمرور الوقت.
 */

export type RotationPeriod = "daily" | "weekly" | "monthly";

export const ROTATION_PERIODS: { value: RotationPeriod; label: string; ms: number }[] = [
  { value: "daily", label: "يومي", ms: 24 * 60 * 60_000 },
  { value: "weekly", label: "أسبوعي", ms: 7 * 24 * 60 * 60_000 },
  { value: "monthly", label: "شهري", ms: 30 * 24 * 60 * 60_000 },
];

export interface RotationConfig {
  rotate_enabled?: boolean | null;
  rotate_period?: string | null;
  rotate_template_ids?: string[] | null;
  rotate_started_at?: string | null;
}

export function periodMs(period: string | null | undefined): number | null {
  return ROTATION_PERIODS.find((item) => item.value === period)?.ms ?? null;
}

export function periodLabel(period: string | null | undefined): string {
  return ROTATION_PERIODS.find((item) => item.value === period)?.label ?? "—";
}

/** رقم الدورة الحالية (٠، ١، ٢ …) منذ لحظة بدء التدوير. */
export function rotationCycle(config: RotationConfig, now = Date.now()): number {
  const ms = periodMs(config.rotate_period);
  if (!ms) return 0;
  const started = config.rotate_started_at ? new Date(config.rotate_started_at).getTime() : now;
  if (!Number.isFinite(started)) return 0;
  return Math.max(0, Math.floor((now - started) / ms));
}

/** التصميم النشط الآن على الفتحة، أو `null` إن كان التدوير غير مفعّل. */
export function activeRotationTemplateId(
  config: RotationConfig,
  now = Date.now(),
): string | null {
  const list = (config.rotate_template_ids ?? []).filter((id): id is string => !!id);
  if (!config.rotate_enabled || list.length < 2 || !periodMs(config.rotate_period)) return null;
  return list[rotationCycle(config, now) % list.length] ?? null;
}

/** موعد التبديل القادم — يظهر في سجل التدوير داخل اللوحة. */
export function nextRotationAt(config: RotationConfig, now = Date.now()): Date | null {
  const ms = periodMs(config.rotate_period);
  if (!config.rotate_enabled || !ms) return null;
  const started = config.rotate_started_at ? new Date(config.rotate_started_at).getTime() : now;
  return new Date(started + (rotationCycle(config, now) + 1) * ms);
}

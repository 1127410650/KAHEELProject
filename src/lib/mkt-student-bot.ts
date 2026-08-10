/**
 * Student assistant — browser side.
 *
 * The browser NEVER decides a limit: it only renders whatever the server said.
 * Two rules matter here:
 *   • an uploaded question photo is downscaled and re-encoded in the browser
 *     (max 1200px, quality 70%) and is dropped from memory as soon as the
 *     answer arrives — it is never uploaded to storage;
 *   • the daily quota, the monthly budget and the conversation length all come
 *     from `mkt_student_bot_state` / the ask server function.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { askStudentBot, type StudentBotAnswer } from "@/lib/mkt-student-bot.functions";

export type { StudentBotAnswer };
export { askStudentBot };

export type StudentGrade = "grade9" | "bac_sci" | "bac_lit";

export const STUDENT_GRADES: { key: StudentGrade; ar: string; en: string }[] = [
  { key: "grade9", ar: "التاسع", en: "Grade 9" },
  { key: "bac_sci", ar: "بكالوريا علمي", en: "Bac — Science" },
  { key: "bac_lit", ar: "بكالوريا أدبي", en: "Bac — Literary" },
];

export const STUDENT_SUBJECTS: Record<StudentGrade, { key: string; ar: string; en: string }[]> = {
  grade9: [
    { key: "math", ar: "رياضيات", en: "Maths" },
    { key: "physics_chem", ar: "علوم (فيزياء وكيمياء)", en: "Science" },
    { key: "arabic", ar: "لغة عربية", en: "Arabic" },
    { key: "english", ar: "إنكليزي", en: "English" },
    { key: "french", ar: "فرنسي", en: "French" },
    { key: "social", ar: "اجتماعيات", en: "Social studies" },
    { key: "religion", ar: "تربية إسلامية", en: "Religion" },
  ],
  bac_sci: [
    { key: "math", ar: "رياضيات", en: "Maths" },
    { key: "physics", ar: "فيزياء", en: "Physics" },
    { key: "chemistry", ar: "كيمياء", en: "Chemistry" },
    { key: "biology", ar: "علوم حياتية", en: "Biology" },
    { key: "arabic", ar: "لغة عربية", en: "Arabic" },
    { key: "english", ar: "إنكليزي", en: "English" },
    { key: "french", ar: "فرنسي", en: "French" },
    { key: "religion", ar: "تربية دينية", en: "Religion" },
  ],
  bac_lit: [
    { key: "arabic", ar: "لغة عربية", en: "Arabic" },
    { key: "history", ar: "تاريخ", en: "History" },
    { key: "geography", ar: "جغرافيا", en: "Geography" },
    { key: "philosophy", ar: "فلسفة", en: "Philosophy" },
    { key: "english", ar: "إنكليزي", en: "English" },
    { key: "french", ar: "فرنسي", en: "French" },
    { key: "religion", ar: "تربية دينية", en: "Religion" },
  ],
};

export interface StudentBotState {
  enabled: boolean;
  signed_in: boolean;
  free_daily: number;
  daily_limit: number;
  used_today: number;
  remaining: number;
  conversation_max: number;
  monthly_cap_usd: number;
  month_spend_usd: number;
  budget_reached: boolean;
  plan: {
    code: string;
    name_ar: string;
    name_en: string;
    daily_limit: number;
    ends_at: string;
  } | null;
}

export interface StudentBotMessage {
  role: "user" | "assistant";
  text: string;
  at?: string;
}

export interface StudentBotConversation {
  id: string;
  grade: StudentGrade;
  subject: string;
  title: string | null;
  messages: StudentBotMessage[];
  message_count: number;
  status: "open" | "full" | "closed";
  updated_at: string;
}

export interface StudentBotPlan {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  kind: "monthly" | "season";
  price_credits: number;
  daily_limit: number;
  duration_days: number | null;
  season_ends_at: string | null;
  is_active: boolean;
  sort_order: number;
}

export const STUDENT_BOT_KEY = ["mkt", "student-bot"] as const;

export async function loadStudentBotState(): Promise<StudentBotState | null> {
  const { data, error } = await supabase.rpc("mkt_student_bot_state");
  if (error || !data) return null;
  return data as unknown as StudentBotState;
}

export function useStudentBotState() {
  const { session } = useSession();
  return useQuery({
    queryKey: [...STUDENT_BOT_KEY, "state", session?.user.id ?? null],
    enabled: !!session,
    staleTime: 15_000,
    queryFn: loadStudentBotState,
  });
}

export async function loadStudentBotConversations(): Promise<StudentBotConversation[]> {
  const { data, error } = await supabase
    .from("mkt_student_bot_conversations")
    .select("id, grade, subject, title, messages, message_count, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as unknown as StudentBotConversation[];
}

export async function loadStudentBotPlans(): Promise<StudentBotPlan[]> {
  const { data, error } = await supabase
    .from("mkt_student_bot_plans")
    .select(
      "id, code, name_ar, name_en, kind, price_credits, daily_limit, duration_days, season_ends_at, is_active, sort_order",
    )
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as StudentBotPlan[];
}

/** Pays for a plan from the existing wallet balance. */
export async function subscribeStudentBotPlan(planId: string): Promise<void> {
  const { error } = await supabase.rpc("mkt_student_bot_subscribe", { _plan_id: planId });
  if (error) throw error;
}

// ── Preferences (grade + subject follow the student) ──────────────────────────

const PREF_KEY = "kaheel.studentBot.pref";

export interface StudentPref {
  grade: StudentGrade;
  subject: string;
}

export function readStudentPref(): StudentPref | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StudentPref>;
    if (!parsed.grade || !(parsed.grade in STUDENT_SUBJECTS)) return null;
    return { grade: parsed.grade, subject: String(parsed.subject ?? "") };
  } catch {
    return null;
  }
}

export function writeStudentPref(pref: StudentPref): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify(pref));
  } catch {
    /* private mode — the choice simply won't persist */
  }
}

// ── Image handling: shrink in the browser, discard after the answer ───────────

export const STUDENT_IMAGE_MAX_EDGE = 1200;
export const STUDENT_IMAGE_QUALITY = 0.7;

export interface PreparedImage {
  /** Base64 payload without the data: prefix — held in memory only. */
  base64: string;
  mime: string;
  previewUrl: string;
  bytes: number;
}

/** Downscales to 1200px on the long edge and re-encodes at quality 70%. */
export async function prepareStudentImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, STUDENT_IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const mime = "image/webp";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, STUDENT_IMAGE_QUALITY),
  );
  if (!blob) throw new Error("encode_failed");

  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);

  return {
    base64: btoa(binary),
    mime,
    previewUrl: URL.createObjectURL(blob),
    bytes: blob.size,
  };
}

/** Human wording for every refusal the server can return. */
export function studentBotRefusalCopy(
  reason: string | undefined,
  locale: "ar" | "en",
): { title: string; body: string; showPlans: boolean } {
  const ar = locale === "ar";
  switch (reason) {
    case "not_configured":
      return {
        title: ar ? "البوت قيد التجهيز — قريبًا" : "The assistant is being set up — soon",
        body: ar
          ? "المساعد جاهز بالكامل وينتظر تفعيل الخدمة من إدارة كَحيل. جرّب أدوات التلخيص والأسئلة في دليل الطالب حتى ذلك الحين."
          : "Everything is ready and waiting for Kaheel to switch the service on. Meanwhile use the free study tools.",
        showPlans: false,
      };
    case "bot_disabled":
      return {
        title: ar ? "المساعد متوقف مؤقتًا" : "The assistant is paused",
        body: ar ? "أوقفته الإدارة مؤقتًا، تابعنا قريبًا." : "Paused by the team for now.",
        showPlans: false,
      };
    case "monthly_cap_reached":
      return {
        title: ar ? "المساعد وصل حدّه الشهري — يرجع أول الشهر" : "Monthly limit reached",
        body: ar
          ? "استُنفدت ميزانية هذا الشهر، ويعود المساعد تلقائيًا مع بداية الشهر الجديد."
          : "This month's budget is spent; the assistant returns at the start of next month.",
        showPlans: false,
      };
    case "daily_limit_reached":
      return {
        title: ar ? "خلّصت أسئلتك المجانية اليوم 😊" : "Free questions for today are done 😊",
        body: ar
          ? "ترجع بكرا، أو اشترك لأسئلة أكثر."
          : "Come back tomorrow, or subscribe for more questions.",
        showPlans: true,
      };
    case "ip_limit_reached":
      return {
        title: ar ? "وصلت أسئلة هذه الشبكة لحدّها اليومي" : "This network hit its daily limit",
        body: ar
          ? "جرّب غدًا، أو اشترك للحصول على أسئلة أكثر."
          : "Try again tomorrow, or subscribe for more.",
        showPlans: true,
      };
    case "provider_error":
      return {
        title: ar ? "تعذّر الحصول على إجابة" : "Could not get an answer",
        body: ar ? "جرّب مرة ثانية بعد قليل." : "Please try again shortly.",
        showPlans: false,
      };
    default:
      return {
        title: ar ? "تعذّر إرسال السؤال" : "Could not send the question",
        body: ar ? "تأكد من تسجيل الدخول وحاول مرة أخرى." : "Make sure you are signed in.",
        showPlans: false,
      };
  }
}

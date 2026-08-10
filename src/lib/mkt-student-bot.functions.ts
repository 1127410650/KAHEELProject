/**
 * Student assistant — the only place a question ever reaches a model.
 *
 * Nothing here is enabled today: the provider key is intentionally absent, so
 * every call stops at `not_configured` AFTER the database has recorded the
 * attempt. When the platform owner subscribes and adds the key in project
 * secrets, the same path starts answering with no code change.
 *
 * Order of operations is deliberate:
 *   1. `mkt_student_bot_claim` — the database decides (enabled? monthly cap?
 *      daily quota? per-IP quota? conversation full?). Every refusal raises.
 *   2. the model call (only if a key exists).
 *   3. `mkt_student_bot_finish` — stores the QUESTION and ANSWER TEXT ONLY,
 *      plus token counts and the estimated cost.
 *
 * The uploaded image is held in this handler's memory for the duration of the
 * request and is never written to storage, to a table, or to a log.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Model + price table used for the cost estimate (USD per 1M tokens). */
const MODEL = "claude-haiku-4-5";
const PRICE_IN_PER_MTOK = 1.0;
const PRICE_OUT_PER_MTOK = 5.0;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_IMAGE_BYTES = 1_600_000;

const GRADE_LABEL: Record<string, string> = {
  grade9: "الصف التاسع (شهادة التعليم الأساسي السورية)",
  bac_sci: "البكالوريا السورية — الفرع العلمي",
  bac_lit: "البكالوريا السورية — الفرع الأدبي",
};

/** Teaching style, encoded once, server side. */
function systemPrompt(grade: string, subject: string): string {
  return [
    "أنت «مساعد الطالب» في منصة كَحيل، معلّم سوري ودود يخاطب طالبًا في",
    `${GRADE_LABEL[grade] ?? grade}، مادة: ${subject}.`,
    "",
    "قواعدك:",
    "- اشرح بالعربية الفصحى المبسّطة، خطوة بخطوة، بترقيم واضح.",
    "- شجّع الطالب أن يجرّب أولًا: اسأله عن خطوته الأولى أو أعطه تلميحًا قبل الحل الكامل،",
    "  ثم أكمل الحل بعد محاولته أو إذا طلب الحل صريحًا.",
    "- لا تحلّ الواجبات حلًّا أعمى بلا شرح، ولا تكتب إجابة اختبار جاهزة للنسخ فقط.",
    "- إذا كان السؤال صورة، اقرأ المسألة منها ثم اشرحها.",
    "- لهجة ودودة مشجّعة قصيرة، بلا مبالغة، واختم بسؤال يتحقق من الفهم.",
    "- إن كان السؤال خارج المنهج أو غير دراسي، اعتذر بلطف ووجّهه لسؤال دراسي.",
  ].join("\n");
}

async function hashIp(): Promise<string | null> {
  const raw =
    getRequestHeader("cf-connecting-ip") ??
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
    getRequestHeader("x-real-ip") ??
    null;
  if (!raw) return null;
  const salt = process.env["SUPABASE_URL"] ?? "kaheel";
  const bytes = new TextEncoder().encode(`${salt}:${raw}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 64);
}

export type StudentBotRefusal =
  | "not_configured"
  | "bot_disabled"
  | "monthly_cap_reached"
  | "daily_limit_reached"
  | "ip_limit_reached"
  | "not_authorized"
  | "invalid_input"
  | "provider_error";

export interface StudentBotAnswer {
  ok: boolean;
  reason?: StudentBotRefusal | undefined;
  answer?: string | undefined;
  conversationId?: string | undefined;
  /** True when this answer opened a fresh conversation (previous one was full). */
  newConversation?: boolean | undefined;
  remaining?: number | undefined;
  dailyLimit?: number | undefined;
}

interface ClaimRow {
  usage_id?: string;
  conversation_id?: string;
  messages?: { role: string; text: string }[];
  summary?: string | null;
  message_count?: number;
  remaining?: number;
  daily_limit?: number;
}

export const askStudentBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      grade: string;
      subject: string;
      question: string;
      conversationId?: string | null;
      imageBase64?: string | null;
      imageMime?: string | null;
    }) => {
      const grade = String(data.grade ?? "");
      if (!(grade in GRADE_LABEL)) throw new Error("invalid_input");
      const subject = String(data.subject ?? "").trim().slice(0, 60);
      if (!subject) throw new Error("invalid_input");
      const question = String(data.question ?? "").trim().slice(0, 2000);
      const image = data.imageBase64 ? String(data.imageBase64) : null;
      if (!question && !image) throw new Error("invalid_input");
      if (image && image.length > MAX_IMAGE_BYTES) throw new Error("invalid_input");
      return {
        grade,
        subject,
        question,
        conversationId: data.conversationId ? String(data.conversationId) : null,
        imageBase64: image,
        imageMime: data.imageMime ? String(data.imageMime).slice(0, 40) : "image/webp",
      };
    },
  )
  .handler(async ({ data, context }): Promise<StudentBotAnswer> => {
    const ipHash = await hashIp();

    const { data: claimed, error: claimError } = await context.supabase.rpc(
      "mkt_student_bot_claim",
      {
        _grade: data.grade,
        _subject: data.subject,
        ...(data.conversationId ? { _conversation_id: data.conversationId } : {}),
        ...(ipHash ? { _ip_hash: ipHash } : {}),
        _has_image: !!data.imageBase64,
      },
    );

    if (claimError) {
      const message = claimError.message ?? "";
      const known: StudentBotRefusal[] = [
        "bot_disabled",
        "monthly_cap_reached",
        "daily_limit_reached",
        "ip_limit_reached",
      ];
      const reason = known.find((candidate) => message.includes(candidate)) ?? "not_authorized";
      return { ok: false, reason };
    }

    const claim = (claimed ?? {}) as ClaimRow;
    const usageId = claim.usage_id;
    const conversationId = claim.conversation_id;
    const newConversation =
      !!data.conversationId && data.conversationId !== conversationId;

    const finish = async (
      status: "answered" | "failed" | "not_configured",
      answer: string | null,
      inTokens = 0,
      outTokens = 0,
      cost = 0,
      detail?: string,
    ) => {
      if (!usageId) return;
      await context.supabase.rpc("mkt_student_bot_finish", {
        _usage_id: usageId,
        _status: status,
        _question: data.question || (data.imageBase64 ? "[صورة سؤال]" : ""),
        ...(answer ? { _answer: answer } : {}),
        _input_tokens: inTokens,
        _output_tokens: outTokens,
        _cost_usd: cost,
        _model: MODEL,
        ...(detail ? { _detail: detail } : {}),
      });
    };

    // ── The switch that keeps this feature free until the owner subscribes ──
    const key = process.env["ANTHROPIC_API_KEY"];
    if (!key) {
      await finish("not_configured", null, 0, 0, 0, "missing_provider_key");
      return { ok: false, reason: "not_configured", conversationId };
    }

    // Compact context: the carried summary replaces the full earlier thread.
    const history = Array.isArray(claim.messages) ? claim.messages.slice(-6) : [];
    const messages: unknown[] = [];
    if (claim.summary) {
      messages.push({
        role: "user",
        content: [{ type: "text", text: `سياق سابق موجز: ${claim.summary}` }],
      });
      messages.push({ role: "assistant", content: [{ type: "text", text: "تمام، تابعنا." }] });
    }
    for (const item of history) {
      messages.push({
        role: item.role === "assistant" ? "assistant" : "user",
        content: [{ type: "text", text: String(item.text ?? "").slice(0, 4000) }],
      });
    }
    const content: unknown[] = [];
    if (data.imageBase64) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: data.imageMime, data: data.imageBase64 },
      });
    }
    content.push({ type: "text", text: data.question || "اشرح لي المسألة في الصورة." });
    messages.push({ role: "user", content });

    try {
      const response = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 900,
          system: systemPrompt(data.grade, data.subject),
          messages,
        }),
      });

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 400);
        await finish("failed", null, 0, 0, 0, `http_${response.status}: ${detail}`);
        return { ok: false, reason: "provider_error", conversationId };
      }

      const payload = (await response.json()) as {
        content?: { type?: string; text?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const answer = (payload.content ?? [])
        .filter((part) => part.type === "text")
        .map((part) => part.text ?? "")
        .join("\n")
        .trim();
      if (!answer) {
        await finish("failed", null, 0, 0, 0, "empty_answer");
        return { ok: false, reason: "provider_error", conversationId };
      }

      const inTokens = payload.usage?.input_tokens ?? 0;
      const outTokens = payload.usage?.output_tokens ?? 0;
      const cost =
        (inTokens / 1_000_000) * PRICE_IN_PER_MTOK + (outTokens / 1_000_000) * PRICE_OUT_PER_MTOK;

      await finish("answered", answer, inTokens, outTokens, Number(cost.toFixed(5)));

      return {
        ok: true,
        answer,
        conversationId,
        newConversation,
        remaining: claim.remaining,
        dailyLimit: claim.daily_limit,
      };
    } catch (error) {
      await finish("failed", null, 0, 0, 0, error instanceof Error ? error.message : "network");
      return { ok: false, reason: "provider_error", conversationId };
    }
  });

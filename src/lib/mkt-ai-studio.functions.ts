/**
 * استوديو صور الهوية — توليد صور جديدة عبر بوابة Lovable AI (بلا مفتاح خارجي).
 *
 * المفتاح `LOVABLE_API_KEY` لا يترك الخادم: المتصفح يرسل وصفًا عربيًا وعددًا
 * (١–٤)، ويستلم بايتات الصور. القرار الأمني كله في قاعدة البيانات:
 * `mkt_ai_image_claim` دالة SECURITY DEFINER ترفض غير مدير المنصة، وترفض
 * تجاوز السقف اليومي أو السقف الشهري بالدولار قبل أن تُدفع أي تكلفة، وتفتح
 * سجل تدقيق لكل صورة (من، ماذا، لأي فتحة، بكم). فلترة الوصف تجري هنا قبل
 * الإرسال: ممنوع أشخاص حقيقيون أو شعارات جهات أخرى أو محتوى مخالف.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** نموذجان: نصّي فقط، والمرجعي (صورة مرفوعة) يحتاج نموذجًا يقبل صورة دخل. */
const TEXT_MODEL = "openai/gpt-image-2";
const REF_MODEL = "google/gemini-3.1-flash-image";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/images/generations";

/** تقدير التكلفة بالدولار للصورة الواحدة — يُحجز قبل التوليد ويُسجَّل بعده. */
export const UNIT_USD = { text: 0.02, ref: 0.04 } as const;

export const MAX_PER_REQUEST = 4;

export type StudioSizeKey = "banner" | "square" | "tile" | "portrait";

const SIZES: Record<StudioSizeKey, { size: string; hint: string }> = {
  banner: { size: "1536x1024", hint: "تكوين أفقي عريض بمساحة فارغة لجهة واحدة." },
  square: { size: "1024x1024", hint: "تكوين مربع متوازن، الموضوع في المنتصف." },
  tile: { size: "1024x1024", hint: "بلاطة صغيرة، عنصر واحد واضح بلا تفاصيل دقيقة." },
  portrait: { size: "1024x1536", hint: "تكوين طولي مناسب لبطاقة أو ستوري." },
};

/** غلاف أسلوب الهوية — يُضاف لكل طلب بلا استثناء. */
const BRAND_STYLE = [
  "Brand style: Kaheel marketplace — modern, clean, premium, generous negative space.",
  "Colour direction: deep violet #8A4FFF with its lighter and darker tints, soft violet gradients,",
  "optional warm gold accents, light lavender backgrounds. No teal, no neon green.",
  "Flat/soft-3D illustrative look with gentle lighting and smooth shapes.",
].join(" ");

/** قيود إلزامية — تُذكر صراحة للنموذج. */
const HARD_RULES = [
  "Strictly no text, no letters, no words, no numbers, no captions anywhere in the image.",
  "No real or recognisable human faces, no celebrities, no public figures; if people are needed use",
  "stylised faceless or abstract figures.",
  "No third-party logos, brand marks, trademarks, flags of organisations, or watermarks.",
  "No nudity, no violence, no weapons, no gore, no religious figures, no political symbols.",
].join(" ");

/** فلترة الوصف قبل الإرسال. */
const BLOCKED = [
  // أشخاص حقيقيون / شعارات
  "صورة شخص حقيقي",
  "وجه حقيقي",
  "الأمير",
  "الرئيس",
  "الملك سلمان",
  "شعار",
  "لوجو",
  "logo",
  "trademark",
  "celebrity",
  "president",
  "elon",
  "messi",
  "ronaldo",
  "nike",
  "adidas",
  "apple logo",
  "amazon",
  "noon",
  "نون",
  "طلبات",
  "هنقرستيشن",
  // محتوى مخالف
  "عاري",
  "عارية",
  "جنس",
  "إباحي",
  "دم",
  "سلاح",
  "مسدس",
  "بندقية",
  "قتل",
  "مخدرات",
  "خمر",
  "nude",
  "nsfw",
  "porn",
  "sexual",
  "gun",
  "weapon",
  "blood",
  "gore",
  "drugs",
  "kill",
];

export function screenPrompt(prompt: string): string | null {
  const flat = prompt.toLowerCase();
  const hit = BLOCKED.find((word) => flat.includes(word.toLowerCase()));
  return hit ?? null;
}

export interface StudioImage {
  jobId: string;
  /** بايتات الصورة base64 بلا بادئة data:. */
  b64: string;
  mime: string;
}

export interface StudioResult {
  ok: boolean;
  images: StudioImage[];
  budget?:
    | {
        monthlyUsd: number;
        spentUsd: number;
        remainingUsd: number;
      }
    | undefined;
  reason?:
    | "not_authorized"
    | "daily_limit_reached"
    | "monthly_budget_reached"
    | "blocked_prompt"
    | "invalid_prompt"
    | "gateway_error"
    | undefined;
  detail?: string | undefined;
}

interface ClaimRow {
  job_id?: string;
  monthly_usd?: number;
  spent_usd?: number;
  remaining_usd?: number;
}

interface StudioInput {
  prompt: string;
  count: number;
  sizeKey: StudioSizeKey;
  purpose: string;
  slotKey?: string | null;
  /** صورة مرجعية base64 بلا بادئة data: — «مثلها بأسلوبنا». */
  refB64?: string | null;
  refMime?: string | null;
}

function claimReason(message: string): StudioResult["reason"] {
  if (message.includes("monthly_budget_reached")) return "monthly_budget_reached";
  if (message.includes("daily_limit_reached")) return "daily_limit_reached";
  if (message.includes("invalid_prompt")) return "invalid_prompt";
  return "not_authorized";
}

export const generateBrandImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: StudioInput) => {
    const prompt = String(data.prompt ?? "").trim();
    if (prompt.length < 4 || prompt.length > 1200) throw new Error("invalid_prompt");
    const sizeKey = (data.sizeKey ?? "banner") as StudioSizeKey;
    if (!(sizeKey in SIZES)) throw new Error("invalid_size");
    const count = Math.min(Math.max(Math.round(Number(data.count ?? 1)), 1), MAX_PER_REQUEST);
    const refB64 = data.refB64 ? String(data.refB64) : null;
    if (refB64 && refB64.length > 8_000_000) throw new Error("ref_too_large");
    return {
      prompt,
      count,
      sizeKey,
      purpose: String(data.purpose ?? "library").slice(0, 40),
      slotKey: data.slotKey ? String(data.slotKey).slice(0, 120) : null,
      refB64,
      refMime: data.refMime ? String(data.refMime).slice(0, 40) : "image/webp",
    };
  })
  .handler(async ({ data, context }): Promise<StudioResult> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, images: [], reason: "gateway_error", detail: "missing_api_key" };

    const blocked = screenPrompt(data.prompt);
    if (blocked) return { ok: false, images: [], reason: "blocked_prompt", detail: blocked };

    const withRef = !!data.refB64;
    const model = withRef ? REF_MODEL : TEXT_MODEL;
    const unit = withRef ? UNIT_USD.ref : UNIT_USD.text;
    const spec = SIZES[data.sizeKey];
    const fullPrompt = [
      data.prompt,
      withRef ? "Recreate the uploaded reference in this brand style, do not copy it literally." : "",
      spec.hint,
      BRAND_STYLE,
      HARD_RULES,
    ]
      .filter(Boolean)
      .join("\n");

    const images: StudioImage[] = [];
    let budget: StudioResult["budget"];
    let stopReason: StudioResult["reason"];
    let stopDetail: string | undefined;

    for (let index = 0; index < data.count; index += 1) {
      const { data: claimed, error: claimErr } = await context.supabase.rpc("mkt_ai_image_claim", {
        _prompt: data.prompt,
        _size_key: data.sizeKey,
        _model: model,
        _purpose: data.purpose,
        ...(data.slotKey ? { _slot_key: data.slotKey } : {}),
        _unit_usd: unit,
      });
      if (claimErr) {
        stopReason = claimReason(claimErr.message ?? "");
        break;
      }

      const claim = (claimed ?? {}) as ClaimRow;
      const jobId = claim.job_id;
      budget = {
        monthlyUsd: Number(claim.monthly_usd ?? 0),
        spentUsd: Number(claim.spent_usd ?? 0),
        remainingUsd: Number(claim.remaining_usd ?? 0),
      };

      const finish = async (status: "generated" | "failed", bytes: number, detail?: string) => {
        if (!jobId) return;
        await context.supabase.rpc("mkt_ai_image_finish", {
          _job_id: jobId,
          _status: status,
          _bytes: bytes,
          ...(status === "generated" ? { _cost_usd: unit } : {}),
          ...(detail ? { _detail: detail } : {}),
        });
      };

      const body = withRef
        ? {
            model,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: fullPrompt },
                  {
                    type: "image_url",
                    image_url: { url: `data:${data.refMime};base64,${data.refB64}` },
                  },
                ],
              },
            ],
            modalities: ["image", "text"],
          }
        : {
            model,
            prompt: fullPrompt,
            quality: "low",
            size: spec.size,
            output_format: "png",
            n: 1,
          };

      try {
        const response = await fetch(GATEWAY, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const text = (await response.text()).slice(0, 300);
          await finish("failed", 0, `http_${response.status}: ${text}`);
          stopReason = "gateway_error";
          stopDetail = String(response.status);
          break;
        }
        const payload = (await response.json()) as {
          data?: { b64_json?: string }[];
          error?: { message?: string };
        };
        const b64 = payload.data?.[0]?.b64_json;
        if (!b64) {
          await finish("failed", 0, payload.error?.message ?? "no_image_in_response");
          stopReason = "gateway_error";
          stopDetail = payload.error?.message ?? "no_image";
          break;
        }
        const bytes = Math.round((b64.length * 3) / 4);
        await finish("generated", bytes);
        if (jobId) images.push({ jobId, b64, mime: "image/png" });
      } catch (error) {
        await finish("failed", 0, error instanceof Error ? error.message : "unknown");
        stopReason = "gateway_error";
        stopDetail = "network";
        break;
      }
    }

    return {
      ok: images.length > 0,
      images,
      budget,
      ...(images.length === 0 && stopReason ? { reason: stopReason } : {}),
      ...(stopReason && images.length > 0 ? { reason: stopReason } : {}),
      ...(stopDetail ? { detail: stopDetail } : {}),
    };
  });

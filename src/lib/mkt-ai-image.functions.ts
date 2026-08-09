/**
 * Server-side image generation for campaign assets (Lovable AI Gateway).
 *
 * The key never leaves the server: the browser posts a prompt and a size key,
 * and gets back raw base64 image bytes. Authorisation is not decided here —
 * `mkt_ai_image_claim` is a definer that refuses anyone who is not a platform
 * admin and refuses a caller who has already spent the daily quota, so the
 * gateway is only reached after the database has agreed to pay for the call.
 *
 * Every call is logged in `mkt_ai_image_jobs` (who, when, prompt, size, model,
 * bytes, estimated cost), and the row is closed by `mkt_ai_image_finish`.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * One model, one endpoint. `gpt-image-2` at low quality costs about 0.02 credits
 * per image — an order of magnitude below the Gemini image models measured on
 * this gateway, for assets that are decorative rather than photographic.
 */
const MODEL = "openai/gpt-image-2";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/images/generations";

export type AiImageSizeKey = "banner" | "square" | "character";

const SIZES: Record<AiImageSizeKey, { size: string; suffix: string }> = {
  banner: {
    size: "1536x1024",
    suffix: "Wide horizontal banner composition, generous empty space on one side for Arabic text.",
  },
  square: {
    size: "1024x1024",
    suffix: "Square composition, centred subject, works as a small popup card image.",
  },
  character: {
    size: "1024x1024",
    suffix:
      "Full character centred on a plain flat solid white background, no scenery, no shadows on the floor, clean edges so the background can be keyed out.",
  },
};

/** Rough per-image estimate in Lovable credits; used only for the audit row. */
const COST_ESTIMATE = 0.02;

export interface AiImageResult {
  ok: boolean;
  jobId?: string | undefined;
  /** Base64 image bytes (no data: prefix). */
  b64?: string | undefined;
  mime?: string | undefined;
  remaining?: number | undefined;
  dailyLimit?: number | undefined;
  reason?:
    | "not_authorized"
    | "daily_limit_reached"
    | "invalid_prompt"
    | "gateway_error"
    | undefined;
  detail?: string | undefined;
}

interface ClaimRow {
  job_id?: string;
  remaining?: number;
  daily_limit?: number;
}

export const generateCampaignImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { prompt: string; sizeKey: AiImageSizeKey; preset?: string | null }) => {
    const prompt = String(data.prompt ?? "").trim();
    if (prompt.length < 4 || prompt.length > 2000) throw new Error("invalid_prompt");
    if (!(data.sizeKey in SIZES)) throw new Error("invalid_size");
    return {
      prompt,
      sizeKey: data.sizeKey,
      preset: data.preset ? String(data.preset).slice(0, 60) : null,
    };
  })
  .handler(async ({ data, context }): Promise<AiImageResult> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, reason: "gateway_error", detail: "missing_api_key" };

    // Admin check + daily quota + audit row, all inside the database.
    const { data: claimed, error: claimErr } = await context.supabase.rpc("mkt_ai_image_claim", {
      _prompt: data.prompt,
      _size_key: data.sizeKey,
      _model: MODEL,
      ...(data.preset ? { _preset: data.preset } : {}),
    });
    if (claimErr) {
      const message = claimErr.message ?? "";
      const reason = message.includes("daily_limit_reached")
        ? "daily_limit_reached"
        : message.includes("invalid_prompt")
          ? "invalid_prompt"
          : "not_authorized";
      return { ok: false, reason };
    }

    const claim = (claimed ?? {}) as ClaimRow;
    const jobId = claim.job_id;
    const spec = SIZES[data.sizeKey];

    const finish = async (
      status: "generated" | "failed",
      bytes: number,
      detail?: string,
      cost = 0,
    ) => {
      if (!jobId) return;
      await context.supabase.rpc("mkt_ai_image_finish", {
        _job_id: jobId,
        _status: status,
        _bytes: bytes,
        _cost: cost,
        ...(detail ? { _detail: detail } : {}),
      });
    };

    try {
      const response = await fetch(GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          // OpenAI image models take `prompt`, never chat messages.
          prompt: `${data.prompt}\n\n${spec.suffix}`,
          quality: "low",
          size: spec.size,
          output_format: "png",
        }),
      });

      if (!response.ok) {
        const text = (await response.text()).slice(0, 400);
        await finish("failed", 0, `http_${response.status}: ${text}`);
        return {
          ok: false,
          reason: "gateway_error",
          detail: `${response.status}`,
          remaining: claim.remaining,
          dailyLimit: claim.daily_limit,
        };
      }

      const payload = (await response.json()) as {
        data?: { b64_json?: string }[];
        usage?: { output_tokens?: number };
      };
      const b64 = payload.data?.[0]?.b64_json;
      if (!b64) {
        await finish("failed", 0, "no_image_in_response");
        return { ok: false, reason: "gateway_error", detail: "no_image" };
      }

      const bytes = Math.round((b64.length * 3) / 4);
      await finish(
        "generated",
        bytes,
        `output_tokens=${payload.usage?.output_tokens ?? 0}`,
        COST_ESTIMATE,
      );

      return {
        ok: true,
        jobId,
        b64,
        mime: "image/png",
        remaining: claim.remaining,
        dailyLimit: claim.daily_limit,
      };
    } catch (error) {
      await finish("failed", 0, error instanceof Error ? error.message : "unknown");
      return { ok: false, reason: "gateway_error", detail: "network" };
    }
  });

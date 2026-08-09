import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  channelsForPhoneImpl,
  providerStatusImpl,
  requestOtpImpl,
  verifyOtpImpl,
  type ProviderStatus,
  type RequestOtpResult,
  type VerifyOtpResult,
} from "@/lib/otp.server";
import type { OtpChannel } from "@/lib/otp-channels";

function clientKey(): string {
  try {
    const request = getRequest();
    return (
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown"
    );
  } catch {
    return "unknown";
  }
}

/** Which delivery channels are actually configured with live provider secrets. */
export const otpProviderStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<ProviderStatus> => providerStatusImpl(),
);

/** القنوات المتاحة لرقم محدد، حسب إعداد لوحة الإدارة (لا مفاتيح ثابتة). */
export const otpChannelsForPhone = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ phone: z.string().min(6).max(20) }).parse(data))
  .handler(async ({ data }): Promise<OtpChannel[]> => channelsForPhoneImpl(data.phone));

const requestSchema = z.object({
  phone: z.string().min(6).max(20),
  channel: z.enum(["whatsapp", "sms", "email"]).nullish(),
});

export const requestPhoneOtp = createServerFn({ method: "POST" })
  .validator((data: unknown) => requestSchema.parse(data))
  .handler(async ({ data }): Promise<RequestOtpResult> =>
    requestOtpImpl(data.phone, data.channel ?? null, clientKey()),
  );

const verifySchema = z.object({
  phone: z.string().min(6).max(20),
  code: z.string().min(4).max(10),
  full_name: z.string().max(120).optional(),
});

export const verifyPhoneOtp = createServerFn({ method: "POST" })
  .validator((data: unknown) => verifySchema.parse(data))
  .handler(async ({ data }): Promise<VerifyOtpResult> =>
    verifyOtpImpl(data.phone, data.code, data.full_name ?? ""),
  );

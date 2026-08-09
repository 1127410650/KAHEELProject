import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  providerStatusImpl,
  requestOtpImpl,
  verifyOtpImpl,
  type ProviderStatus,
  type RequestOtpResult,
  type VerifyOtpResult,
} from "@/lib/otp.server";

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

const requestSchema = z.object({
  phone: z.string().min(6).max(20),
  channel: z.enum(["whatsapp", "sms"]),
});

export const requestPhoneOtp = createServerFn({ method: "POST" })
  .validator((data: unknown) => requestSchema.parse(data))
  .handler(async ({ data }): Promise<RequestOtpResult> =>
    requestOtpImpl(data.phone, data.channel, clientKey()),
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

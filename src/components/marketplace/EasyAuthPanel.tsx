/**
 * Easy sign-in panel: one mobile number, one code.
 *
 * Two paths, decided ONLY by the dial code:
 * - أي دولة عليها `phone_only_otp` في إعداد الدول (سوريا الآن، لبنان لاحقًا): phone-only. The code travels over WhatsApp or SMS through
 *   `requestPhoneOtp` / `verifyPhoneOtp`. Those need provider secrets; when they
 *   are missing the server answers `PROVIDER_UNCONFIGURED` and this panel says
 *   so plainly instead of pretending a code was sent.
 * - any other dial code: email is mandatory and the code is delivered by
 *   Supabase Auth email OTP, so the address stays usable for password recovery
 *   and notifications later.
 */
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { enablePersistentSession } from "@/lib/auth-storage";
import {
  otpChannelsForPhone,
  otpProviderStatus,
  requestEmailOtp,
  requestPhoneOtp,
  verifyPhoneOtp,
} from "@/lib/otp.functions";
import type { OtpChannel } from "@/lib/otp-channels";
import { DEFAULT_DIAL, DIAL_CODES, isAcceptablePhone, normalizePhone } from "@/lib/phone-normalize";
import { usePhoneOnlyDials } from "@/lib/mkt-markets";

/**
 * لا يوجد مفتاح دولة مكتوب في المنطق: قائمة «الدخول برقم الجوال فقط» تُقرأ من
 * إعداد الدول المفعّلة (`phone_only_otp`). عند تفعيل لبنان يصير +961 مثل +963
 * تمامًا بلا أي تعديل هنا. القيمة الاحتياطية للحظة الأولى فقط.
 */
const FALLBACK_PHONE_ONLY_DIALS = [DEFAULT_DIAL];

export function EasyAuthPanel({ onSignedIn }: { onSignedIn: () => void }) {
  const { t } = useI18n();
  const requestOtp = useServerFn(requestPhoneOtp);
  const requestEmail = useServerFn(requestEmailOtp);
  const verifyOtp = useServerFn(verifyPhoneOtp);
  const readProviders = useServerFn(otpProviderStatus);
  const readChannels = useServerFn(otpChannelsForPhone);

  const [dial, setDial] = useState(DEFAULT_DIAL);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  // القناة لا يختارها المستخدم: المحوّل الخادمي يقررها من مفتاح الدولة.
  const [channels, setChannels] = useState<OtpChannel[] | null>(null);
  const [code, setCode] = useState("");
  /** القناة التي وصل عبرها الرمز فعلًا — تحدد كيف نتحقق منه. */
  const [deliveredChannel, setDeliveredChannel] = useState<OtpChannel>("sms");
  const [stage, setStage] = useState<"identify" | "code">("identify");
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState<{ sms: boolean; whatsapp: boolean } | null>(null);

  // The panel reacts to the dial code immediately: Syrian numbers never see the
  // email field, foreign numbers always do.
  const phoneOnlyDials = usePhoneOnlyDials();
  const isPhoneOnly = (phoneOnlyDials.data ?? FALLBACK_PHONE_ONLY_DIALS).includes(dial);
  const e164 = useMemo(() => normalizePhone(dial, phone), [dial, phone]);
  const phoneReady = isAcceptablePhone(dial, phone);
  const emailReady = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const providersOff = providers !== null && !providers.whatsapp && !providers.sms;
  const phoneChannel = channels?.[0] ?? null;

  useEffect(() => {
    readProviders()
      .then((status) => setProviders({ sms: status.sms, whatsapp: status.whatsapp }))
      .catch(() => setProviders({ whatsapp: false, sms: false }));
  }, [readProviders]);

  // القنوات المتاحة تُقرأ لكل مفتاح دولة من إعداد لوحة الإدارة.
  useEffect(() => {
    if (!phoneReady || !e164) {
      setChannels(null);
      return;
    }
    let alive = true;
    readChannels({ data: { phone: e164 } })
      .then((list) => {
        if (alive) setChannels(list);
      })
      .catch(() => {
        if (alive) setChannels([]);
      });
    return () => {
      alive = false;
    };
  }, [readChannels, e164, phoneReady]);

  async function send() {
    if (isPhoneOnly || !emailReady) {
      if (!phoneReady || !e164) {
        toast.error(t("market.easyAuth.invalidPhone"));
        return;
      }
    }
    setBusy(true);
    try {
      enablePersistentSession();
      if (isPhoneOnly) {
        // البريد يُمرَّر كاحتياط: إن تعذّر إرسال SMS يذهب الرمز إليه تلقائيًا.
        const result = await requestOtp({
          data: {
            phone: e164!,
            channel: phoneChannel,
            email: emailReady ? email.trim() : null,
          },
        });
        if (!result.ok) {
          toast.error(
            result.error === "COOLDOWN"
              ? t("market.easyAuth.cooldown").replace(
                  "{seconds}",
                  String(result.retry_after_seconds ?? 60),
                )
              : result.error === "RATE_LIMITED"
                ? t("market.easyAuth.rateLimited")
                : result.error === "INVALID_PHONE"
                  ? t("market.easyAuth.invalidPhone")
                  : // قناة معطّلة أو فشل إرسال حقيقي: سبب صريح + بديل يعمل.
                    t("market.easyAuth.sendFailedUsePassword"),
          );
          return;
        }
        setDeliveredChannel(result.channel);
        toast.success(
          result.channel === "email"
            ? t("market.easyAuth.sentEmail").replace("{target}", result.target_masked ?? email.trim())
            : t("market.easyAuth.sent").replace("{target}", e164!),
        );
        setStage("code");
        return;
      }
      if (!emailReady) {
        toast.error(t("market.easyAuth.invalidEmail"));
        return;
      }
      // خارج سوريا: البريد هو القناة الأساسية الآن (قنوات الجوال غير مفعّلة).
      const sent = await requestEmail({
        data: { email: email.trim(), phone: e164 ?? null, full_name: fullName.trim() },
      });
      if (!sent.ok) {
        toast.error(
          sent.error === "COOLDOWN"
            ? t("market.easyAuth.cooldown").replace(
                "{seconds}",
                String(sent.retry_after_seconds ?? 60),
              )
            : sent.error === "RATE_LIMITED"
              ? t("market.easyAuth.rateLimited")
              : sent.error === "INVALID_EMAIL"
                ? t("market.easyAuth.invalidEmail")
                : t("market.easyAuth.sendFailedUsePassword"),
        );
        return;
      }
      setDeliveredChannel("email");
      toast.success(t("market.easyAuth.sentEmail").replace("{target}", sent.masked));
      setStage("code");
    } catch {
      toast.error(t("market.easyAuth.sendFailedUsePassword"));
    } finally {
      setBusy(false);
    }
  }


  async function verify() {
    const digits = code.replace(/\D/g, "");
    // رمز البريد المدمج قد يكون ٦ أو ٨ أرقام بحسب إعداد المشروع.
    const expected = deliveredChannel === "email" ? [6, 8] : [6];
    if (!expected.includes(digits.length)) {
      toast.error(t("market.easyAuth.invalidCode"));
      return;
    }
    setBusy(true);
    try {
      enablePersistentSession();
      // التحقق يتبع القناة التي وصل بها الرمز فعلًا، لا مفتاح الدولة.
      if (deliveredChannel !== "email") {
        const result = await verifyOtp({
          data: { phone: e164!, code: digits, full_name: fullName.trim() },
        });
        if (!result.ok) {
          toast.error(
            result.error === "EXPIRED"
              ? t("market.easyAuth.expired")
              : result.error === "TOO_MANY_ATTEMPTS"
                ? t("market.easyAuth.tooMany")
                : result.error === "INVALID_CODE"
                  ? t("market.easyAuth.invalidCode")
                  : t("market.easyAuth.failed"),
          );
          return;
        }
        const { error } = await supabase.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        });
        if (error) {
          toast.error(t("market.easyAuth.failed"));
          return;
        }
        onSignedIn();
        return;
      }
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: digits,
        type: "email",
      });
      if (error) {
        toast.error(t("market.easyAuth.invalidCode"));
        return;
      }
      onSignedIn();
    } catch {
      toast.error(t("market.easyAuth.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("market.easyAuth.subtitle")}</p>

      {stage === "identify" ? (
        <>
          <DialPhoneField
            id="easy-phone"
            size="lg"
            showCountryNames={false}
            dial={dial}
            onDialChange={setDial}
            dialLabel={t("market.easyAuth.dial")}
            label={t("market.easyAuth.phone")}
            value={phone}
            onChange={setPhone}
          />


          {(!isPhoneOnly || providersOff) && (
            <div className="space-y-2">
              <Label htmlFor="easy-email">{t("market.easyAuth.email")}</Label>
              <Input
                id="easy-email"
                dir="ltr"
                type="email"
                required
                autoComplete="email"
                className="h-12"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <p className="text-desc text-muted-foreground">
                {isPhoneOnly
                  ? t("market.easyAuth.emailFallback")
                  : t("market.easyAuth.emailRequired")}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="easy-name">{t("market.easyAuth.name")}</Label>
            <Input
              id="easy-name"
              className="h-12"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>

          {isPhoneOnly && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {t("market.easyAuth.channelAuto").replace(
                  "{channel}",
                  phoneChannel === "whatsapp"
                    ? t("market.easyAuth.whatsapp")
                    : phoneChannel === "email"
                      ? t("market.easyAuth.emailChannel")
                      : t("market.easyAuth.sms"),
                )}
              </p>
              <p className="text-desc text-muted-foreground">{t("market.easyAuth.syriaSmsOnly")}</p>
              {providersOff && (
                <p
                  data-testid="otp-disabled-note"
                  className="rounded-xl border border-gold/45 bg-gold-soft px-3 py-2 text-desc font-semibold text-gold-foreground"
                >
                  {t("market.easyAuth.disabledEmailFallback")}
                </p>
              )}
            </div>
          )}

          <Button
            type="button"
            className="h-12 w-full"
            onClick={send}
            disabled={
              busy ||
              (isPhoneOnly && (!phoneReady || (providersOff && !emailReady))) ||
              (!isPhoneOnly && !emailReady)
            }
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {busy ? t("market.easyAuth.sending") : t("market.easyAuth.send")}
          </Button>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="easy-code">{t("market.easyAuth.code")}</Label>
            <Input
              id="easy-code"
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={deliveredChannel === "email" ? 8 : 6}
              className="num h-12 text-center text-lg tracking-[0.4em]"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <p className="num text-desc text-muted-foreground">
              {t("market.easyAuth.codeHint").replace("{minutes}", "5")}
            </p>
          </div>
          <Button type="button" className="h-12 w-full" onClick={verify} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {busy ? t("market.easyAuth.verifying") : t("market.easyAuth.verify")}
          </Button>
          <div className="flex items-center justify-between gap-2 text-desc">
            <button
              type="button"
              className="font-semibold text-primary"
              onClick={() => {
                setCode("");
                void send();
              }}
            >
              {t("market.easyAuth.resend")}
            </button>
            <button
              type="button"
              className="font-semibold text-muted-foreground underline"
              onClick={() => {
                setCode("");
                setStage("identify");
              }}
            >
              {t("market.easyAuth.change")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

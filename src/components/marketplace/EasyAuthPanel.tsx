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
import { Loader2, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { enablePersistentSession } from "@/lib/auth-storage";
import { otpProviderStatus, requestPhoneOtp, verifyPhoneOtp } from "@/lib/otp.functions";
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
  const verifyOtp = useServerFn(verifyPhoneOtp);
  const readProviders = useServerFn(otpProviderStatus);

  const [dial, setDial] = useState(DEFAULT_DIAL);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"identify" | "code">("identify");
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState<{ whatsapp: boolean; sms: boolean } | null>(null);

  // The panel reacts to the dial code immediately: Syrian numbers never see the
  // email field, foreign numbers always do.
  const phoneOnlyDials = usePhoneOnlyDials();
  const isPhoneOnly = (phoneOnlyDials.data ?? FALLBACK_PHONE_ONLY_DIALS).includes(dial);
  const e164 = useMemo(() => normalizePhone(dial, phone), [dial, phone]);
  const phoneReady = isAcceptablePhone(dial, phone);
  const emailReady = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const providersOff = providers !== null && !providers.whatsapp && !providers.sms;

  useEffect(() => {
    readProviders()
      .then(setProviders)
      .catch(() => setProviders({ whatsapp: false, sms: false }));
  }, [readProviders]);

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
        const result = await requestOtp({ data: { phone: e164!, channel } });
        if (!result.ok) {
          toast.error(
            result.error === "PROVIDER_UNCONFIGURED"
              ? t("market.easyAuth.disabled")
              : result.error === "RATE_LIMITED"
                ? t("market.easyAuth.rateLimited")
                : result.error === "INVALID_PHONE"
                  ? t("market.easyAuth.invalidPhone")
                  : t("market.easyAuth.failed"),
          );
          return;
        }
        toast.success(t("market.easyAuth.sent").replace("{target}", e164!));
        setStage("code");
        return;
      }
      if (!emailReady) {
        toast.error(t("market.easyAuth.invalidEmail"));
        return;
      }
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          data: { phone_e164: e164 ?? "", full_name: fullName.trim() },
        },
      });
      if (error) {
        toast.error(t("market.easyAuth.failed"));
        return;
      }
      toast.success(t("market.easyAuth.emailSent"));
      setStage("code");
    } catch {
      toast.error(t("market.easyAuth.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) {
      toast.error(t("market.easyAuth.invalidCode"));
      return;
    }
    setBusy(true);
    try {
      enablePersistentSession();
      if (isPhoneOnly) {
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
          <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2">
            <div className="space-y-2">
              <Label htmlFor="easy-dial">{t("market.easyAuth.dial")}</Label>
              <select
                id="easy-dial"
                dir="ltr"
                value={dial}
                onChange={(event) => setDial(event.target.value)}
                className="num h-12 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {DIAL_CODES.map((item) => (
                  <option key={item.dial} value={item.dial}>
                    +{item.dial}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="easy-phone">{t("market.easyAuth.phone")}</Label>
              <Input
                id="easy-phone"
                dir="ltr"
                inputMode="tel"
                autoComplete="tel"
                className="num h-12"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
          </div>

          {!isPhoneOnly && (
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
              <p className="text-xs text-muted-foreground">{t("market.easyAuth.emailRequired")}</p>
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
              <span className="text-sm font-semibold text-foreground">
                {t("market.easyAuth.channel")}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={channel === "whatsapp" ? "default" : "outline"}
                  className="h-11 flex-1"
                  onClick={() => setChannel("whatsapp")}
                >
                  <MessageSquare className="size-4" aria-hidden />
                  {t("market.easyAuth.whatsapp")}
                </Button>
                <Button
                  type="button"
                  variant={channel === "sms" ? "default" : "outline"}
                  className="h-11 flex-1"
                  onClick={() => setChannel("sms")}
                >
                  <Phone className="size-4" aria-hidden />
                  {t("market.easyAuth.sms")}
                </Button>
              </div>
              {providersOff && (
                <p
                  data-testid="otp-disabled-note"
                  className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900"
                >
                  {t("market.easyAuth.disabled")}
                </p>
              )}
            </div>
          )}

          <Button
            type="button"
            className="h-12 w-full"
            onClick={send}
            disabled={busy || (isPhoneOnly && (!phoneReady || providersOff)) || (!isPhoneOnly && !emailReady)}
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
              maxLength={6}
              className="num h-12 text-center text-lg tracking-[0.4em]"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <p className="num text-xs text-muted-foreground">
              {t("market.easyAuth.codeHint").replace("{minutes}", "5")}
            </p>
          </div>
          <Button type="button" className="h-12 w-full" onClick={verify} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {busy ? t("market.easyAuth.verifying") : t("market.easyAuth.verify")}
          </Button>
          <div className="flex items-center justify-between gap-2 text-xs">
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

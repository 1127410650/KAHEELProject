import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CompletionRow {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  birth_year: number | null;
  gender: "male" | "female" | null;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  ad_personalization_consent: boolean;
  is_complete: boolean;
}

interface RpcResult<T> {
  data: T | null;
  error: { message?: string } | null;
}

interface RpcClient {
  rpc<T = unknown>(name: string, args?: Record<string, unknown>): Promise<RpcResult<T>>;
}

const rpcClient = supabase as unknown as RpcClient;

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+") && digits.length >= 8) return `+${digits}`;
  if (digits.startsWith("966")) return `+${digits}`;
  if (digits.startsWith("0")) return `+966${digits.slice(1)}`;
  if (digits.startsWith("5") && digits.length === 9) return `+966${digits}`;
  return digits ? `+${digits}` : "";
}

export function ProfileCompletionPanel() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [phoneSent, setPhoneSent] = useState(false);
  const [draft, setDraft] = useState({
    email: "",
    phone: "",
    birthYear: "",
    gender: "" as "" | "male" | "female",
    consent: false,
  });

  const completion = useQuery({
    queryKey: ["account", "profile-completion"],
    retry: 1,
    queryFn: async () => {
      const { data, error } = await rpcClient.rpc<CompletionRow[] | CompletionRow>(
        "profile_completion_get",
      );
      if (error) throw new Error(error.message || "PROFILE_COMPLETION_LOAD_FAILED");
      return (Array.isArray(data) ? data[0] : data) ?? null;
    },
  });

  const row = completion.data;
  useEffect(() => {
    if (!row) return;
    setDraft({
      email: row.email ?? "",
      phone: row.phone ?? "",
      birthYear: row.birth_year ? String(row.birth_year) : "",
      gender: row.gender ?? "",
      consent: row.ad_personalization_consent ?? false,
    });
  }, [row]);

  const currentYear = new Date().getFullYear();
  const complete = row?.is_complete === true;
  const emailVerified = !!row?.email_verified_at;
  const phoneVerified = !!row?.phone_verified_at;
  const missing = useMemo(() => {
    const items: string[] = [];
    if (!draft.email) items.push(ar ? "البريد" : "email");
    if (!emailVerified) items.push(ar ? "تحقق البريد" : "email verification");
    if (!draft.phone) items.push(ar ? "الجوال" : "phone");
    if (!phoneVerified) items.push(ar ? "تحقق الجوال" : "phone verification");
    if (!draft.birthYear) items.push(ar ? "سنة الميلاد" : "birth year");
    if (!draft.gender) items.push(ar ? "الجنس" : "gender");
    return items;
  }, [ar, draft, emailVerified, phoneVerified]);

  async function save(showToast = true): Promise<boolean> {
    const email = draft.email.trim().toLowerCase();
    const phone = normalizePhone(draft.phone);
    const birthYear = Number(draft.birthYear);
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error(ar ? "أدخل بريدًا إلكترونيًا صحيحًا." : "Enter a valid email address.");
      return false;
    }
    if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) {
      toast.error(ar ? "أدخل رقم جوال صحيحًا مع مفتاح الدولة." : "Enter a valid phone with country code.");
      return false;
    }
    if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > currentYear) {
      toast.error(ar ? "أدخل سنة ميلاد صحيحة." : "Enter a valid birth year.");
      return false;
    }
    if (!draft.gender) {
      toast.error(ar ? "اختر ذكر أو أنثى." : "Select male or female.");
      return false;
    }

    setBusy(true);
    try {
      const { error } = await rpcClient.rpc("profile_completion_save", {
        _email: email,
        _phone: phone,
        _birth_year: birthYear,
        _gender: draft.gender,
        _ad_personalization_consent: draft.consent,
      });
      if (error) throw new Error(error.message || "PROFILE_COMPLETION_SAVE_FAILED");
      setDraft((previous) => ({ ...previous, email, phone }));
      await completion.refetch();
      if (showToast) toast.success(ar ? "تم حفظ بيانات الملف." : "Profile details saved.");
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error && error.message.includes("INVALID")
          ? ar
            ? "تحقق من البيانات المدخلة."
            : "Check the entered details."
          : ar
            ? "تعذر حفظ البيانات الآن."
            : "Could not save the details now.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function syncVerification() {
    const { error } = await rpcClient.rpc("profile_sync_verification");
    if (error) throw new Error(error.message || "PROFILE_SYNC_FAILED");
    await completion.refetch();
  }

  async function sendEmailCode() {
    if (!(await save(false))) return;
    setEmailBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: draft.email.trim().toLowerCase() });
      if (error) throw error;
      setEmailSent(true);
      toast.success(
        ar
          ? "أُرسل رمز أو رابط التحقق إلى بريدك حسب إعدادات البريد الحالية."
          : "A verification code or link was sent using the current email settings.",
      );
      await syncVerification();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : ar ? "تعذر إرسال التحقق." : "Could not send verification.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function verifyEmailCode() {
    if (!emailCode.trim()) return;
    setEmailBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: draft.email.trim().toLowerCase(),
        token: emailCode.trim(),
        type: "email_change",
      });
      if (error) throw error;
      await syncVerification();
      setEmailCode("");
      setEmailSent(false);
      toast.success(ar ? "تم التحقق من البريد." : "Email verified.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : ar ? "الرمز غير صحيح." : "Invalid code.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function sendPhoneCode() {
    if (!(await save(false))) return;
    setPhoneBusy(true);
    try {
      const phone = normalizePhone(draft.phone);
      const { error } = await supabase.auth.updateUser({ phone });
      if (error) throw error;
      setPhoneSent(true);
      toast.success(
        ar
          ? "أُرسل رمز التحقق إلى الجوال عبر مزود الرسائل المفعّل للمنصة."
          : "A verification code was sent through the platform's configured SMS provider.",
      );
      await syncVerification();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : ar ? "تعذر إرسال رمز الجوال." : "Could not send phone code.");
    } finally {
      setPhoneBusy(false);
    }
  }

  async function verifyPhoneCode() {
    if (!phoneCode.trim()) return;
    setPhoneBusy(true);
    try {
      const phone = normalizePhone(draft.phone);
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: phoneCode.trim(),
        type: "phone_change",
      });
      if (error) throw error;
      await syncVerification();
      setPhoneCode("");
      setPhoneSent(false);
      toast.success(ar ? "تم التحقق من الجوال." : "Phone verified.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : ar ? "الرمز غير صحيح." : "Invalid code.");
    } finally {
      setPhoneBusy(false);
    }
  }

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-3 py-3 text-start hover:bg-accent"
        aria-expanded={open}
      >
        <span
          className={
            complete
              ? "grid size-9 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-600"
              : "grid size-9 shrink-0 place-items-center rounded-full bg-amber-500/10 text-amber-600"
          }
        >
          {complete ? <CheckCircle2 className="size-5" /> : <AlertCircle className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-foreground">
            {ar ? "اكتمال الملف" : "Profile completion"}
          </span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {completion.isLoading
              ? ar
                ? "جارٍ التحقق..."
                : "Checking..."
              : complete
                ? ar
                  ? "مكتمل وموثق"
                  : "Complete and verified"
                : ar
                  ? `غير مكتمل${missing.length ? ` — متبقي ${missing.length}` : ""}`
                  : `Incomplete${missing.length ? ` — ${missing.length} remaining` : ""}`}
          </span>
        </span>
        {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="space-y-5 border-t border-border px-3 py-4">
          <div className="rounded-lg bg-secondary/70 p-3 text-xs leading-relaxed text-muted-foreground">
            <span className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              {ar
                ? "البريد والجوال وسنة الميلاد والجنس بيانات خاصة لا تظهر للعامة. لا يُستخدم الجنس لتخصيص الإعلانات إلا بعد تفعيل موافقتك أدناه."
                : "Email, phone, birth year and gender are private. Gender is not used for ad personalization unless you enable consent below."}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="completion_email">{ar ? "البريد الإلكتروني" : "Email"}</Label>
            <Input
              id="completion_email"
              type="email"
              dir="ltr"
              value={draft.email}
              onChange={(event) => setDraft((previous) => ({ ...previous, email: event.target.value }))}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant={emailVerified ? "secondary" : "outline"} disabled={emailBusy || emailVerified} onClick={() => void sendEmailCode()}>
                {emailBusy && <Loader2 className="size-3.5 animate-spin" />}
                <Mail className="size-3.5" />
                {emailVerified ? (ar ? "موثق" : "Verified") : ar ? "إرسال رمز" : "Send code"}
              </Button>
              {emailSent && !emailVerified && (
                <>
                  <Input
                    aria-label={ar ? "رمز البريد" : "Email code"}
                    className="h-8 w-32"
                    dir="ltr"
                    inputMode="numeric"
                    placeholder="000000"
                    value={emailCode}
                    onChange={(event) => setEmailCode(event.target.value)}
                  />
                  <Button type="button" size="sm" onClick={() => void verifyEmailCode()} disabled={emailBusy}>
                    {ar ? "تحقق" : "Verify"}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="completion_phone">{ar ? "رقم الجوال" : "Phone"}</Label>
            <Input
              id="completion_phone"
              dir="ltr"
              inputMode="tel"
              placeholder="+9665XXXXXXXX"
              value={draft.phone}
              onChange={(event) => setDraft((previous) => ({ ...previous, phone: event.target.value }))}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant={phoneVerified ? "secondary" : "outline"} disabled={phoneBusy || phoneVerified} onClick={() => void sendPhoneCode()}>
                {phoneBusy && <Loader2 className="size-3.5 animate-spin" />}
                <Phone className="size-3.5" />
                {phoneVerified ? (ar ? "موثق" : "Verified") : ar ? "إرسال رمز" : "Send code"}
              </Button>
              {phoneSent && !phoneVerified && (
                <>
                  <Input
                    aria-label={ar ? "رمز الجوال" : "Phone code"}
                    className="h-8 w-32"
                    dir="ltr"
                    inputMode="numeric"
                    placeholder="000000"
                    value={phoneCode}
                    onChange={(event) => setPhoneCode(event.target.value)}
                  />
                  <Button type="button" size="sm" onClick={() => void verifyPhoneCode()} disabled={phoneBusy}>
                    {ar ? "تحقق" : "Verify"}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="completion_birth_year">{ar ? "سنة الميلاد" : "Birth year"}</Label>
              <Input
                id="completion_birth_year"
                type="number"
                dir="ltr"
                inputMode="numeric"
                min={1900}
                max={currentYear}
                placeholder={String(currentYear - 25)}
                value={draft.birthYear}
                onChange={(event) => setDraft((previous) => ({ ...previous, birthYear: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="completion_gender">{ar ? "الجنس" : "Gender"}</Label>
              <select
                id="completion_gender"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                value={draft.gender}
                onChange={(event) => setDraft((previous) => ({ ...previous, gender: event.target.value as "" | "male" | "female" }))}
              >
                <option value="">{ar ? "اختر" : "Select"}</option>
                <option value="male">{ar ? "ذكر" : "Male"}</option>
                <option value="female">{ar ? "أنثى" : "Female"}</option>
              </select>
            </div>
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border border-border p-3 text-xs leading-relaxed text-muted-foreground">
            <Checkbox
              checked={draft.consent}
              onCheckedChange={(value) => setDraft((previous) => ({ ...previous, consent: value === true }))}
            />
            <span>
              {ar
                ? "أوافق على استخدام الجنس والفئة العمرية لتخصيص الإعلانات والعروض داخل كحلي. يمكنني إلغاء الموافقة لاحقًا."
                : "I agree to use gender and age group to personalize ads and promotions in Kahli. I can withdraw consent later."}
            </span>
          </label>

          <Button type="button" className="w-full" disabled={busy} onClick={() => void save()}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {ar ? "حفظ بيانات الملف" : "Save profile details"}
          </Button>

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            {ar
              ? "إرسال رمز الجوال يعتمد على مزود الرسائل المفعّل في إعدادات Supabase. لم تُضف خدمة مدفوعة جديدة ضمن هذا التعديل."
              : "Phone-code delivery depends on the SMS provider enabled in Supabase. This change does not add a new paid service."}
          </p>
        </div>
      )}
    </div>
  );
}

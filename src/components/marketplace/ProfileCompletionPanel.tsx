import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
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
  storage_mode?: "rpc" | "auth_metadata";
}

interface RpcResult<T> {
  data: T | null;
  error: { message?: string; code?: string } | null;
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

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return String(error ?? "");
}

function isMissingProfileSchema(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("profile_completion_") ||
    lower.includes("profile_private_details") ||
    lower.includes("could not find the function") ||
    lower.includes("schema cache") ||
    lower.includes("pgrst202")
  );
}

function isEmailDeliveryUnavailable(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("email address not authorized") ||
    lower.includes("smtp") ||
    lower.includes("email rate limit") ||
    lower.includes("over email send rate limit")
  );
}

function authFallbackRow(user: {
  email?: string | null;
  phone?: string | null;
  user_metadata?: Record<string, unknown> | null;
  email_confirmed_at?: string | null;
}): CompletionRow {
  const metadata = user.user_metadata ?? {};
  const authEmail = (user.email ?? "").trim().toLowerCase();
  const publicEmail = String(metadata["public_email"] ?? "").trim().toLowerCase();
  const email = publicEmail || (authEmail.endsWith("@accounts.kahli.invalid") ? "" : authEmail);
  const phone = normalizePhone(String(metadata["phone"] ?? user.phone ?? ""));
  const birthYearValue = Number(metadata["birth_year"] ?? 0);
  const birthYear = Number.isInteger(birthYearValue) && birthYearValue > 0 ? birthYearValue : null;
  const genderValue = metadata["gender"];
  const gender = genderValue === "male" || genderValue === "female" ? genderValue : null;
  const emailVerified = !!email && !!user.email_confirmed_at && authEmail === email.toLowerCase();
  const fullName = String(metadata["full_name"] ?? "").trim() || null;

  return {
    full_name: fullName,
    email: email || null,
    phone: phone || null,
    birth_year: birthYear,
    gender,
    email_verified_at: emailVerified ? user.email_confirmed_at ?? null : null,
    phone_verified_at: null,
    ad_personalization_consent: metadata["ad_personalization_consent"] === true,
    is_complete:
      !!fullName && !!email && !!phone && !!birthYear && !!gender && emailVerified,
    storage_mode: "auth_metadata",
  };
}

export function ProfileCompletionPanel() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
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
    queryFn: async (): Promise<CompletionRow | null> => {
      const { data, error } = await rpcClient.rpc<CompletionRow[] | CompletionRow>(
        "profile_completion_get",
      );
      if (!error) {
        const row = (Array.isArray(data) ? data[0] : data) ?? null;
        return row ? { ...row, storage_mode: "rpc" } : null;
      }

      const message = error.message || "PROFILE_COMPLETION_LOAD_FAILED";
      if (!isMissingProfileSchema(message)) throw new Error(message);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw authError ?? new Error("PROFILE_COMPLETION_LOAD_FAILED");
      }
      return authFallbackRow(authData.user);
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
  const usingFallback = row?.storage_mode === "auth_metadata";
  const missing = useMemo(() => {
    const items: string[] = [];
    if (!draft.email) items.push(ar ? "البريد" : "email");
    if (!emailVerified) items.push(ar ? "تحقق البريد" : "email verification");
    if (!draft.phone) items.push(ar ? "الجوال" : "phone");
    if (!draft.birthYear) items.push(ar ? "سنة الميلاد" : "birth year");
    if (!draft.gender) items.push(ar ? "الجنس" : "gender");
    return items;
  }, [ar, draft, emailVerified]);

  function validateDraft(): {
    email: string;
    phone: string;
    birthYear: number;
    gender: "male" | "female";
  } | null {
    const email = draft.email.trim().toLowerCase();
    const phone = normalizePhone(draft.phone);
    const birthYear = Number(draft.birthYear);
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error(ar ? "أدخل بريدًا إلكترونيًا صحيحًا." : "Enter a valid email address.");
      return null;
    }
    if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) {
      toast.error(
        ar
          ? "أدخل رقم جوال صحيحًا مع مفتاح الدولة."
          : "Enter a valid phone with country code.",
      );
      return null;
    }
    if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > currentYear) {
      toast.error(ar ? "أدخل سنة ميلاد صحيحة." : "Enter a valid birth year.");
      return null;
    }
    if (!draft.gender) {
      toast.error(ar ? "اختر ذكر أو أنثى." : "Select male or female.");
      return null;
    }
    return { email, phone, birthYear, gender: draft.gender };
  }

  async function save(showToast = true): Promise<boolean> {
    const values = validateDraft();
    if (!values) return false;

    setBusy(true);
    try {
      const { error } = await rpcClient.rpc("profile_completion_save", {
        _email: values.email,
        _phone: values.phone,
        _birth_year: values.birthYear,
        _gender: values.gender,
        _ad_personalization_consent: draft.consent,
      });

      if (error) {
        const message = error.message || "PROFILE_COMPLETION_SAVE_FAILED";
        if (!isMissingProfileSchema(message)) throw new Error(message);

        const { error: metadataError } = await supabase.auth.updateUser({
          data: {
            public_email: values.email,
            phone: values.phone,
            birth_year: values.birthYear,
            gender: values.gender,
            ad_personalization_consent: draft.consent,
          },
        });
        if (metadataError) throw metadataError;
      }

      setDraft((previous) => ({
        ...previous,
        email: values.email,
        phone: values.phone,
      }));
      await completion.refetch();
      if (showToast) {
        toast.success(ar ? "تم حفظ بيانات الملف." : "Profile details saved.");
      }
      return true;
    } catch (error) {
      const message = errorMessage(error);
      toast.error(
        message.includes("INVALID")
          ? ar
            ? "تحقق من البيانات المدخلة."
            : "Check the entered details."
          : ar
            ? "تعذر حفظ البيانات. حدّث الصفحة ثم حاول مرة أخرى."
            : "Could not save the details. Refresh and try again.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function syncVerification() {
    const { error } = await rpcClient.rpc("profile_sync_verification");
    if (error && !isMissingProfileSchema(error.message || "")) {
      throw new Error(error.message || "PROFILE_SYNC_FAILED");
    }
    await completion.refetch();
  }

  async function sendEmailVerification() {
    if (!(await save(false))) return;
    setEmailBusy(true);
    try {
      const email = draft.email.trim().toLowerCase();
      const { data: authData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const authEmail = authData.user?.email?.trim().toLowerCase();
      const alreadyConfirmed = authEmail === email && !!authData.user?.email_confirmed_at;

      if (alreadyConfirmed) {
        await syncVerification();
        toast.success(ar ? "البريد الإلكتروني موثق مسبقًا." : "Email is already verified.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      setEmailSent(true);
      toast.success(
        ar
          ? "أُرسل رابط أو رمز التحقق إلى بريدك. افحص الوارد والرسائل غير المرغوبة."
          : "A verification link or code was sent. Check your inbox and spam folder.",
      );
    } catch (error) {
      const message = errorMessage(error);
      toast.error(
        isEmailDeliveryUnavailable(message)
          ? ar
            ? "بلغ الإرسال المجاني حده مؤقتًا. حاول لاحقًا."
            : "The free email limit was reached. Try again later."
          : message || (ar ? "تعذر إرسال تحقق البريد." : "Could not send email verification."),
      );
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
      toast.error(errorMessage(error) || (ar ? "الرمز غير صحيح." : "Invalid code."));
    } finally {
      setEmailBusy(false);
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
              ? "grid size-9 shrink-0 place-items-center rounded-full bg-success/10 text-success"
              : "grid size-9 shrink-0 place-items-center rounded-full bg-gold/15 text-gold-dark"
          }
        >
          {complete ? <CheckCircle2 className="size-5" /> : <AlertCircle className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-foreground">
            {ar ? "اكتمال الملف" : "Profile completion"}
          </span>
          <span className="mt-0.5 block text-desc text-muted-foreground">
            {completion.isLoading
              ? ar
                ? "جارٍ التحقق..."
                : "Checking..."
              : complete
                ? ar
                  ? "مكتمل"
                  : "Complete"
                : ar
                  ? `غير مكتمل${missing.length ? ` — متبقي ${missing.length}` : ""}`
                  : `Incomplete${missing.length ? ` — ${missing.length} remaining` : ""}`}
          </span>
        </span>
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="space-y-5 border-t border-border px-3 py-4">
          <div className="rounded-lg bg-secondary/70 p-3 text-desc leading-relaxed text-muted-foreground">
            <span className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              {ar
                ? "بياناتك خاصة ولا تظهر للعامة. التحقق المجاني يتم عبر البريد، ورقم الجوال يُحفظ كرقم تواصل فقط."
                : "Your details are private. Free verification uses email, while the phone is stored as a contact number only."}
            </span>
          </div>

          {usingFallback && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-desc leading-relaxed text-muted-foreground">
              <span className="flex items-start gap-2">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                {ar
                  ? "الحفظ المجاني الاحتياطي مفعّل لهذا الحساب."
                  : "Free fallback storage is active for this account."}
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="completion_email">{ar ? "البريد الإلكتروني" : "Email"}</Label>
            <Input
              id="completion_email"
              type="email"
              dir="ltr"
              value={draft.email}
              onChange={(event) =>
                setDraft((previous) => ({ ...previous, email: event.target.value }))
              }
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={emailVerified ? "secondary" : "outline"}
                disabled={emailBusy || emailVerified}
                onClick={() => void sendEmailVerification()}
              >
                {emailBusy && <Loader2 className="size-3.5 animate-spin" />}
                <Mail className="size-3.5" />
                {emailVerified
                  ? ar
                    ? "موثق"
                    : "Verified"
                  : ar
                    ? "تحقق مجاني"
                    : "Free verification"}
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
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void verifyEmailCode()}
                    disabled={emailBusy}
                  >
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
              onChange={(event) =>
                setDraft((previous) => ({ ...previous, phone: event.target.value }))
              }
            />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-desc font-semibold text-muted-foreground">
              <Phone className="size-3.5" />
              {ar ? "يُحفظ كرقم تواصل — بدون رسوم SMS" : "Saved as contact — no SMS fees"}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="completion_birth_year">
                {ar ? "سنة الميلاد" : "Birth year"}
              </Label>
              <Input
                id="completion_birth_year"
                type="number"
                dir="ltr"
                inputMode="numeric"
                min={1900}
                max={currentYear}
                placeholder={String(currentYear - 25)}
                value={draft.birthYear}
                onChange={(event) =>
                  setDraft((previous) => ({ ...previous, birthYear: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="completion_gender">{ar ? "الجنس" : "Gender"}</Label>
              <select
                id="completion_gender"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                value={draft.gender}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    gender: event.target.value as "" | "male" | "female",
                  }))
                }
              >
                <option value="">{ar ? "اختر" : "Select"}</option>
                <option value="male">{ar ? "ذكر" : "Male"}</option>
                <option value="female">{ar ? "أنثى" : "Female"}</option>
              </select>
            </div>
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border border-border p-3 text-desc leading-relaxed text-muted-foreground">
            <Checkbox
              checked={draft.consent}
              onCheckedChange={(value) =>
                setDraft((previous) => ({ ...previous, consent: value === true }))
              }
            />
            <span>
              {ar
                ? "أوافق على استخدام الجنس والفئة العمرية لتخصيص الإعلانات والعروض داخل كَحيل. يمكنني إلغاء الموافقة لاحقًا."
                : "I agree to use gender and age group to personalize ads and promotions in Kaheel. I can withdraw consent later."}
            </span>
          </label>

          <Button type="button" className="w-full" disabled={busy} onClick={() => void save()}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {ar ? "حفظ بيانات الملف" : "Save profile details"}
          </Button>
        </div>
      )}
    </div>
  );
}

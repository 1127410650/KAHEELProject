import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Building2,
  Loader2,
  Store,
  Upload,
  UserRoundCog,
} from "lucide-react";
import { toast } from "sonner";

import { BusinessQuickCreate } from "@/components/marketplace/BusinessQuickCreate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import {
  finalizeJoinApplication,
  joinErrorMessage,
  markJoinApplicationIncomplete,
  submitJoinApplication,
  uploadJoinDocument,
  type JoinApplicationKind,
} from "@/lib/mkt-provider-onboarding";
import { useSession } from "@/lib/session";

interface JoinSearch {
  kind: JoinApplicationKind;
}

const KINDS: JoinApplicationKind[] = [
  "seller",
  "service_provider",
  "delivery_team",
  "platform_team",
];

export const Route = createFileRoute("/join")({
  ssr: "data-only",
  validateSearch: (search: Record<string, unknown>): JoinSearch => ({
    kind: KINDS.includes(search["kind"] as JoinApplicationKind)
      ? (search["kind"] as JoinApplicationKind)
      : "seller",
  }),
  head: () => ({
    meta: [
      { title: "انضم إلى گحيل" },
      {
        name: "description",
        content: "طلبات الانضمام كبائع أو مقدم خدمة أو مندوب توصيل أو عضو فريق في گحيل.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: JoinPage,
});

const COPY: Record<
  JoinApplicationKind,
  { ar: string; en: string; hintAr: string; hintEn: string; icon: typeof Store }
> = {
  seller: {
    ar: "افتح حساب متجر",
    en: "Open a store account",
    hintAr: "مطاعم، مقاهٍ، نوادٍ، مستشفيات، جامعات، مصانع، موردون وكل نشاط يبيع.",
    hintEn: "Restaurants, cafés, clubs, hospitals, universities, factories and every seller.",
    icon: Store,
  },
  service_provider: {
    ar: "انضم كمقدم خدمة",
    en: "Join as a service provider",
    hintAr: "طبيب، حلاق، نجار، حداد، صيانة، شركات نقل وغيرها من الخدمات.",
    hintEn: "Doctors, barbers, carpenters, maintenance, transport companies and more.",
    icon: Building2,
  },
  delivery_team: {
    ar: "انضم لفريق التوصيل",
    en: "Join the delivery team",
    hintAr: "اختر وسيلة التوصيل وساعات العمل وأرسل طلبك للمراجعة.",
    hintEn: "Choose your vehicle and availability, then submit for review.",
    icon: Bike,
  },
  platform_team: {
    ar: "انضم لفريق العمل",
    en: "Join our team",
    hintAr: "اختر المجال المناسب وأرفق سيرتك أو خبرتك.",
    hintEn: "Choose your area and attach your CV or experience.",
    icon: UserRoundCog,
  },
};

function JoinPage() {
  const { locale, dir } = useI18n();
  const { kind } = Route.useSearch() as JoinSearch;
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const content = COPY[kind];
  const Icon = content.icon;
  const Back = dir === "rtl" ? ArrowRight : ArrowLeft;
  const businessKind = kind === "seller" || kind === "service_provider";

  useEffect(() => {
    if (!loading && !session) {
      void navigate({
        href: `/auth?next=${encodeURIComponent(`/join?kind=${kind}`)}`,
        replace: true,
      });
    }
  }, [kind, loading, navigate, session]);

  if (loading || !session) return null;

  return (
    <main className="market-surface min-h-dvh px-4 py-5 sm:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          to="/more"
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-muted-foreground hover:bg-secondary"
        >
          <Back className="size-4" />
          {locale === "ar" ? "العودة إلى المزيد" : "Back to More"}
        </Link>

        <section className="mb-4 overflow-hidden rounded-3xl bg-gradient-to-br from-market-navy via-market-navy-dark to-cyan-900 p-5 text-white shadow-raised sm:p-7">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/10">
            <Icon className="size-6 text-cyan-100" />
          </span>
          <h1 className="mt-5 text-2xl font-black sm:text-3xl">
            {locale === "ar" ? content.ar : content.en}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-white/75">
            {locale === "ar" ? content.hintAr : content.hintEn}
          </p>
          <p className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-xs leading-6 text-white/80">
            {locale === "ar"
              ? "لن تتغير صلاحيات حسابك عند الإرسال. يتم التفعيل فقط بعد مراجعة الطلب وقبوله."
              : "Submitting does not change your access. Activation happens only after review and approval."}
          </p>
        </section>

        {businessKind ? (
          <div className="overflow-hidden rounded-3xl border bg-card p-3 shadow-panel sm:p-5">
            <BusinessQuickCreate
              open
              variant="page"
              joinKind={kind}
              onOpenChange={(open) => {
                if (!open) void navigate({ to: "/more" });
              }}
              onCreated={() => {
                void queryClient.invalidateQueries({ queryKey: ["mkt", "join-applications"] });
                void queryClient.invalidateQueries({ queryKey: ["mkt", "my-accounts"] });
                void navigate({ to: "/more", replace: true });
              }}
            />
          </div>
        ) : (
          <PersonalJoinForm kind={kind} />
        )}
      </div>
    </main>
  );
}

function PersonalJoinForm({ kind }: { kind: "delivery_team" | "platform_team" }) {
  const { locale } = useI18n();
  const { session } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(session?.user.email ?? "");
  const [city, setCity] = useState("");
  const [experience, setExperience] = useState("");
  const [availability, setAvailability] = useState("");
  const [vehicleType, setVehicleType] = useState("car");
  const [desiredRole, setDesiredRole] = useState("customer_support");
  const [document, setDocument] = useState<File | null>(null);

  const roleOptions = useMemo(
    () => [
      ["customer_support", locale === "ar" ? "خدمة العملاء" : "Customer support"],
      ["operations", locale === "ar" ? "التشغيل" : "Operations"],
      ["sales", locale === "ar" ? "المبيعات" : "Sales"],
      ["content", locale === "ar" ? "المحتوى والتسويق" : "Content & marketing"],
      ["technology", locale === "ar" ? "التقنية" : "Technology"],
    ],
    [locale],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!session || busy) return;
    if (kind === "delivery_team" && !document) {
      toast.error(
        locale === "ar"
          ? "أرفق رخصة القيادة أو مستندًا داعمًا."
          : "Attach a driver licence or supporting document.",
      );
      return;
    }
    setBusy(true);
    let applicationId: string | null = null;
    try {
      const payload = {
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        city: city.trim() || null,
        experience: experience.trim() || null,
        availability: availability.trim() || null,
        ...(kind === "delivery_team"
          ? { vehicle_type: vehicleType }
          : { desired_role: desiredRole }),
      };
      applicationId = await submitJoinApplication({
        kind,
        payload,
      });
      if (document) {
        await uploadJoinDocument({
          applicationId,
          userId: session.user.id,
          kind: kind === "delivery_team" ? "license" : "resume",
          file: document,
        });
      }
      await finalizeJoinApplication({ applicationId, payload });
      await queryClient.invalidateQueries({ queryKey: ["mkt", "join-applications"] });
      toast.success(
        locale === "ar" ? "تم إرسال طلب الانضمام بنجاح." : "Application submitted successfully.",
      );
      void navigate({ to: "/more", replace: true });
    } catch (error) {
      if (applicationId) {
        try {
          await markJoinApplicationIncomplete(applicationId);
        } catch {
          // The applicant can reopen and resume this request from More.
        }
      }
      toast.error(joinErrorMessage(error, locale));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="space-y-5 rounded-3xl border bg-card p-4 shadow-panel sm:p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={locale === "ar" ? "الاسم الكامل" : "Full name"} htmlFor="join-name">
          <Input
            id="join-name"
            value={fullName}
            maxLength={120}
            onChange={(event) => setFullName(event.target.value)}
            required
          />
        </Field>
        <Field label={locale === "ar" ? "رقم الجوال" : "Mobile number"} htmlFor="join-phone">
          <Input
            id="join-phone"
            dir="ltr"
            inputMode="tel"
            value={phone}
            maxLength={24}
            onChange={(event) => setPhone(event.target.value)}
            required
          />
        </Field>
        <Field label={locale === "ar" ? "البريد الإلكتروني" : "Email"} htmlFor="join-email">
          <Input
            id="join-email"
            dir="ltr"
            type="email"
            value={email}
            maxLength={160}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label={locale === "ar" ? "المدينة" : "City"} htmlFor="join-city">
          <Input
            id="join-city"
            value={city}
            maxLength={100}
            onChange={(event) => setCity(event.target.value)}
          />
        </Field>
        {kind === "delivery_team" ? (
          <Field
            label={locale === "ar" ? "وسيلة التوصيل" : "Delivery vehicle"}
            htmlFor="join-vehicle"
          >
            <select
              id="join-vehicle"
              value={vehicleType}
              onChange={(event) => setVehicleType(event.target.value)}
              className="h-11 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="car">{locale === "ar" ? "سيارة" : "Car"}</option>
              <option value="motorcycle">{locale === "ar" ? "دراجة نارية" : "Motorcycle"}</option>
              <option value="electric_bike">{locale === "ar" ? "دراجة كهربائية" : "E-bike"}</option>
              <option value="bicycle">{locale === "ar" ? "دراجة هوائية" : "Bicycle"}</option>
              <option value="walking">{locale === "ar" ? "مشي" : "Walking"}</option>
            </select>
          </Field>
        ) : (
          <Field label={locale === "ar" ? "المجال المطلوب" : "Desired area"} htmlFor="join-role">
            <select
              id="join-role"
              value={desiredRole}
              onChange={(event) => setDesiredRole(event.target.value)}
              className="h-11 w-full rounded-md border bg-background px-3 text-sm"
            >
              {roleOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field
          label={locale === "ar" ? "أوقات التوفر" : "Availability"}
          htmlFor="join-availability"
        >
          <Input
            id="join-availability"
            value={availability}
            maxLength={160}
            onChange={(event) => setAvailability(event.target.value)}
            placeholder={locale === "ar" ? "مثال: يوميًا من 4م إلى 11م" : "e.g. Daily, 4–11 PM"}
          />
        </Field>
      </div>
      <Field
        label={locale === "ar" ? "الخبرة وملاحظاتك" : "Experience and notes"}
        htmlFor="join-experience"
      >
        <Textarea
          id="join-experience"
          rows={4}
          value={experience}
          maxLength={1200}
          onChange={(event) => setExperience(event.target.value)}
        />
      </Field>
      <Field
        label={
          kind === "delivery_team"
            ? locale === "ar"
              ? "رخصة القيادة أو مستند داعم"
              : "Driver licence or supporting document"
            : locale === "ar"
              ? "السيرة الذاتية"
              : "CV / résumé"
        }
        htmlFor="join-document"
      >
        <label
          htmlFor="join-document"
          className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-dashed px-4 text-sm hover:bg-secondary/50"
        >
          <Upload className="size-5 text-primary" />
          <span className="min-w-0 flex-1 truncate">
            {document?.name ??
              (locale === "ar" ? "PDF أو صورة — حتى 10 ميجابايت" : "PDF or image — up to 10 MB")}
          </span>
        </label>
        <Input
          id="join-document"
          type="file"
          className="sr-only"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          required={kind === "delivery_team"}
          onChange={(event) => setDocument(event.target.files?.[0] ?? null)}
        />
      </Field>
      <Button type="submit" className="min-h-12 w-full sm:w-auto" disabled={busy}>
        {busy ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
        {locale === "ar" ? "إرسال طلب الانضمام" : "Submit application"}
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

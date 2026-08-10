/**
 * Public correction / removal request form for a guide entity. No account is
 * required: the row is created as `new` and lands in the admin queue, and a
 * removal decision only ever unpublishes the record.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { OsmAttribution } from "@/components/marketplace/guide/OsmAttribution";
import { supabase } from "@/integrations/supabase/client";
import {
  REMOVAL_TYPE_LABEL,
  useSubmitGuideRemovalRequest,
  type RemovalRequestType,
} from "@/lib/mkt-guide-legal";
import { useSession } from "@/lib/session";

const title = "طلب تعديل أو إزالة من دليل كَحيل";
const description =
  "أرسل طلب تصحيح بيانات جهة أو إزالتها من دليل كَحيل. كل طلب يُراجَع يدويًا، والإزالة إخفاء من العرض العام مع تسجيل السبب.";

const searchSchema = z.object({
  place: z.string().optional(),
  name: z.string().optional(),
});

export const Route = createFileRoute("/guides/removal-request")({
  ssr: "data-only",
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: `${title} — كَحيل` },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: RemovalRequestPage,
});

const formSchema = z.object({
  entityName: z.string().trim().min(2, "اكتب اسم الجهة").max(200),
  reporterRole: z.string().trim().min(2, "اختر صفتك").max(100),
  requestType: z.enum(["correction", "removal"]),
  description: z.string().trim().min(10, "اشرح الطلب بما لا يقل عن ١٠ أحرف").max(2000),
  contact: z.string().trim().min(5, "اكتب وسيلة تواصل صحيحة").max(200),
});

const ROLES = ["مالك الجهة", "مفوّض عن الجهة", "موظف في الجهة", "جهة رسمية", "أخرى"];

const field =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-desc outline-none focus:border-primary";

function RemovalRequestPage() {
  const search = Route.useSearch();
  const { session } = useSession();
  const submit = useSubmitGuideRemovalRequest();

  const [entityName, setEntityName] = useState(search.name ?? "");
  const [reporterRole, setReporterRole] = useState(ROLES[0]!);
  const [requestType, setRequestType] = useState<RemovalRequestType>("correction");
  const [descriptionText, setDescriptionText] = useState("");
  const [contact, setContact] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const send = async () => {
    const parsed = formSchema.safeParse({
      entityName,
      reporterRole,
      requestType,
      description: descriptionText,
      contact,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});

    let placeId: string | null = null;
    if (search.place) {
      const { data } = await supabase
        .from("mkt_guide_places")
        .select("id")
        .eq("slug", search.place)
        .maybeSingle();
      placeId = (data as { id: string } | null)?.id ?? null;
    }

    submit.mutate(
      {
        placeId,
        entityName: parsed.data.entityName,
        reporterRole: parsed.data.reporterRole,
        requestType: parsed.data.requestType,
        description: parsed.data.description,
        contact: parsed.data.contact,
        userId: session?.user.id ?? null,
      },
      {
        onSuccess: () => setDone(true),
        onError: () => toast.error("تعذّر إرسال الطلب، حاول لاحقًا."),
      },
    );
  };

  return (
    <MarketShell>
      <main className="mx-auto w-full max-w-[720px] px-4 py-6 sm:px-6">
        <h1 className="text-page font-black">طلب تعديل أو إزالة</h1>
        <p className="mt-1 text-desc font-bold leading-6 text-muted-foreground">
          {description}{" "}
          <Link
            to="/legal/directory-policy"
            className="underline decoration-dotted underline-offset-2 hover:text-primary"
          >
            سياسة الدليل
          </Link>
        </p>

        {done ? (
          <section className="mt-4 rounded-2xl border border-primary/25 bg-primary/6 p-4">
            <p className="flex items-center gap-2 text-desc font-black text-primary">
              <CheckCircle2 className="size-4" aria-hidden />
              وصلنا طلبك وسيُراجع يدويًا.
            </p>
            <p className="mt-1.5 text-desc font-bold text-muted-foreground">
              سنتواصل معك على وسيلة التواصل التي كتبتها عند الحاجة إلى توضيح.
            </p>
            <Link
              to="/guides/syria"
              className="mt-3 inline-flex h-10 items-center rounded-2xl border border-border px-4 text-desc font-black"
            >
              العودة إلى الدليل
            </Link>
          </section>
        ) : (
          <section className="mt-4 space-y-3 rounded-2xl border border-border/80 bg-card p-4">
            <Field label="اسم الجهة" error={errors["entityName"]}>
              <input
                className={field}
                value={entityName}
                onChange={(event) => setEntityName(event.target.value)}
                placeholder="الاسم كما يظهر في الدليل"
              />
            </Field>

            <Field label="صفة المُبلِّغ" error={errors["reporterRole"]}>
              <select
                className={field}
                value={reporterRole}
                onChange={(event) => setReporterRole(event.target.value)}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="نوع الطلب" error={errors["requestType"]}>
              <div className="flex gap-2">
                {(["correction", "removal"] as RemovalRequestType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setRequestType(type)}
                    className={`h-10 flex-1 rounded-xl border text-desc font-black ${
                      requestType === type
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    {REMOVAL_TYPE_LABEL[type]}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="وصف الطلب" error={errors["description"]}>
              <textarea
                rows={4}
                className="w-full resize-none rounded-xl border border-input bg-background p-3 text-desc outline-none focus:border-primary"
                value={descriptionText}
                onChange={(event) => setDescriptionText(event.target.value)}
                placeholder="اشرح ما يجب تصحيحه، أو سبب طلب الإزالة"
              />
            </Field>

            <Field label="وسيلة تواصل" error={errors["contact"]}>
              <input
                className={field}
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder="جوال أو بريد إلكتروني"
              />
            </Field>

            <p className="flex items-start gap-1.5 text-desc font-bold leading-5 text-muted-foreground">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
              الإزالة تعني إخفاء السجل من العرض العام مع تسجيل السبب والتاريخ، ولا يُحذف السجل
              نهائيًا.
            </p>

            <button
              type="button"
              disabled={submit.isPending}
              onClick={() => void send()}
              className="inline-flex h-11 items-center rounded-2xl bg-primary px-5 text-desc font-black text-primary-foreground disabled:opacity-50"
            >
              {submit.isPending ? "جاري الإرسال…" : "إرسال الطلب"}
            </button>
          </section>
        )}

        <OsmAttribution className="mt-4" />
      </main>
    </MarketShell>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-desc font-black">{label}</label>
      {children}
      {error ? <p className="text-desc font-bold text-destructive">{error}</p> : null}
    </div>
  );
}

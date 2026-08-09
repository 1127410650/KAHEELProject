/**
 * خدمة «جيب لي» — الصفحة العامة لإنشاء الطلب.
 *
 * الفكرة: المستخدم ما بيحتاج متجر مسجّل ولا كتالوج. يكتب شو بدّو بوصف حرّ
 * («جيبلي منقوشة من فرن أبو أحمد»)، يرفق صورة إذا لزم، يحدّد من وين ولوين،
 * وتكلفة التوصيل تبقى **بانتظار عرض الكابتن** — لا رقم مُخترع من المنصة.
 *
 * • الصفحة عامة للقراءة (الخدمات تُقرأ للزوار) والإرسال يحتاج تسجيل دخول.
 * • الصورة تُضغط في المتصفح قبل الرفع (WebP ≤ 300KB) عبر `mkt-errands`.
 * • كل الأبعاد صريحة والحالات محجوزة ⇒ صفر هزّة تخطيط.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Camera, Loader2, PackageSearch, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { Mascot } from "@/components/marketplace/campaign/Mascot";
import { ErrandPointPicker } from "@/components/marketplace/errands/ErrandPointPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { canonicalLinks, canonicalMeta } from "@/lib/share-links";
import {
  createErrandRequest,
  errandInputError,
  serviceName,
  serviceTagline,
  uploadErrandPhoto,
  useErrandServices,
  type ErrandPoint,
  type ErrandService,
} from "@/lib/mkt-errands";

export const Route = createFileRoute("/errands")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "جيب لي — اطلب أي شي من أي مكان | كَحيل" },
      {
        name: "description",
        content:
          "اطلب أي شي من أي مكان في مدينتك: اكتب طلبك بوصفك الحر، وكابتن كَحيل يجيبه لك ويعطيك سعر التوصيل قبل ما توافق.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "جيب لي — اطلب أي شي من أي مكان | كَحيل" },
      {
        property: "og:description",
        content: "طلب حرّ، عرض سعر من الكابتن، وتتبّع للطلب من الاستلام حتى التسليم.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...canonicalMeta("/errands"),
    ],
    links: canonicalLinks("/errands"),
  }),
  component: ErrandsPage,
});

function ErrandsPage() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { session } = useSession();
  const navigate = useNavigate();
  const services = useErrandServices();
  const fileInput = useRef<HTMLInputElement>(null);

  const [serviceSlug, setServiceSlug] = useState("jeb-li");
  const [details, setDetails] = useState("");
  const [budget, setBudget] = useState("");
  const [pickup, setPickup] = useState<ErrandPoint | null>(null);
  const [dropoff, setDropoff] = useState<ErrandPoint | null>(null);
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const active: ErrandService | undefined = useMemo(
    () => services.data?.find((service) => service.slug === serviceSlug),
    [services.data, serviceSlug],
  );

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(ar ? "اختر صورة فقط." : "Images only.");
      return;
    }
    if (photo) URL.revokeObjectURL(photo.preview);
    setPhoto({ file, preview: URL.createObjectURL(file) });
  }

  function clearPhoto() {
    if (photo) URL.revokeObjectURL(photo.preview);
    setPhoto(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!session) {
      void navigate({ to: "/auth", search: { redirect: "/errands" } as never });
      return;
    }
    const point = dropoff ?? null;
    const input = {
      serviceSlug,
      details,
      dropoff: point ?? { label: "" },
      ...(active?.needs_pickup && pickup ? { pickup } : {}),
      ...(budget.trim() ? { budgetEstimate: Number(budget) } : {}),
    };
    const problem = errandInputError(input, ar);
    if (problem) {
      toast.error(problem);
      return;
    }

    setSubmitting(true);
    try {
      let photoPath: string | null = null;
      if (photo) photoPath = await uploadErrandPhoto(photo.file);
      const id = await createErrandRequest({ ...input, photoPath });
      toast.success(
        ar ? "تم إرسال طلبك — بانتظار عرض الكابتن." : "Request sent — waiting for a captain's offer.",
      );
      void navigate({ to: "/my/errands/$id", params: { id } });
    } catch (error) {
      toast.error(
        error instanceof Error && error.message === "AUTH_REQUIRED"
          ? ar
            ? "سجّل الدخول أولًا."
            : "Sign in first."
          : ar
            ? "تعذّر إرسال الطلب — حاول مرة أخرى."
            : "Could not send the request — try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <MarketShell>
      <div className="mx-auto w-full max-w-2xl px-3 pb-24 pt-3">
        {/* رأس الخدمة: كَحيلان بيوعد إنه هو الواسطة */}
        <section className="relative mb-3 overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/15 via-background to-background p-3">
          <div className="flex items-center gap-3">
            <div className="h-[84px] w-[68px] shrink-0">
              <Mascot
                name="kaheelan"
                pose="tray"
                lang={ar ? "ar" : "en"}
                size="sm"
                priority
                className="h-full w-auto"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-black leading-tight text-foreground">
                {ar ? "جيب لي" : "Get it for me"}
              </h1>
              <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
                {ar
                  ? "اكتب شو بدّك من أي مكان… والكابتن يجيبه لك. وطبعًا بواسطتي أنا."
                  : "Ask for anything from anywhere — a captain brings it to you."}
              </p>
            </div>
          </div>
        </section>

        {/* الخدمات المرافقة */}
        <section className="mb-3">
          <h2 className="mb-2 text-sm font-bold text-foreground">
            {ar ? "شو بدّك تعمل؟" : "What do you need?"}
          </h2>
          {services.isLoading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-[76px] rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(services.data ?? []).map((service) => {
                const selected = service.slug === serviceSlug;
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setServiceSlug(service.slug)}
                    className={`h-[76px] rounded-2xl border p-2.5 text-start transition ${
                      selected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border/70 bg-card/60 hover:border-primary/50"
                    }`}
                  >
                    <span
                      className={`block truncate text-[13px] font-bold ${
                        selected ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {serviceName(service, ar)}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-muted-foreground">
                      {serviceTagline(service, ar)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <form onSubmit={submit} className="grid gap-3">
          {/* الوصف الحر */}
          <div className="rounded-2xl border border-border/70 bg-card/60 p-3">
            <Label className="text-sm font-bold text-foreground">
              {ar ? "اكتب طلبك بالتفصيل" : "Describe your order"}
            </Label>
            <p className="mb-2 mt-0.5 text-[11px] text-muted-foreground">
              {ar
                ? "بدون قوائم ولا تصنيفات — اكتب زي ما تحكي: «جيبلي كيلو منقوشة زعتر من فرن أبو أحمد»."
                : "No catalogue needed — write it the way you'd say it."}
            </p>
            <Textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={5}
              maxLength={1200}
              placeholder={
                ar
                  ? "مثال: جيبلي ٢ كيلو بندورة و علبة لبن من محل الحسبة، والباقي خليه معك."
                  : "e.g. 2 kg tomatoes and a yoghurt tub from the market."
              }
              className="resize-none text-sm"
            />
            <div className="mt-1 text-end text-[11px] text-muted-foreground">
              {details.length}/1200
            </div>

            {/* المرفق */}
            <div className="mt-2 flex items-center gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => pickPhoto(event.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-[11px]"
                onClick={() => fileInput.current?.click()}
              >
                <Camera className="h-3.5 w-3.5" />
                {ar ? "إرفاق صورة" : "Attach a photo"}
              </Button>
              {photo ? (
                <div className="flex items-center gap-2">
                  <img
                    src={photo.preview}
                    alt={ar ? "معاينة الصورة المرفقة" : "Attachment preview"}
                    width={44}
                    height={44}
                    className="h-11 w-11 rounded-lg border border-border/70 object-cover"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-[11px] text-destructive"
                    onClick={clearPhoto}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {ar ? "إزالة" : "Remove"}
                  </Button>
                </div>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  {ar ? "تُضغط تلقائيًا قبل الرفع" : "Compressed automatically"}
                </span>
              )}
            </div>
          </div>

          {/* المواقع */}
          {active?.needs_pickup ? (
            <ErrandPointPicker
              ar={ar}
              title={ar ? "الاستلام من" : "Pick up from"}
              hint={ar ? "إذا كان المكان معروف اكتب اسمه فقط." : "A known place name is enough."}
              value={pickup}
              onChange={setPickup}
            />
          ) : null}
          <ErrandPointPicker
            ar={ar}
            title={ar ? "التوصيل إلى" : "Deliver to"}
            hint={ar ? "عنوانك أو أي مكان تختاره." : "Your address or any place you choose."}
            value={dropoff}
            onChange={setDropoff}
          />

          {/* الميزانية وتكلفة التوصيل */}
          <div className="grid gap-2 rounded-2xl border border-border/70 bg-card/60 p-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label className="text-[11px] text-muted-foreground">
                {ar ? "ميزانية تقديرية للطلب (اختياري)" : "Rough budget (optional)"}
              </Label>
              <Input
                value={budget}
                onChange={(event) => setBudget(event.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                placeholder="0"
                className="h-9 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-[11px] text-muted-foreground">
                {ar ? "تكلفة التوصيل" : "Delivery fee"}
              </Label>
              <div className="flex h-9 items-center rounded-md border border-dashed border-primary/40 bg-primary/5 px-2.5 text-[12px] font-bold text-primary">
                <PackageSearch className="me-1.5 h-3.5 w-3.5" />
                {ar ? "بانتظار عرض الكابتن" : "Waiting for the captain's offer"}
              </div>
            </div>
          </div>

          {session ? (
            <Button type="submit" disabled={submitting} className="h-11 gap-2 text-sm font-bold">
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {ar ? "أرسل الطلب للكباتن" : "Send to captains"}
            </Button>
          ) : (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 text-center">
              <p className="text-[12.5px] font-semibold text-foreground">
                {ar
                  ? "سجّل دخولك حتى نوصل طلبك للكباتن ونتابعه معك."
                  : "Sign in so we can send your request to captains."}
              </p>
              <Button asChild size="sm" className="mt-2 h-9 text-[12.5px] font-bold">
                <Link to="/auth">{ar ? "تسجيل الدخول" : "Sign in"}</Link>
              </Button>
            </div>
          )}

          <div className="flex items-center justify-center gap-3 pt-1 text-[11.5px] text-muted-foreground">
            <Link to="/my/errands" className="font-semibold text-primary hover:underline">
              {ar ? "طلباتي" : "My requests"}
            </Link>
            <span aria-hidden="true">•</span>
            <Link to="/my/captain" className="font-semibold text-primary hover:underline">
              {ar ? "سجّل كابتن" : "Become a captain"}
            </Link>
          </div>
        </form>
      </div>
    </MarketShell>
  );
}

/** يُستخدم في الاختبارات فقط للتأكد أن الأيقونة مستوردة عند الحاجة. */
export const ERRAND_CLOSE_ICON = X;

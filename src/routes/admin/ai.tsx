/**
 * /admin/ai — «خدمات الذكاء»: التوليد والنصاعة في شاشة واحدة.
 *
 * التوليد يعمل عبر بوابة Lovable AI (بلا مفتاح خارجي). النصاعة (تكبير + تهدئة
 * ضجيج + إبراز حدود) تعمل محليًا في المتصفح بلا تكلفة، وترتفع تلقائيًا إلى
 * مزوّد خارجي عالي الجودة لحظة إضافة السر `IMAGE_ENHANCE_API_KEY` — المفتاح
 * يُقرأ في دالة خادم ولا يصل إلى المتصفح إطلاقًا.
 *
 * كل عملية تُسجَّل في السجل الموحّد `mkt_ai_usage` وتخضع لسقف شهري مستقل لكل
 * خدمة مع إيقاف تلقائي عند السقف. الأصل لا يُستبدل: النسخة المحسّنة تُعتمد
 * كنسخة مستقلة بعلامة ✨ ويُؤرشف الأصل قبلها.
 */
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ExternalLink, Images, KeyRound, Loader2, Sparkles, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/marketplace/AdminShell";
import { AdminCard, AdminEmptyState, AdminPageHead, AdminTableScroll } from "@/components/admin/AdminPage";
import { AiSpendCard } from "@/components/admin/AiSpendCard";
import { EnhanceCompare } from "@/components/admin/EnhanceCompare";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatNumber } from "@/lib/format";
import { loadAiUsage, archiveOriginal, saveEnhancedCopy, blobToBase64, base64ToBlob } from "@/lib/mkt-ai-services";
import { enhanceErrorKey, enhanceImageLocally, withEnhanceAudit } from "@/lib/mkt-image-enhance";
import { getEnhanceProviderStatus, upscaleImageExternally } from "@/lib/mkt-image-enhance.functions";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/admin/ai")({
  head: () => ({
    meta: [
      { title: "خدمات الذكاء — لوحة كَحيل" },
      { name: "description", content: "توليد الصور والنصاعة: العدّادات والأسقف والسجل واعتماد النسخ المحسّنة." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "خدمات الذكاء — لوحة كَحيل" },
      { property: "og:description", content: "عدّادات الصرف والأسقف وسجل العمليات لخدمتَي التوليد والنصاعة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiServicesPage,
});

const MAX_BATCH = 10;

interface WorkItem {
  id: string;
  name: string;
  beforeUrl: string;
  afterUrl: string | null;
  blob: Blob;
  enhanced: Blob | null;
  state: "ready" | "running" | "done" | "approved" | "failed";
  savedUrl: string | null;
  path: "local" | "external";
}

function UsageTable({ service }: { service: "generation" | "enhancement" }) {
  const usage = useQuery({
    queryKey: ["mkt", "admin", "ai-usage", service],
    queryFn: () => loadAiUsage(service, 20),
    staleTime: 60_000,
  });

  if (usage.isLoading) return <Skeleton className="h-24 w-full rounded-[var(--r-card)]" />;
  const rows = usage.data ?? [];
  if (rows.length === 0) {
    return (
      <AdminEmptyState
        icon={Sparkles}
        title="لا عمليات بعد"
        hint="سيظهر هنا من نفّذ العملية ومتى وتكلفتها التقديرية."
      />
    );
  }

  return (
    <AdminTableScroll>
      <table className="w-full min-w-[520px] text-start text-[14px]">
        <thead>
          <tr className="text-muted-foreground">
            <th className="p-2 text-start font-bold">المنفّذ</th>
            <th className="p-2 text-start font-bold">العملية</th>
            <th className="p-2 text-start font-bold">الحالة</th>
            <th className="p-2 text-start font-bold">التكلفة</th>
            <th className="p-2 text-start font-bold">الوقت</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="p-2 font-bold text-foreground">{row.actor_name ?? "—"}</td>
              <td className="max-w-[220px] truncate p-2 text-muted-foreground">
                {row.action ?? row.prompt ?? "—"}
              </td>
              <td className="p-2 text-muted-foreground">{row.status}</td>
              <td className="p-2 tabular-nums text-foreground">{row.cost_estimate.toFixed(4)}$</td>
              <td className="p-2 tabular-nums text-muted-foreground">{formatDateTime(row.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminTableScroll>
  );
}

function AiServicesPage() {
  const { t } = useI18n();
  const providerStatus = useServerFn(getEnhanceProviderStatus);
  const externalUpscale = useServerFn(upscaleImageExternally);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [running, setRunning] = useState(false);

  const provider = useQuery({
    queryKey: ["mkt", "admin", "ai", "enhance-provider"],
    queryFn: () => providerStatus(),
    staleTime: 60_000,
  });

  const pending = useMemo(() => items.filter((item) => item.state === "ready").length, [items]);

  function pickFiles(files: FileList | null) {
    if (!files) return;
    const picked = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, MAX_BATCH);
    if (picked.length === 0) return;
    setItems(
      picked.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        beforeUrl: URL.createObjectURL(file),
        afterUrl: null,
        blob: file,
        enhanced: null,
        state: "ready" as const,
        savedUrl: null,
        path: "local" as const,
      })),
    );
  }

  function patch(id: string, next: Partial<WorkItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...next } : item)));
  }

  /** تحسين صورة واحدة: خارجي عالي الجودة إن توفّر المفتاح، وإلا محلي. */
  async function enhanceOne(item: WorkItem) {
    patch(item.id, { state: "running" });
    try {
      const useExternal = provider.data?.configured === true;
      const { result } = await withEnhanceAudit(
        {
          provider: useExternal ? "replicate:real-esrgan" : "local:canvas",
          purpose: "admin.ai.enhance",
          unitUsd: useExternal ? (provider.data?.unitUsd ?? 0) : 0,
        },
        async () => {
          let source = item.blob;
          if (useExternal) {
            const external = await externalUpscale({
              data: { b64: await blobToBase64(source), mime: "image/webp", scale: 2 },
            });
            if (external.ok && external.b64) {
              source = base64ToBlob(external.b64, external.mime ?? "image/png");
            }
          }
          const enhanced = await enhanceImageLocally(source, { targetWidth: 1536 });
          return { result: enhanced, bytes: enhanced.bytes };
        },
      );
      patch(item.id, {
        state: "done",
        enhanced: result.blob,
        afterUrl: URL.createObjectURL(result.blob),
        path: useExternal ? "external" : "local",
      });
    } catch (error) {
      patch(item.id, { state: "failed" });
      toast.error(t(enhanceErrorKey(error)));
      throw error;
    }
  }

  async function enhanceAll() {
    setRunning(true);
    try {
      for (const item of items.filter((row) => row.state === "ready")) {
        await enhanceOne(item);
      }
    } catch {
      // كل عنصر يعرض حالته، والرسالة ظهرت مرة واحدة.
    } finally {
      setRunning(false);
    }
  }

  /** اعتماد: يؤرشف الأصل أولًا ثم يحفظ النسخة المحسّنة كملف مستقل. */
  async function approve(item: WorkItem) {
    if (!item.enhanced) return;
    try {
      await archiveOriginal(item.blob, item.name);
      const saved = await saveEnhancedCopy(item.enhanced, item.name);
      patch(item.id, { state: "approved", savedUrl: saved.url });
      toast.success("تم اعتماد النسخة المحسّنة وحُفظ الأصل بجانبها.");
    } catch {
      toast.error("تعذّر حفظ النسخة المحسّنة.");
    }
  }

  return (
    <AdminShell title="خدمات الذكاء">
      <AdminPageHead
        title="خدمات الذكاء"
        description="توليد الصور والنصاعة: العدّادات والأسقف والسجل واعتماد النسخ المحسّنة — الأصل لا يُستبدل."
      />

      <AiSpendCard />

      <div className="mt-[var(--sp-4)] grid grid-cols-1 gap-[var(--sp-4)] lg:grid-cols-2">
        <AdminCard
          title="توليد الصور"
          description="يعمل الآن عبر بوابة Lovable AI — لا مفتاح خارجي مطلوب."
        >
          <p className="flex items-center gap-2 text-[16px] font-bold text-foreground">
            <CheckCircle2 className="size-4 text-primary" aria-hidden />
            الخدمة مفعّلة · مسؤول المنصة فقط
          </p>
          <p className="mt-1 text-[14px] text-muted-foreground">
            التكلفة تُحسب لكل صورة وتُقيَّد على سقف «توليد الصور» أعلاه، ويتوقف التوليد تلقائيًا عند السقف.
          </p>
          <div className="mt-[var(--sp-3)] flex flex-wrap gap-[var(--sp-2)]">
            <Link
              to="/admin/designs"
              className="k-press inline-flex min-h-11 items-center gap-2 rounded-[var(--r-btn,12px)] bg-primary px-4 text-[14px] font-bold text-primary-foreground"
            >
              <Sparkles className="size-4" aria-hidden />
              استوديو التصاميم
            </Link>
            <Link
              to="/admin/appearance"
              className="k-press inline-flex min-h-11 items-center gap-2 rounded-[var(--r-btn,12px)] border border-border px-4 text-[14px] font-bold text-foreground"
            >
              <Images className="size-4" aria-hidden />
              فتحات الوسائط
            </Link>
          </div>
          <div className="mt-[var(--sp-4)]">
            <p className="mb-[var(--sp-2)] text-[16px] font-bold text-foreground">آخر عمليات التوليد</p>
            <UsageTable service="generation" />
          </div>
        </AdminCard>

        <AdminCard
          title="النصاعة — تحسين الصور"
          description="تكبير + تهدئة ضجيج + إبراز حدود، ثم إعادة ضغط WebP بحدّ ٣٠٠KB."
        >
          {provider.isLoading ? (
            <Skeleton className="h-24 w-full rounded-[var(--r-card)]" />
          ) : provider.data?.configured ? (
            <p className="flex items-center gap-2 text-[16px] font-bold text-foreground">
              <CheckCircle2 className="size-4 text-primary" aria-hidden />
              المزوّد الخارجي مفعّل: {provider.data.provider} · ≈{provider.data.unitUsd.toFixed(4)}$ للصورة
            </p>
          ) : (
            <div className="rounded-[var(--r-card)] border border-border bg-secondary/40 p-[var(--sp-3)]">
              <p className="flex items-center gap-2 text-[16px] font-bold text-foreground">
                <KeyRound className="size-4 text-primary" aria-hidden />
                المسار المحلي يعمل الآن بلا تكلفة — والجودة العالية بانتظار مفتاح واحد
              </p>
              <ol className="mt-[var(--sp-2)] list-inside list-decimal space-y-1 text-[14px] text-muted-foreground">
                <li>
                  أنشئ حسابًا في {provider.data?.provider ?? "Replicate"} وانسخ مفتاح الـ API من{" "}
                  <a
                    href={provider.data?.signupUrl ?? "https://replicate.com/account/api-tokens"}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-primary underline"
                  >
                    صفحة المفاتيح
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </li>
                <li>
                  افتح إعدادات المشروع ← الأسرار، وأضف السر باسم{" "}
                  <code className="rounded bg-card px-1.5 py-0.5 font-bold text-foreground">
                    {provider.data?.secretName ?? "IMAGE_ENHANCE_API_KEY"}
                  </code>
                </li>
                <li>تُفعّل الجودة العالية تلقائيًا بعد الإضافة — بلا أي تعديل آخر.</li>
              </ol>
              <p className="mt-[var(--sp-2)] text-[14px] font-bold text-foreground">
                التكلفة التقديرية: ≈{(provider.data?.unitUsd ?? 0.0023).toFixed(4)}$ للصورة · سقف شهري افتراضي 100$ مع إيقاف تلقائي.
              </p>
            </div>
          )}

          <div className="mt-[var(--sp-4)]">
            <p className="mb-[var(--sp-2)] text-[16px] font-bold text-foreground">آخر عمليات النصاعة</p>
            <UsageTable service="enhancement" />
          </div>
        </AdminCard>
      </div>

      <div className="mt-[var(--sp-4)]">
        <AdminCard
          title="ورشة النصاعة"
          description={`اختر حتى ${formatNumber(MAX_BATCH)} صور، حسّنها، قارن قبل/بعد، ثم اعتمد النسخة المحسّنة بجانب الأصل.`}
        >
          <div className="flex flex-wrap items-center gap-[var(--sp-2)]">
            <label className="k-press inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--r-btn,12px)] border border-border px-4 text-[14px] font-bold text-foreground">
              <Upload className="size-4 text-primary" aria-hidden />
              اختر صورًا
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => pickFiles(event.target.files)}
              />
            </label>
            <button
              type="button"
              onClick={() => void enhanceAll()}
              disabled={running || pending === 0}
              className="k-press inline-flex min-h-11 items-center gap-2 rounded-[var(--r-btn,12px)] bg-primary px-4 text-[14px] font-bold text-primary-foreground disabled:opacity-60"
            >
              {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Wand2 className="size-4" aria-hidden />}
              حسّن الكل ({formatNumber(pending)})
            </button>
          </div>

          {items.length === 0 ? (
            <div className="mt-[var(--sp-3)]">
              <AdminEmptyState
                icon={Wand2}
                title="لا صور مختارة"
                hint="اختر صورًا من جهازك لتجربة النصاعة قبل اعتمادها في المكتبة."
              />
            </div>
          ) : (
            <ul className="mt-[var(--sp-3)] grid grid-cols-1 gap-[var(--sp-4)] lg:grid-cols-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="min-w-0 rounded-[var(--r-card)] border border-border bg-card p-[var(--sp-3)]"
                >
                  <p className="flex items-center gap-2 text-[16px] font-bold text-foreground">
                    <span className="min-w-0 truncate">{item.name}</span>
                    {item.state === "approved" ? (
                      <span className="ms-auto shrink-0 rounded-[var(--r-chip,12px)] bg-primary/10 px-2 py-0.5 text-[14px] font-bold text-primary">
                        ✨ معتمدة
                      </span>
                    ) : null}
                  </p>
                  {item.afterUrl ? (
                    <div className="mt-[var(--sp-2)]">
                      <EnhanceCompare beforeUrl={item.beforeUrl} afterUrl={item.afterUrl} alt={item.name} />
                    </div>
                  ) : (
                    <img
                      src={item.beforeUrl}
                      alt={item.name}
                      className="mt-[var(--sp-2)] aspect-[4/3] w-full rounded-[var(--r-card)] border border-border object-cover"
                    />
                  )}
                  <div className="mt-[var(--sp-3)] flex flex-wrap items-center gap-[var(--sp-2)]">
                    <button
                      type="button"
                      onClick={() => void enhanceOne(item).catch(() => undefined)}
                      disabled={item.state === "running" || running}
                      className="k-press inline-flex min-h-11 items-center gap-2 rounded-[var(--r-btn,12px)] border border-border px-4 text-[14px] font-bold text-foreground disabled:opacity-60"
                    >
                      {item.state === "running" ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Wand2 className="size-4 text-primary" aria-hidden />
                      )}
                      حسّن الصورة
                    </button>
                    <button
                      type="button"
                      onClick={() => void approve(item)}
                      disabled={!item.enhanced || item.state === "approved"}
                      className="k-press inline-flex min-h-11 items-center gap-2 rounded-[var(--r-btn,12px)] bg-primary px-4 text-[14px] font-bold text-primary-foreground disabled:opacity-60"
                    >
                      <CheckCircle2 className="size-4" aria-hidden />
                      اعتماد
                    </button>
                    <span className="text-[14px] text-muted-foreground">
                      {item.path === "external" ? "مسار خارجي" : "مسار محلي"}
                      {item.state === "failed" ? " · تعذّر التحسين" : ""}
                    </span>
                  </div>
                  {item.savedUrl ? (
                    <a
                      href={item.savedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-[var(--sp-2)] inline-flex items-center gap-1 text-[14px] font-bold text-primary underline"
                    >
                      رابط النسخة المعتمدة
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </AdminShell>
  );
}

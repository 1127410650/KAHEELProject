/**
 * «ولّد بالذكاء الاصطناعي» — استوديو صور الهوية داخل لوحة الإدارة.
 *
 * الأداة تُفتح من مكتبة تصاميمي ومن كل فتحة صورة. المتصفح يحمل الوصف فقط:
 * فحص صفة المدير والسقف اليومي والسقف الشهري بالدولار كلها في القاعدة قبل أي
 * تكلفة، والمفتاح لا يترك الخادم. كل مرشّح يُختَم باسم كَحيل قبل المعاينة، ولا
 * يُكتب أي شيء في التخزين إلا عند «حفظ في المكتبة» أو «ربط بالفتحة».
 */
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ImageUp, Loader2, Save, Sparkles, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { BRAND_STAMP_DEFAULTS } from "@/lib/kaheel-brand-stamp";
import { readableSize } from "@/lib/media-compress";
import { generateBrandImages, MAX_PER_REQUEST } from "@/lib/mkt-ai-studio.functions";
import {
  STUDIO_IDEAS,
  STUDIO_SIZES,
  attachCandidateToSlot,
  formatUsd,
  prepareCandidate,
  referenceToBase64,
  saveCandidateToLibrary,
  setAiMonthlyBudget,
  useAiBudget,
  useAiStudioJobs,
  type StudioCandidate,
  type StudioSizeKey,
} from "@/lib/mkt-ai-studio";
import type { MediaSlotRow } from "@/lib/mkt-media-slots";

const REASONS: Record<string, string> = {
  not_authorized: "التوليد لمدير المنصة فقط.",
  daily_limit_reached: "بلغت الحد اليومي (٣٠ صورة).",
  monthly_budget_reached: "توقّف التوليد: بلغت السقف الشهري للإنفاق.",
  blocked_prompt: "الوصف مرفوض: ممنوع أشخاص حقيقيون أو شعارات جهات أخرى أو محتوى مخالف.",
  invalid_prompt: "الوصف قصير جدًا.",
  gateway_error: "تعذّر التوليد الآن — أعد المحاولة.",
};

interface Props {
  /** عند التوليد لفتحة محددة: يظهر زر «ربط بالفتحة». */
  slot?: MediaSlotRow;
  /** لتحديث الشاشة بعد الربط أو الحفظ. */
  onChanged?: () => void;
}

export function BrandImageStudio({ slot, onChanged }: Props) {
  const generate = useServerFn(generateBrandImages);
  const budget = useAiBudget(true);
  const jobs = useAiStudioJobs(true);
  const refInput = useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = useState("");
  const [sizeKey, setSizeKey] = useState<StudioSizeKey>(slot ? "banner" : "banner");
  const [count, setCount] = useState(1);
  const [reference, setReference] = useState<{ b64: string; mime: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [capDraft, setCapDraft] = useState("");
  const [candidates, setCandidates] = useState<StudioCandidate[]>([]);

  const status = budget.data;
  const blocked = !!status?.blocked;

  async function pickReference(file: File) {
    try {
      const ready = await referenceToBase64(file);
      setReference({ ...ready, name: file.name });
      toast.success("جُهّزت الصورة المرجعية — اطلب «مثلها بأسلوبنا».");
    } catch {
      toast.error("تعذّر تجهيز الصورة المرجعية.");
    }
  }

  async function run() {
    const text = prompt.trim();
    if (text.length < 4) {
      toast.error("اكتب وصفًا أوضح للصورة.");
      return;
    }
    setBusy(true);
    try {
      const result = await generate({
        data: {
          prompt: text,
          count,
          sizeKey,
          purpose: slot ? "slot" : "library",
          slotKey: slot?.slot_key ?? null,
          refB64: reference?.b64 ?? null,
          refMime: reference?.mime ?? null,
        },
      });

      for (const image of result.images) {
        const candidate = await prepareCandidate(
          image.jobId,
          image.b64,
          image.mime,
          BRAND_STAMP_DEFAULTS,
        );
        setCandidates((previous) => [candidate, ...previous]);
      }
      if (result.reason) toast.error(REASONS[result.reason] ?? REASONS["gateway_error"]!);
      else if (result.images.length > 0) toast.success(`وُلّدت ${result.images.length} صورة مختومة.`);
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      toast.error(REASONS[raw] ?? "تعذّر التوليد — أعد المحاولة.");
    } finally {
      setBusy(false);
      void budget.refetch();
      void jobs.refetch();
    }
  }

  async function keep(candidate: StudioCandidate, mode: "library" | "slot") {
    setSaving(candidate.jobId);
    try {
      if (mode === "slot" && slot) await attachCandidateToSlot(slot, candidate);
      else await saveCandidateToLibrary(candidate);
      setCandidates((previous) => previous.filter((item) => item.jobId !== candidate.jobId));
      onChanged?.();
      void jobs.refetch();
      toast.success(mode === "slot" ? "رُبطت الصورة بالفتحة." : "حُفظت الصورة في المكتبة.");
    } catch {
      toast.error("تعذّر الحفظ — أعد المحاولة.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* العدّاد والسقف */}
      <div className="rounded-2xl border border-border bg-muted/40 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="size-3.5" aria-hidden />
            هذا الشهر: {(status?.count ?? 0).toLocaleString("en-US")} صورة
          </Badge>
          <Badge variant="secondary">التكلفة: {formatUsd(status?.spentUsd ?? 0)}</Badge>
          <Badge variant={blocked ? "destructive" : "secondary"}>
            المتبقي: {formatUsd(status?.remainingUsd ?? 0)} من {formatUsd(status?.monthlyUsd ?? 0)}
          </Badge>
          <Badge variant="secondary">
            اليوم: {(status?.dailyUsed ?? 0).toLocaleString("en-US")}/
            {(status?.dailyLimit ?? 30).toLocaleString("en-US")}
          </Badge>
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="ai-cap" className="text-desc">
              السقف الشهري (دولار)
            </Label>
            <Input
              id="ai-cap"
              inputMode="decimal"
              className="mt-1 h-11 w-32"
              placeholder={String(status?.monthlyUsd ?? 100)}
              value={capDraft}
              onChange={(event) => setCapDraft(event.target.value)}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-11"
            disabled={!capDraft.trim()}
            onClick={() =>
              void (async () => {
                const value = Number(capDraft);
                if (!Number.isFinite(value) || value < 0) {
                  toast.error("أدخل رقمًا صحيحًا.");
                  return;
                }
                try {
                  const next = await setAiMonthlyBudget(value);
                  setCapDraft("");
                  void budget.refetch();
                  toast.success(`صار السقف الشهري ${formatUsd(next)}.`);
                } catch {
                  toast.error("تعذّر تعديل السقف.");
                }
              })()
            }
          >
            <Save className="size-4" aria-hidden />
            حفظ السقف
          </Button>
        </div>
        {blocked ? (
          <p className="mt-2 flex items-center gap-1.5 text-desc font-bold text-destructive">
            <AlertTriangle className="size-4" aria-hidden />
            التوليد موقوف آليًا حتى بداية الشهر أو رفع السقف.
          </p>
        ) : null}
      </div>

      {/* نموذج التوليد */}
      <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
        <div>
          <Label htmlFor="ai-prompt" className="text-desc">
            وصف الصورة بالعربية
          </Label>
          <Textarea
            id="ai-prompt"
            rows={3}
            className="mt-1"
            placeholder="مثال: خلفية فلل فاخرة بغروب دافئ"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <p className="mt-1 text-desc text-muted-foreground">
            كل طلب يُغلَّف تلقائيًا بأسلوب كَحيل (بنفسجي #8A4FFF وتدرّجه، نمط عصري نظيف) وبلا نصوص
            داخل الصورة ولا وجوه أشخاص حقيقيين ولا شعارات جهات أخرى.
          </p>
        </div>

        <ul className="flex flex-wrap gap-2">
          {STUDIO_IDEAS.map((idea) => (
            <li key={idea.label}>
              <Button
                size="sm"
                variant="outline"
                className="h-9"
                onClick={() => {
                  setPrompt(idea.prompt);
                  setSizeKey(idea.sizeKey);
                }}
              >
                {idea.label}
              </Button>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-desc">المقاس</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {STUDIO_SIZES.map((size) => (
                <Button
                  key={size.key}
                  size="sm"
                  variant={sizeKey === size.key ? "default" : "outline"}
                  className="h-11"
                  onClick={() => setSizeKey(size.key)}
                >
                  {size.label}
                  <span className="ms-1 text-desc opacity-70">{size.hint}</span>
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-desc">عدد الصور (حتى {MAX_PER_REQUEST})</Label>
            <div className="mt-1 flex gap-1.5">
              {[1, 2, 3, 4].map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={count === value ? "default" : "outline"}
                  className="h-11 w-11"
                  onClick={() => setCount(value)}
                >
                  {value.toLocaleString("en-US")}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={refInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void pickReference(file);
            }}
          />
          <Button size="sm" variant="outline" className="h-11 gap-1.5" onClick={() => refInput.current?.click()}>
            <ImageUp className="size-4" aria-hidden />
            صورة مرجعية «مثلها بأسلوبنا»
          </Button>
          {reference ? (
            <Badge variant="secondary" className="gap-1">
              {reference.name}
              <button type="button" className="ms-1" onClick={() => setReference(null)} aria-label="إزالة المرجع">
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </Badge>
          ) : null}
        </div>

        <Button className="h-11 w-full gap-1.5" disabled={busy || blocked} onClick={() => void run()}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Wand2 className="size-4" aria-hidden />}
          {busy ? "يولّد…" : "ولّد بالذكاء الاصطناعي"}
        </Button>
      </div>

      {/* المرشّحون */}
      {candidates.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {candidates.map((candidate) => (
            <li key={candidate.jobId} className="rounded-2xl border border-border bg-card p-2">
              <img
                src={candidate.previewUrl}
                alt="صورة مولّدة مختومة باسم كَحيل"
                className="w-full rounded-xl object-cover"
                loading="lazy"
              />
              <p className="mt-1 text-desc text-muted-foreground">
                {candidate.width.toLocaleString("en-US")}×{candidate.height.toLocaleString("en-US")} ·{" "}
                {readableSize(candidate.stamped.size)} · مختومة
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {slot ? (
                  <Button
                    size="sm"
                    className="h-11"
                    disabled={saving === candidate.jobId}
                    onClick={() => void keep(candidate, "slot")}
                  >
                    ربط بالفتحة
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11"
                  disabled={saving === candidate.jobId}
                  onClick={() => void keep(candidate, "library")}
                >
                  حفظ في المكتبة
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-11"
                  onClick={() =>
                    setCandidates((previous) => previous.filter((item) => item.jobId !== candidate.jobId))
                  }
                >
                  <Trash2 className="size-4" aria-hidden />
                  تجاهل
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {/* السجل */}
      <details className="rounded-2xl border border-border bg-card p-3">
        <summary className="cursor-pointer text-desc font-extrabold text-foreground">
          سجل التوليد ({(jobs.data ?? []).length.toLocaleString("en-US")})
        </summary>
        <ul className="mt-2 space-y-1.5">
          {(jobs.data ?? []).map((job) => (
            <li key={job.id} className="text-desc text-muted-foreground">
              <span className="font-bold text-foreground">{job.prompt.slice(0, 60)}</span> ·{" "}
              {job.size_key} · {job.status} · {formatUsd(Number(job.cost_usd ?? 0))} ·{" "}
              {formatDateTime(job.created_at)}
              {job.slot_key ? ` · ${job.slot_key}` : ""}
            </li>
          ))}
          {(jobs.data ?? []).length === 0 ? (
            <li className="text-desc text-muted-foreground">لا توليدات بعد.</li>
          ) : null}
        </ul>
      </details>
    </div>
  );
}

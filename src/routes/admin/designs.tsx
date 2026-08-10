/**
 * /admin/designs — بانِ العروض وبانِ الترويج ومكتبة «تصاميمي».
 *
 * المدير يملأ قالبًا جاهزًا (عنوان، نص، نسبة خصم، خلفية من لوح الهوية أو تدرّج،
 * شكل زخرفي، حركة، وجهة) فتُولَّد بطاقة جاهزة تُربط لاحقًا بأي فتحة إعلانية من
 * وضع التحرير. بانِ الترويج يضيف الجدولة وربط حملة قائمة من `mkt_ad_campaigns`.
 *
 * لا إدخال كود ولا أنماط حرة: كل قيمة إما منتقي لون سداسي، أو رقم مقيّد، أو
 * اختيار من مكتبة مسجّلة في القاعدة، والحفظ يمرّ بدالة SECURITY DEFINER تفحص
 * `mkt_is_platform_admin` وتُنقّي القيم مرة أخرى.
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Megaphone, Save, Sparkles, Tag } from "lucide-react";

import { AdminShell } from "@/components/marketplace/AdminShell";
import { DesignCard } from "@/components/marketplace/design/DesignCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { useAdminCampaigns } from "@/lib/mkt-campaigns";
import {
  LAYOUT_OPTIONS,
  SHAPE_POSITIONS,
  SIZE_OPTIONS,
  SPEED_OPTIONS,
  VARIATION_COUNT,
  generateVariations,
  saveDesignTemplate,
  setDesignTemplateActive,
  useDesignLibrary,
  useDesignTemplates,
  useRefreshDesignTemplates,
  variationPatch,
  type DesignTemplate,
} from "@/lib/mkt-design-library";


export const Route = createFileRoute("/admin/designs")({
  head: () => ({
    meta: [
      { title: "بانِ العروض والترويج — كَحيل" },
      { name: "description", content: "بناء بطاقات العروض وبانرات الترويج من قوالب جاهزة وحفظها في مكتبة تصاميمي." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "بانِ العروض والترويج — كَحيل" },
      { property: "og:description", content: "قوالب عروض وترويج تُبنى من اللوحة بلا كود وتُربط بأي فتحة إعلانية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DesignsPage,
});

const SELECT =
  "mt-1 w-full rounded-xl border border-border bg-card px-3 text-body font-bold text-foreground";

const EMPTY = {
  kind: "offer" as "offer" | "promo",
  name_ar: "",
  title_ar: "",
  body_ar: "",
  discount_pct: "",
  bg_color: "#8a4fff",
  grad_from: "",
  grad_to: "",
  grad_angle: 90,
  shape_key: "",
  shape_color: "#ffffff",
  shape_opacity: 18,
  shape_size: "md",
  shape_pos: "corner-tr",
  motion_key: "",
  animated: false,
  motion_speed: "slow",
  link_path: "",
  campaign_id: "",
  starts_at: "",
  ends_at: "",
  brand_stamp: true,
  layout_key: "classic",

};

type Draft = typeof EMPTY;

function toTemplate(draft: Draft, id: string): DesignTemplate {
  return {
    id,
    kind: draft.kind,
    name_ar: draft.name_ar,
    title_ar: draft.title_ar || null,
    body_ar: draft.body_ar || null,
    discount_pct: draft.discount_pct === "" ? null : Number(draft.discount_pct),
    bg_color: draft.bg_color || null,
    grad_from: draft.grad_from || null,
    grad_to: draft.grad_to || null,
    grad_angle: draft.grad_angle,
    image_path: null,
    shape_key: draft.shape_key || null,
    shape_color: draft.shape_color,
    shape_opacity: draft.shape_opacity,
    shape_size: draft.shape_size as DesignTemplate["shape_size"],
    shape_pos: draft.shape_pos,
    motion_key: draft.animated ? draft.motion_key || null : null,
    motion_state: draft.animated && draft.motion_key ? "animated" : "static",
    motion_speed: draft.motion_speed as DesignTemplate["motion_speed"],
    link_path: draft.link_path || null,
    campaign_id: draft.campaign_id || null,
    starts_at: draft.starts_at || null,
    ends_at: draft.ends_at || null,
    is_active: true,
    updated_at: new Date().toISOString(),
  };
}

function fromTemplate(row: DesignTemplate): Draft {
  return {
    kind: row.kind,
    name_ar: row.name_ar,
    title_ar: row.title_ar ?? "",
    body_ar: row.body_ar ?? "",
    discount_pct: row.discount_pct == null ? "" : String(row.discount_pct),
    bg_color: row.bg_color ?? "#8a4fff",
    grad_from: row.grad_from ?? "",
    grad_to: row.grad_to ?? "",
    grad_angle: row.grad_angle ?? 90,
    shape_key: row.shape_key ?? "",
    shape_color: row.shape_color ?? "#ffffff",
    shape_opacity: row.shape_opacity,
    shape_size: row.shape_size,
    shape_pos: row.shape_pos,
    motion_key: row.motion_key ?? "",
    animated: row.motion_state === "animated",
    motion_speed: row.motion_speed,
    link_path: row.link_path ?? "",
    campaign_id: row.campaign_id ?? "",
    starts_at: (row.starts_at ?? "").slice(0, 16),
    ends_at: (row.ends_at ?? "").slice(0, 16),
  };
}

function DesignsPage() {
  const lib = useDesignLibrary();
  const templates = useDesignTemplates();
  const refresh = useRefreshDesignTemplates();
  const campaigns = useAdminCampaigns(true);

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [variations, setVariations] = useState<DesignTemplate[]>([]);
  const [variationSource, setVariationSource] = useState("");
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));


  const save = async () => {
    if (!draft.name_ar.trim()) {
      toast.error("اسم التصميم في المكتبة إلزامي.");
      return;
    }
    setBusy(true);
    try {
      await saveDesignTemplate(editing, {
        kind: draft.kind,
        name_ar: draft.name_ar.trim(),
        title_ar: draft.title_ar.trim() || null,
        body_ar: draft.body_ar.trim() || null,
        discount_pct: draft.discount_pct === "" ? null : Number(draft.discount_pct),
        bg_color: draft.bg_color || null,
        grad_from: draft.grad_from || null,
        grad_to: draft.grad_to || null,
        grad_angle: draft.grad_from && draft.grad_to ? Number(draft.grad_angle) : null,
        shape_key: draft.shape_key || null,
        shape_color: draft.shape_key ? draft.shape_color : null,
        shape_opacity: draft.shape_opacity,
        shape_size: draft.shape_size,
        shape_pos: draft.shape_pos,
        motion_key: draft.animated ? draft.motion_key || null : null,
        motion_state: draft.animated && draft.motion_key ? "animated" : "static",
        motion_speed: draft.motion_speed,
        link_path: draft.link_path || null,
        campaign_id: draft.kind === "promo" ? draft.campaign_id || null : null,
        starts_at: draft.kind === "promo" && draft.starts_at ? new Date(draft.starts_at).toISOString() : null,
        ends_at: draft.kind === "promo" && draft.ends_at ? new Date(draft.ends_at).toISOString() : null,
      });
      refresh();
      toast.success("حُفظ في «تصاميمي» — يمكنك ربطه بأي فتحة إعلانية من وضع التحرير.");
      setEditing(null);
      setDraft({ ...EMPTY, kind: draft.kind });
    } catch (error) {
      toast.error(
        String((error as { message?: string })?.message ?? "").includes("NOT_ADMIN")
          ? "هذه العملية لمدير المنصة فقط."
          : "تعذّر الحفظ — راجع القيم وأعد المحاولة.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell title="بانِ العروض والترويج">
      <p className="mb-4 rounded-2xl border border-primary/25 bg-primary/8 p-3 text-desc text-foreground">
        املأ القالب فتظهر البطاقة في المعاينة فورًا، ثم احفظها في «تصاميمي» لإعادة استخدامها. كل
        الخيارات من مكتبات مسجّلة — لا كود ولا أنماط حرة، والحركات CSS خفيفة تتوقف تلقائيًا لمن فعّل
        «تقليل الحركة» في جهازه.
      </p>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section aria-labelledby="builder" className="rounded-2xl border border-border bg-card p-3">
          <h2 id="builder" className="mb-3 text-section font-extrabold text-foreground">
            القالب
          </h2>

          <div className="mb-3 flex gap-2">
            {(["offer", "promo"] as const).map((kind) => (
              <Button
                key={kind}
                size="sm"
                variant={draft.kind === kind ? "default" : "outline"}
                className="gap-1.5"
                onClick={() => set("kind", kind)}
              >
                {kind === "offer" ? <Tag className="size-4" aria-hidden /> : <Megaphone className="size-4" aria-hidden />}
                {kind === "offer" ? "بانِ عرض" : "بانِ ترويج"}
              </Button>
            ))}
          </div>

          <div className="space-y-3">
            <label className="block text-desc font-bold text-foreground">
              اسم التصميم في المكتبة
              <Input className="mt-1" value={draft.name_ar} onChange={(e) => set("name_ar", e.target.value)} />
            </label>
            <label className="block text-desc font-bold text-foreground">
              العنوان
              <Input className="mt-1" value={draft.title_ar} onChange={(e) => set("title_ar", e.target.value)} />
            </label>
            <label className="block text-desc font-bold text-foreground">
              النص
              <Input className="mt-1" value={draft.body_ar} onChange={(e) => set("body_ar", e.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-desc font-bold text-foreground">
                نسبة الخصم %
                <Input
                  className="num mt-1"
                  type="number"
                  min={0}
                  max={95}
                  value={draft.discount_pct}
                  onChange={(e) => set("discount_pct", e.target.value)}
                />
              </label>
              <label className="text-desc font-bold text-foreground">
                وجهة الضغط
                <select className={SELECT} style={{ minHeight: 44 }} value={draft.link_path} onChange={(e) => set("link_path", e.target.value)}>
                  <option value="">بلا وجهة</option>
                  {(lib.data?.routes ?? []).map((item) => (
                    <option key={item.path} value={item.path}>
                      {item.label_ar}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset className="rounded-2xl border border-border p-2.5">
              <legend className="px-1 text-desc font-bold text-foreground">الخلفية</legend>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  value={draft.bg_color}
                  onChange={(e) => set("bg_color", e.target.value)}
                  className="size-11 rounded-xl border border-border"
                  aria-label="لون الخلفية"
                />
                <input
                  type="color"
                  value={draft.grad_from || "#8a4fff"}
                  onChange={(e) => set("grad_from", e.target.value)}
                  className="size-11 rounded-xl border border-border"
                  aria-label="بداية التدرّج"
                />
                <input
                  type="color"
                  value={draft.grad_to || "#c3abff"}
                  onChange={(e) => set("grad_to", e.target.value)}
                  className="size-11 rounded-xl border border-border"
                  aria-label="نهاية التدرّج"
                />
                <label className="min-w-24 flex-1 text-desc font-bold text-foreground">
                  زاوية التدرّج
                  <Input
                    className="num mt-1"
                    type="number"
                    min={0}
                    max={360}
                    value={draft.grad_angle}
                    onChange={(e) => set("grad_angle", Number(e.target.value))}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="rounded-2xl border border-border p-2.5">
              <legend className="px-1 text-desc font-bold text-foreground">الشكل والحركة</legend>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-desc font-bold text-foreground">
                  الشكل
                  <select className={SELECT} style={{ minHeight: 44 }} value={draft.shape_key} onChange={(e) => set("shape_key", e.target.value)}>
                    <option value="">بلا شكل</option>
                    {(lib.data?.shapes ?? []).map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label_ar}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-desc font-bold text-foreground">
                  موضع الشكل
                  <select className={SELECT} style={{ minHeight: 44 }} value={draft.shape_pos} onChange={(e) => set("shape_pos", e.target.value)}>
                    {SHAPE_POSITIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-desc font-bold text-foreground">
                  حجم الشكل
                  <select className={SELECT} style={{ minHeight: 44 }} value={draft.shape_size} onChange={(e) => set("shape_size", e.target.value)}>
                    {SIZE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-desc font-bold text-foreground">
                  لون الشكل وشفافيته <span className="num">{draft.shape_opacity}%</span>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={draft.shape_color}
                      onChange={(e) => set("shape_color", e.target.value)}
                      className="size-11 shrink-0 rounded-xl border border-border"
                      aria-label="لون الشكل"
                    />
                    <input
                      type="range"
                      min={5}
                      max={60}
                      value={draft.shape_opacity}
                      onChange={(e) => set("shape_opacity", Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                </label>
              </div>
              <label className="mt-2 flex items-center gap-2 text-desc font-bold text-foreground">
                <input
                  type="checkbox"
                  checked={draft.animated}
                  onChange={(e) => set("animated", e.target.checked)}
                  className="size-5 accent-primary"
                />
                متحرك
              </label>
              {draft.animated ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-desc font-bold text-foreground">
                    الحركة
                    <select className={SELECT} style={{ minHeight: 44 }} value={draft.motion_key} onChange={(e) => set("motion_key", e.target.value)}>
                      <option value="">اختر…</option>
                      {(lib.data?.motions ?? []).map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.label_ar}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-desc font-bold text-foreground">
                    السرعة
                    <select className={SELECT} style={{ minHeight: 44 }} value={draft.motion_speed} onChange={(e) => set("motion_speed", e.target.value)}>
                      {SPEED_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
            </fieldset>

            {draft.kind === "promo" ? (
              <fieldset className="rounded-2xl border border-border p-2.5">
                <legend className="px-1 text-desc font-bold text-foreground">الجدولة والحملة</legend>
                <label className="block text-desc font-bold text-foreground">
                  حملة قائمة
                  <select className={SELECT} style={{ minHeight: 44 }} value={draft.campaign_id} onChange={(e) => set("campaign_id", e.target.value)}>
                    <option value="">بلا ربط</option>
                    {(campaigns.data ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title_ar || item.slug} — {item.placement}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-desc font-bold text-foreground">
                    من
                    <Input className="num mt-1" type="datetime-local" value={draft.starts_at} onChange={(e) => set("starts_at", e.target.value)} />
                  </label>
                  <label className="text-desc font-bold text-foreground">
                    إلى
                    <Input className="num mt-1" type="datetime-local" value={draft.ends_at} onChange={(e) => set("ends_at", e.target.value)} />
                  </label>
                </div>
              </fieldset>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="gap-1.5" disabled={busy} onClick={() => void save()}>
                <Save className="size-4" aria-hidden />
                {editing ? "حفظ التعديل" : "حفظ في تصاميمي"}
              </Button>
              {editing ? (
                <Button size="sm" variant="outline" onClick={() => { setEditing(null); setDraft(EMPTY); }}>
                  إلغاء التعديل
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <aside aria-labelledby="preview" className="space-y-3">
          <h2 id="preview" className="text-section font-extrabold text-foreground">
            المعاينة
          </h2>
          <DesignCard template={toTemplate(draft, "preview")} library={lib.data} />
          <p className="text-desc text-muted-foreground">
            هذه بطاقة حقيقية بنفس مكوّن العرض في الواجهة — ما تراه هنا هو ما سيراه الزائر.
          </p>
        </aside>
      </div>

      <section aria-labelledby="library" className="mt-6">
        <h2 id="library" className="mb-2 text-section font-extrabold text-foreground">
          تصاميمي
          <span className="ms-2 text-nav font-bold text-muted-foreground">
            {(templates.data ?? []).length.toLocaleString("en-US")}
          </span>
        </h2>
        {templates.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-40 w-full rounded-2xl" />
            ))}
          </div>
        ) : (templates.data ?? []).length === 0 ? (
          <p className="text-body text-muted-foreground">لا تصاميم محفوظة بعد.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(templates.data ?? []).map((row) => (
              <li key={row.id} className="space-y-2 rounded-2xl border border-border bg-card p-2.5">
                <DesignCard template={row} library={lib.data} />
                <p className="text-desc font-bold text-foreground">{row.name_ar}</p>
                <p className="text-desc text-muted-foreground">
                  {row.kind === "offer" ? "عرض" : "ترويج"} · آخر تحديث {formatDateTime(row.updated_at)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(row.id);
                      setDraft(fromTemplate(row));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    تعديل
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void (async () => {
                        try {
                          await setDesignTemplateActive(row.id, !row.is_active);
                          refresh();
                          toast.success(row.is_active ? "أُخفي التصميم." : "أُعيد تشغيل التصميم.");
                        } catch {
                          toast.error("تعذّر التنفيذ.");
                        }
                      })()
                    }
                  >
                    {row.is_active ? "إخفاء" : "تشغيل"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      setVariations(generateVariations(row, lib.data));
                      setVariationSource(row.name_ar);
                      toast.success(`وُلّدت ${VARIATION_COUNT.toLocaleString("en-US")} تنويعة — احفظ ما يعجبك.`);
                    }}
                  >
                    <Sparkles className="size-4" aria-hidden />
                    ولّد تنويعات
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {variations.length > 0 ? (
        <section aria-labelledby="variations" className="mt-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 id="variations" className="text-section font-extrabold text-foreground">
              تنويعات «{variationSource}»
              <span className="ms-2 num text-nav font-bold text-muted-foreground">
                {variations.length.toLocaleString("en-US")}
              </span>
            </h2>
            <Button size="sm" variant="outline" onClick={() => setVariations([])}>
              إهمال الباقي
            </Button>
          </div>
          <p className="mb-3 text-desc text-muted-foreground">
            كل تنويعة تحمل ختم اسم كَحيل تلقائيًا. احفظ ما يعجبك في «تصاميمي» ثم اربطه بأي فتحة من
            وضع التحرير — والباقي يُهمل بلا أثر.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {variations.map((row) => (
              <li key={row.id} className="space-y-2 rounded-2xl border border-border bg-card p-2.5">
                <DesignCard template={row} library={lib.data} />
                <p className="text-desc font-bold text-foreground">{row.name_ar}</p>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void (async () => {
                      setBusy(true);
                      try {
                        await saveDesignTemplate(null, variationPatch(row));
                        refresh();
                        setVariations((prev) => prev.filter((item) => item.id !== row.id));
                        toast.success("حُفظت التنويعة في «تصاميمي».");
                      } catch {
                        toast.error("تعذّر حفظ التنويعة.");
                      } finally {
                        setBusy(false);
                      }
                    })()
                  }
                >
                  حفظ في تصاميمي
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        aria-labelledby="ai-notice"
        className="mt-6 rounded-2xl border border-border bg-muted/40 p-3"
      >
        <h2 id="ai-notice" className="text-desc font-extrabold text-foreground">
          توليد صور جديدة كليًا بالذكاء الاصطناعي غير مفعّل — يتطلب اشتراك خدمة خارجية
        </h2>
        <p className="mt-1 text-desc text-muted-foreground">
          المولّد الحالي يعمل على مكتبات المشروع نفسها (ألوان الهوية، الأشكال، التخطيطات) بلا أي
          خدمة خارجية. مكان التفعيل جاهز أدناه ويُفتح بقرار المالك فقط.
        </p>
        <Button size="sm" variant="outline" className="mt-2 gap-1.5" disabled>
          <Sparkles className="size-4" aria-hidden />
          توليد بالذكاء الاصطناعي (معطّل)
        </Button>
      </section>

    </AdminShell>
  );
}

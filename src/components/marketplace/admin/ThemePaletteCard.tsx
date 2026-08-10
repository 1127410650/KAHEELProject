/**
 * بطاقة «ألوان المنصة» في `/admin/appearance`: منتقيات ألوان مجمّعة + معاينة
 * حية + حارس تباين + إدارة اللوحات المحفوظة.
 *
 * الحفظ والتفعيل يمران بدوال SECURITY DEFINER تعيد فحص صفة مدير المنصة في
 * القاعدة وتسجّل كل تغيير (من/متى/قديم/جديد). حارس التباين يمنع الحفظ إن سقط
 * أي زوج «نص فوق خلفية» تحت 4.5:1 ويسمّي الزوج بالعربية.
 */
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Palette, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  activateThemePalette,
  resetThemeToDefault,
  saveThemePalette,
  useRefreshTheme,
  useThemePalettes,
} from "@/lib/mkt-theme";
import {
  ALPHA_TOKENS,
  DEFAULT_TOKENS,
  isValidTokenValue,
  THEME_GROUPS,
  THEME_TOKENS,
  TOKEN_LABELS,
  contrastIssues,
  tokensCss,
  type ThemeToken,
  type ThemeTokenMap,
} from "@/lib/theme-tokens";

/** يحوّل rgba() إلى سداسي تقريبي كي يقبله `<input type="color">`. */
function toColorInput(value: string): string {
  if (value.startsWith("#")) return value.slice(0, 7);
  const match = value.match(/(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
  if (!match) return "#000000";
  return `#${[match[1], match[2], match[3]]
    .map((channel) => Number(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function ThemePaletteCard() {
  const palettes = useThemePalettes(true);
  const refresh = useRefreshTheme();
  const [draft, setDraft] = useState<ThemeTokenMap>(DEFAULT_TOKENS);
  const [name, setName] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const active = (palettes.data ?? []).find((row) => row.is_active) ?? null;

  useEffect(() => {
    if (loadedId || !active) return;
    setDraft(active.tokens);
    setName(active.name_ar);
    setLoadedId(active.id);
  }, [active, loadedId]);

  const issues = useMemo(() => contrastIssues(draft), [draft]);
  const previewCss = useMemo(() => tokensCss(draft, ".k-theme-preview"), [draft]);
  const blocked = issues.length > 0;

  function setToken(token: ThemeToken, value: string) {
    setDraft((prev) => ({ ...prev, [token]: value }));
  }

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      refresh();
      toast.success(label);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر تنفيذ العملية");
    } finally {
      setBusy(false);
    }
  }

  function guard(): boolean {
    if (blocked) {
      toast.error(`تباين غير كافٍ: ${issues[0]!.pair} (${issues[0]!.ratio}:1)`);
      return false;
    }
    for (const token of THEME_TOKENS) {
      if (!isValidTokenValue(token, draft[token])) {
        toast.error(`قيمة غير صالحة في «${TOKEN_LABELS[token]}»`);
        return false;
      }
    }
    return true;
  }

  return (
    <section
      aria-labelledby="theme-palette-title"
      className="rounded-[var(--r-card)] border border-border bg-card p-[var(--sp-4)]"
    >
      <style>{previewCss}</style>
      <h2
        id="theme-palette-title"
        className="flex items-center gap-[var(--sp-2)] text-section font-extrabold text-foreground"
      >
        <Palette className="size-4 text-primary" aria-hidden />
        ألوان المنصة
      </h2>
      <p className="mt-1 text-desc text-muted-foreground">
        كل لون في الواجهة مشتق من هذه الرموز. تغيير الرمز يسري على المنصة كاملة فورًا بعد الحفظ
        والتفعيل، وكل تعديل مسجَّل باسم من نفّذه.
      </p>

      {palettes.isPending ? (
        <Skeleton className="mt-3 h-40 w-full rounded-[var(--r-card)]" />
      ) : palettes.isError ? (
        <p className="mt-3 text-body text-destructive">تعذّر تحميل اللوحات — حدّث الصفحة.</p>
      ) : (
        <div className="mt-[var(--sp-4)] grid gap-[var(--sp-4)] lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* ── المنتقيات المجمّعة ─────────────────────────────── */}
          <div className="space-y-[var(--sp-4)]">
            {THEME_GROUPS.map((group) => (
              <fieldset key={group.key} className="rounded-[var(--r-card)] border border-border p-3">
                <legend className="px-1 text-desc font-extrabold text-foreground">
                  {group.label}
                </legend>
                <ul className="grid gap-[var(--sp-2)] sm:grid-cols-2">
                  {group.tokens.map((token) => (
                    <li key={token} className="flex items-center gap-[var(--sp-2)]">
                      <input
                        type="color"
                        aria-label={TOKEN_LABELS[token]}
                        value={toColorInput(draft[token])}
                        onChange={(event) => setToken(token, event.target.value.toUpperCase())}
                        className="size-9 shrink-0 cursor-pointer rounded-[var(--r-control)] border border-border bg-card p-0.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-nav font-bold text-foreground">
                          {TOKEN_LABELS[token]}
                        </span>
                        <Input
                          dir="ltr"
                          value={draft[token]}
                          onChange={(event) => setToken(token, event.target.value)}
                          className="mt-0.5 h-8 text-nav"
                          placeholder={ALPHA_TOKENS.includes(token) ? "rgba(0,0,0,0.5)" : "#000000"}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              </fieldset>
            ))}

            {/* ── حارس التباين ──────────────────────────────────── */}
            {blocked ? (
              <div
                role="alert"
                className="rounded-[var(--r-card)] border border-destructive/40 bg-destructive/8 p-3"
              >
                <p className="flex items-center gap-[var(--sp-2)] text-desc font-extrabold text-destructive">
                  <AlertTriangle className="size-4" aria-hidden />
                  الحفظ ممنوع — تباين غير كافٍ
                </p>
                <ul className="mt-1 space-y-0.5 text-desc text-foreground">
                  {issues.map((issue) => (
                    <li key={issue.pair}>
                      {issue.pair}: {issue.ratio.toLocaleString("en-US")}:1 — المطلوب{" "}
                      {issue.min.toLocaleString("en-US")}:1 على الأقل.
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="flex items-center gap-[var(--sp-2)] text-desc font-bold text-success">
                <Check className="size-4" aria-hidden />
                كل أزواج النص والخلفية تجتاز الحد المطلوب.
              </p>
            )}

            {/* ── الحفظ والتفعيل ────────────────────────────────── */}
            <div className="flex flex-wrap items-end gap-[var(--sp-2)]">
              <label className="min-w-[180px] flex-1">
                <span className="block text-nav font-bold text-foreground">اسم اللوحة</span>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={60}
                  className="mt-1 h-10"
                  placeholder="مثال: أخضر × كحلي"
                />
              </label>
              <Button
                size="sm"
                disabled={busy || blocked}
                className="gap-[var(--sp-2)]"
                onClick={() => {
                  if (!guard()) return;
                  void run("حُفظت اللوحة وفُعّلت", () =>
                    saveThemePalette({
                      paletteId: loadedId,
                      nameAr: name,
                      tokens: draft,
                      activate: true,
                    }),
                  );
                }}
              >
                <Save className="size-4" aria-hidden />
                حفظ وتفعيل
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || blocked}
                onClick={() => {
                  if (!guard()) return;
                  void run("أُنشئت لوحة جديدة", async () => {
                    const id = await saveThemePalette({
                      paletteId: null,
                      nameAr: name.trim().length > 0 ? `${name} — نسخة` : "لوحة جديدة",
                      tokens: draft,
                      activate: false,
                    });
                    setLoadedId(id);
                  });
                }}
              >
                حفظ كلوحة جديدة
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                className="gap-[var(--sp-2)]"
                onClick={() =>
                  void run("رجعت اللوحة الافتراضية", async () => {
                    await resetThemeToDefault();
                    setLoadedId(null);
                  })
                }
              >
                <RotateCcw className="size-4" aria-hidden />
                رجوع للافتراضي
              </Button>
            </div>

            {/* ── اللوحات المحفوظة ──────────────────────────────── */}
            <ul className="space-y-[var(--sp-2)]">
              {(palettes.data ?? []).map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-[var(--sp-2)] rounded-[var(--r-card)] border border-border p-2"
                >
                  <span className="flex shrink-0 gap-1" aria-hidden>
                    {(["primary", "header-from", "page-bg", "text-primary"] as ThemeToken[]).map(
                      (token) => (
                        <span
                          key={token}
                          className="size-5 rounded-full border border-border"
                          style={{ background: row.tokens[token] }}
                        />
                      ),
                    )}
                  </span>
                  <strong className="min-w-0 flex-1 truncate text-desc font-extrabold text-foreground">
                    {row.name_ar}
                    {row.is_builtin ? (
                      <span className="ms-1 text-nav font-bold text-muted-foreground">مدمجة</span>
                    ) : null}
                  </strong>
                  {row.is_active ? (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-nav font-extrabold text-accent-foreground">
                      مفعّلة
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      className="h-8"
                      onClick={() => void run(`فُعّلت «${row.name_ar}»`, () => activateThemePalette(row.id))}
                    >
                      تفعيل
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    onClick={() => {
                      setDraft(row.tokens);
                      setName(row.name_ar);
                      setLoadedId(row.id);
                    }}
                  >
                    تحرير
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          {/* ── المعاينة الحية ─────────────────────────────────── */}
          <div className="lg:sticky lg:top-4">
            <p className="mb-2 text-desc font-extrabold text-foreground">معاينة حية</p>
            <MiniHomePreview tokens={draft} />
          </div>
        </div>
      )}
    </section>
  );
}

/** نموذج مصغّر للرئيسية يعيد رسم نفسه مع كل اختيار لون. */
function MiniHomePreview({ tokens }: { tokens: ThemeTokenMap }) {
  return (
    <div
      dir="rtl"
      className="k-theme-preview overflow-hidden rounded-[var(--r-card)] border"
      style={{ background: tokens["page-bg"], borderColor: tokens.divider }}
    >
      <div
        className="px-3 pb-3 pt-3"
        style={{
          backgroundImage: `linear-gradient(90deg, ${tokens["header-from"]} 0%, ${tokens["header-to"]} 100%)`,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <strong className="text-desc font-extrabold" style={{ color: "#FFFFFF" }}>
            كَحيل
          </strong>
          <span
            className="grid size-9 place-items-center rounded-full text-lg font-black"
            style={{ background: tokens["cta-bg"], color: tokens["cta-fg"] }}
          >
            +
          </span>
        </div>
        <div
          className="mt-2 flex h-9 items-center rounded-[var(--r-control)] px-2 text-nav"
          style={{ background: tokens.card, color: tokens["text-secondary"] }}
        >
          ابحث في كَحيل…
        </div>
      </div>

      <div className="space-y-2 p-3">
        <div className="flex gap-2">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="size-10 rounded-full"
              style={{ border: `2px solid ${tokens["story-ring"]}`, background: tokens["primary-soft"] }}
            />
          ))}
        </div>
        <div
          className="rounded-[var(--r-card)] border p-2"
          style={{ background: tokens.card, borderColor: tokens.divider }}
        >
          <p className="text-desc font-extrabold" style={{ color: tokens["text-primary"] }}>
            شقة مفروشة — دمشق
          </p>
          <p className="text-nav" style={{ color: tokens["text-secondary"] }}>
            ٣ غرف · قرب الجامعة
          </p>
          <p className="mt-1 text-body font-black" style={{ color: tokens["price-color"] }}>
            1,200 SAR
          </p>
          <span
            className="mt-2 inline-flex min-h-8 items-center rounded-full px-3 text-nav font-extrabold"
            style={{ background: tokens["primary-deep"], color: "#FFFFFF" }}
          >
            تواصل
          </span>
        </div>
        <div
          className="flex items-center justify-between rounded-[var(--r-card)] border p-2 text-nav font-bold"
          style={{ background: tokens.card, borderColor: tokens.divider }}
        >
          <span style={{ color: tokens["bottomnav-active"] }}>الرئيسية</span>
          <span style={{ color: tokens["text-secondary"] }}>الأقسام</span>
          <span style={{ color: tokens.disabled }}>حسابي</span>
        </div>
      </div>
    </div>
  );
}

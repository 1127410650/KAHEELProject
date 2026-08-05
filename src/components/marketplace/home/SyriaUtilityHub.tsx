import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Bot,
  Building2,
  Clock3,
  ExternalLink,
  FileText,
  GraduationCap,
  Heart,
  Hospital,
  ListChecks,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import {
  SYRIA_DIRECTORY,
  createStudyQuestions,
  searchSyriaDirectory,
  summarizeLocally,
  type SyriaDirectoryCategory,
  type SyriaDirectoryEntry,
} from "@/lib/syria-directory";

type HubTab = "directory" | "assistant" | "students";
type CategoryFilter = "all" | SyriaDirectoryCategory;

const CATEGORY_OPTIONS: Array<{
  id: CategoryFilter;
  label: string;
  icon: typeof Building2;
}> = [
  { id: "all", label: "الكل", icon: Search },
  { id: "government", label: "دوائر حكومية", icon: Building2 },
  { id: "hospital-public", label: "مشافي عامة", icon: Hospital },
  { id: "hospital-private", label: "مشافي خاصة", icon: Hospital },
  { id: "university-public", label: "جامعات حكومية", icon: GraduationCap },
  { id: "university-private", label: "جامعات خاصة", icon: GraduationCap },
];

const QUICK_SEARCHES = [
  "مشفى عام في دمشق",
  "جامعة للتسجيل",
  "جهة لدعم المشاريع",
  "دائرة حكومية للتصدير",
];

const FAVORITES_KEY = "k7ly.syria-directory.favorites";

export function SyriaUtilityHub() {
  const [tab, setTab] = useState<HubTab>("directory");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [assistantQuery, setAssistantQuery] = useState("");
  const [studyText, setStudyText] = useState("");
  const [studyMode, setStudyMode] = useState<"summary" | "questions">("summary");
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FAVORITES_KEY);
      if (raw) setFavorites(JSON.parse(raw) as string[]);
    } catch {
      setFavorites([]);
    }
  }, []);

  const directoryResults = useMemo(() => {
    const searched = query.trim()
      ? searchSyriaDirectory(query, SYRIA_DIRECTORY.length)
      : SYRIA_DIRECTORY;
    return category === "all"
      ? searched
      : searched.filter((entry) => entry.category === category);
  }, [query, category]);

  const assistantResults = useMemo(
    () => (assistantQuery.trim() ? searchSyriaDirectory(assistantQuery, 5) : []),
    [assistantQuery],
  );

  const studyResult = useMemo(() => {
    if (studyText.trim().length < 40) return [];
    return studyMode === "summary"
      ? summarizeLocally(studyText, 4)
      : createStudyQuestions(studyText, 6);
  }, [studyText, studyMode]);

  const toggleFavorite = (id: string) => {
    setFavorites((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      try {
        window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch {
        // Local saving must never block directory use.
      }
      return next;
    });
  };

  return (
    <section
      id="syria-directory"
      className="mx-auto w-full max-w-[1240px] scroll-mt-32 px-4 pb-2 pt-4 sm:px-5 sm:pt-5 lg:px-8"
    >
      <div className="overflow-hidden rounded-[1.4rem] border border-border bg-card shadow-[0_12px_34px_rgb(15_23_42/0.08)]">
        <div className="bg-gradient-to-l from-market-navy via-market-navy to-market-navy-soft px-4 py-4 text-white sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-market-silver sm:text-xs">
                <ShieldCheck className="size-3.5" aria-hidden />
                نسخة سوريا فقط — المعلومات الموثقة أولًا
              </div>
              <h2 className="text-xl font-black tracking-tight sm:text-2xl">دليل سوريا 🫆</h2>
              <p className="mt-1.5 text-xs leading-6 text-white/78 sm:text-sm">
                ابحث عن جهة حكومية أو مشفى أو جامعة، ثم اتصل أو افتح موقعها أو اذهب إليها عبر الخريطة.
              </p>
            </div>
            <span className="rounded-2xl border border-white/15 bg-white/8 px-3 py-2 text-[10px] leading-5 text-white/75 sm:text-xs">
              لا نعرض دوامًا غير منشور، واتصل قبل الذهاب.
            </span>
          </div>
        </div>

        <div className="border-b border-border bg-muted/35 p-2 sm:p-3">
          <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-background p-1">
            <TabButton
              active={tab === "directory"}
              onClick={() => setTab("directory")}
              icon={MapPin}
              label="الدليل"
            />
            <TabButton
              active={tab === "assistant"}
              onClick={() => setTab("assistant")}
              icon={Bot}
              label="مساعد مجاني"
            />
            <TabButton
              active={tab === "students"}
              onClick={() => setTab("students")}
              icon={BookOpen}
              label="أدوات الطالب"
            />
          </div>
        </div>

        {tab === "directory" ? (
          <div className="p-3 sm:p-5">
            <label className="relative block" htmlFor="syria-directory-search">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                id="syria-directory-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث: مشفى، جامعة، وزارة، تمويل مشاريع…"
                className="h-12 w-full rounded-2xl border border-input bg-background pe-4 ps-10 text-sm outline-none transition focus:border-market-navy focus:ring-2 focus:ring-market-navy/15"
              />
            </label>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {CATEGORY_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = category === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setCategory(option.id)}
                    className={
                      active
                        ? "inline-flex h-9 min-w-max items-center gap-1.5 rounded-full bg-market-navy px-3.5 text-[11px] font-bold text-white"
                        : "inline-flex h-9 min-w-max items-center gap-1.5 rounded-full border border-border bg-background px-3.5 text-[11px] font-bold text-muted-foreground hover:border-market-navy/40 hover:text-foreground"
                    }
                  >
                    <Icon className="size-3.5" aria-hidden />
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {directoryResults.map((entry) => (
                <DirectoryCard
                  key={entry.id}
                  entry={entry}
                  favorite={favorites.includes(entry.id)}
                  onToggleFavorite={() => toggleFavorite(entry.id)}
                />
              ))}
            </div>

            {directoryResults.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
                <p className="text-sm font-bold text-foreground">لا توجد نتيجة موثقة بعد.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  جرّب كلمة أقصر، أو أرسل اقتراح الجهة حتى نضيفها بعد التحقق.
                </p>
                <a href="/contact?subject=syria-directory" className="mt-3 inline-flex text-xs font-bold text-market-navy underline-offset-4 hover:underline">
                  اقترح جهة أو صحّح معلومة
                </a>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "assistant" ? (
          <div id="free-assistant" className="scroll-mt-32 p-3 sm:p-5">
            <div className="rounded-2xl border border-market-navy/12 bg-market-navy/[0.035] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-market-navy text-white">
                  <Sparkles className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-base font-black text-foreground">اسأل دليل سوريا مجانًا</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    بحث ذكي داخل المعلومات الموثقة. يعمل محليًا في المتصفح ولا يرسل سؤالك إلى خدمة ذكاء اصطناعي مدفوعة.
                  </p>
                </div>
              </div>

              <label className="mt-4 block" htmlFor="syria-assistant-query">
                <span className="sr-only">اكتب سؤالك</span>
                <textarea
                  id="syria-assistant-query"
                  value={assistantQuery}
                  onChange={(event) => setAssistantQuery(event.target.value)}
                  placeholder="مثال: أريد جهة تساعدني في تمويل مشروع صغير بدمشق"
                  className="min-h-24 w-full resize-y rounded-2xl border border-input bg-background p-3 text-sm leading-6 outline-none transition focus:border-market-navy focus:ring-2 focus:ring-market-navy/15"
                />
              </label>

              <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {QUICK_SEARCHES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setAssistantQuery(item)}
                    className="min-w-max rounded-full border border-border bg-background px-3 py-2 text-[10px] font-bold text-muted-foreground hover:border-market-navy/40 hover:text-foreground"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {assistantQuery.trim() ? (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-black text-foreground">أقرب النتائج لسؤالك</h4>
                  <span className="text-[10px] text-muted-foreground">{assistantResults.length} نتائج</span>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {assistantResults.map((entry) => (
                    <DirectoryCard
                      key={entry.id}
                      entry={entry}
                      favorite={favorites.includes(entry.id)}
                      onToggleFavorite={() => toggleFavorite(entry.id)}
                    />
                  ))}
                </div>
                {assistantResults.length === 0 ? (
                  <p className="rounded-2xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
                    لم أجد جهة مطابقة داخل البيانات الموثقة الحالية. لن أخمّن معلومة غير موجودة.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "students" ? (
          <div className="p-3 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
              <div className="rounded-2xl border border-border bg-muted/25 p-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="size-5 text-market-navy" aria-hidden />
                  <h3 className="text-base font-black text-foreground">أدوات دراسة مجانية</h3>
                </div>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  الصق درسًا أو مقالًا. الأداة ترتب أهم الجمل أو تنشئ أسئلة مراجعة داخل جهازك، دون حساب ودون رسوم API.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStudyMode("summary")}
                    className={studyMode === "summary" ? "rounded-xl bg-market-navy px-3 py-2.5 text-xs font-bold text-white" : "rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-bold text-muted-foreground"}
                  >
                    <FileText className="mx-auto mb-1 size-4" aria-hidden />
                    تلخيص محلي
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudyMode("questions")}
                    className={studyMode === "questions" ? "rounded-xl bg-market-navy px-3 py-2.5 text-xs font-bold text-white" : "rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-bold text-muted-foreground"}
                  >
                    <ListChecks className="mx-auto mb-1 size-4" aria-hidden />
                    أسئلة مراجعة
                  </button>
                </div>
                <div className="mt-3 rounded-xl border border-amber-300/50 bg-amber-50 px-3 py-2 text-[10px] leading-5 text-amber-950">
                  هذه أداة ترتيب نصوص وليست بديلًا عن المعلم أو المرجع الأكاديمي، ولا تضيف حقائق من خارج النص.
                </div>
              </div>

              <div>
                <textarea
                  value={studyText}
                  onChange={(event) => setStudyText(event.target.value)}
                  placeholder="الصق النص هنا…"
                  className="min-h-44 w-full resize-y rounded-2xl border border-input bg-background p-3 text-sm leading-7 outline-none transition focus:border-market-navy focus:ring-2 focus:ring-market-navy/15"
                />
                <div className="mt-3 rounded-2xl border border-border bg-background p-4">
                  <h4 className="text-sm font-black text-foreground">
                    {studyMode === "summary" ? "الخلاصة" : "أسئلة المراجعة"}
                  </h4>
                  {studyText.trim().length < 40 ? (
                    <p className="mt-2 text-xs text-muted-foreground">أدخل نصًا من 40 حرفًا على الأقل.</p>
                  ) : studyResult.length > 0 ? (
                    <ol className="mt-3 space-y-2 text-sm leading-7 text-foreground">
                      {studyResult.map((item, index) => (
                        <li key={`${index}-${item.slice(0, 24)}`} className="rounded-xl bg-muted/35 px-3 py-2">
                          {studyMode === "summary" ? `${index + 1}. ${item}` : item}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      لم أجد جملًا كافية للمعالجة. استخدم نصًا أطول ومقسمًا إلى جمل.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof MapPin;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-market-navy px-2 text-[10px] font-black text-white shadow-sm sm:text-xs"
          : "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-[10px] font-black text-muted-foreground hover:bg-muted sm:text-xs"
      }
    >
      <Icon className="size-3.5 sm:size-4" aria-hidden />
      {label}
    </button>
  );
}

function DirectoryCard({
  entry,
  favorite,
  onToggleFavorite,
}: {
  entry: SyriaDirectoryEntry;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  const mapHref = `https://www.openstreetmap.org/search?query=${encodeURIComponent(entry.mapQuery)}`;
  const primaryPhone = entry.phones[0];

  return (
    <article className="rounded-2xl border border-border bg-background p-4 shadow-[0_4px_16px_rgb(15_23_42/0.045)]">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-market-navy/8 text-market-navy">
          {entry.category === "government" ? (
            <Building2 className="size-5" aria-hidden />
          ) : entry.category.startsWith("hospital") ? (
            <Hospital className="size-5" aria-hidden />
          ) : (
            <GraduationCap className="size-5" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-black leading-6 text-foreground sm:text-base">{entry.name}</h3>
            <button
              type="button"
              onClick={onToggleFavorite}
              aria-label={favorite ? "إزالة من المحفوظات" : "حفظ الجهة"}
              className={favorite ? "grid size-8 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-600" : "grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground hover:text-rose-600"}
            >
              <Heart className={favorite ? "size-4 fill-current" : "size-4"} aria-hidden />
            </button>
          </div>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{entry.description}</p>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-[11px] leading-5 text-muted-foreground sm:text-xs">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-market-navy" aria-hidden />
          <span>{entry.address}</span>
        </p>
        <p className="flex items-start gap-2">
          <Clock3 className="mt-0.5 size-3.5 shrink-0 text-market-navy" aria-hidden />
          <span>{entry.hoursNote}</span>
        </p>
        {entry.phones.length > 0 ? (
          <p className="flex items-start gap-2">
            <Phone className="mt-0.5 size-3.5 shrink-0 text-market-navy" aria-hidden />
            <span dir="ltr" className="text-end">{entry.phones.join(" · ")}</span>
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {primaryPhone ? (
          <a
            href={`tel:${primaryPhone.replace(/[^+\d]/g, "")}`}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-market-navy px-2 text-[10px] font-bold text-white sm:text-[11px]"
          >
            <Phone className="size-3.5" aria-hidden />
            اتصال
          </a>
        ) : null}
        <a
          href={mapHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-market-navy/20 bg-market-navy/5 px-2 text-[10px] font-bold text-market-navy sm:text-[11px]"
        >
          <MapPin className="size-3.5" aria-hidden />
          اذهب
        </a>
        <a
          href={entry.website}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-2 text-[10px] font-bold text-foreground sm:text-[11px]"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          الموقع
        </a>
        <a
          href={entry.sourceUrl}
          target="_blank"
          rel="noreferrer"
          title={entry.sourceLabel}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-2 text-[10px] font-bold text-muted-foreground sm:text-[11px]"
        >
          <ShieldCheck className="size-3.5" aria-hidden />
          المصدر
        </a>
      </div>

      <p className="mt-3 border-t border-border pt-2 text-[9px] leading-4 text-muted-foreground">
        آخر تحقق من المصدر: {entry.verifiedAt}. قد تتغير الأرقام أو المواعيد؛ اتصل قبل الزيارة.
      </p>
    </article>
  );
}

/**
 * «مساعد الطالب» — chat surface.
 *
 * The screen is fully functional today; the model itself is not switched on, so
 * a question comes back with a clear "being set up" card instead of a fake
 * answer. Nothing about the limits is decided here — `askStudentBot` returns the
 * server's verdict and this component only renders it.
 *
 * The question photo lives in component state, is sent as base64 inside the
 * request, and both the state and its object URL are released the moment the
 * answer (or refusal) arrives. It is never uploaded to storage.
 */
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image as ImageIcon,
  Loader2,
  Lock,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { currentPath, loginHref } from "@/lib/mkt";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Mascot } from "@/components/marketplace/campaign/Mascot";
import {
  askStudentBot,
  loadStudentBotConversations,
  prepareStudentImage,
  readStudentPref,
  STUDENT_BOT_KEY,
  STUDENT_GRADES,
  STUDENT_SUBJECTS,
  studentBotRefusalCopy,
  useStudentBotState,
  writeStudentPref,
  type PreparedImage,
  type StudentBotMessage,
  type StudentGrade,
} from "@/lib/mkt-student-bot";
import { StudentBotPlans } from "@/components/marketplace/student/StudentBotPlans";

interface Bubble extends StudentBotMessage {
  id: string;
  pending?: boolean;
  hadImage?: boolean;
}

export function StudentBotChat() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { session, loading } = useSession();
  const queryClient = useQueryClient();

  const [grade, setGrade] = useState<StudentGrade>("bac_sci");
  const [subject, setSubject] = useState<string>("رياضيات");
  const [text, setText] = useState("");
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const state = useStudentBotState();
  const history = useQuery({
    queryKey: [...STUDENT_BOT_KEY, "conversations", session?.user.id ?? null],
    enabled: !!session,
    queryFn: loadStudentBotConversations,
  });

  // Grade + subject follow the student: the stored choice wins, otherwise the
  // last conversation they had.
  useEffect(() => {
    const pref = readStudentPref();
    if (pref) {
      setGrade(pref.grade);
      if (pref.subject) setSubject(pref.subject);
      return;
    }
    const last = history.data?.[0];
    if (last) {
      setGrade(last.grade);
      setSubject(last.subject);
    }
  }, [history.data]);

  useEffect(() => {
    composerRef.current?.focus();
  }, [busy]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [bubbles.length, refusal]);

  const subjects = STUDENT_SUBJECTS[grade];
  const subjectNames = useMemo(() => subjects.map((item) => (ar ? item.ar : item.en)), [subjects, ar]);

  useEffect(() => {
    if (!subjectNames.includes(subject)) setSubject(subjectNames[0] ?? "");
  }, [subjectNames, subject]);

  const dropImage = useCallback(() => {
    setImage((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  }, []);

  async function pickImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(ar ? "اختر صورة." : "Pick an image file.");
      return;
    }
    try {
      const prepared = await prepareStudentImage(file);
      dropImage();
      setImage(prepared);
    } catch {
      toast.error(ar ? "تعذّر تحضير الصورة." : "Could not process the image.");
    }
  }

  async function send() {
    const question = text.trim();
    if (!question && !image) return;
    setBusy(true);
    setRefusal(null);
    const localId = `q-${Date.now()}`;
    setBubbles((prev) => [
      ...prev,
      { id: localId, role: "user", text: question || (ar ? "صورة سؤال" : "Question photo"), hadImage: !!image },
      { id: `${localId}-a`, role: "assistant", text: "", pending: true },
    ]);
    setText("");

    try {
      const result = await askStudentBot({
        data: {
          grade,
          subject,
          question,
          conversationId,
          imageBase64: image?.base64 ?? null,
          imageMime: image?.mime ?? null,
        },
      });

      // The photo has served its purpose — release it immediately.
      dropImage();

      if (result.ok && result.answer) {
        if (result.conversationId) setConversationId(result.conversationId);
        setBubbles((prev) =>
          prev.map((bubble) =>
            bubble.id === `${localId}-a`
              ? { ...bubble, text: result.answer as string, pending: false }
              : bubble,
          ),
        );
        if (result.newConversation) {
          toast.info(
            ar
              ? "فتحنا محادثة جديدة وأخذنا ملخّص ما قبلها."
              : "A new conversation was opened with a short summary of the previous one.",
          );
        }
      } else {
        setBubbles((prev) => prev.filter((bubble) => bubble.id !== `${localId}-a`));
        setRefusal(result.reason ?? "unknown");
      }
      await queryClient.invalidateQueries({ queryKey: STUDENT_BOT_KEY });
    } catch {
      dropImage();
      setBubbles((prev) => prev.filter((bubble) => bubble.id !== `${localId}-a`));
      setRefusal("unknown");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Skeleton className="h-72 w-full rounded-2xl" />;

  if (!session) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-panel">
        <Lock className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <h2 className="mt-2 text-sm font-black text-foreground">
          {ar ? "سجّل الدخول لتسأل المساعد" : "Sign in to ask the assistant"}
        </h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {ar
            ? "٥ أسئلة مجانية يوميًا لكل طالب، بلا أي بيانات دفع."
            : "Five free questions a day, no payment details needed."}
        </p>
        <Button asChild className="mt-3 min-h-11">
          <a href={loginHref(currentPath())}>{ar ? "تسجيل الدخول" : "Sign in"}</a>
        </Button>
      </div>
    );
  }

  const info = state.data;
  const refusalCopy = refusal ? studentBotRefusalCopy(refusal, locale) : null;

  return (
    <div className="grid gap-3">
      {/* Grade + subject */}
      <section className="rounded-2xl border border-border bg-card p-3 shadow-panel sm:p-4">
        <p className="text-[11px] font-black text-foreground">
          {ar ? "صفّك ومادتك" : "Your grade and subject"}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {STUDENT_GRADES.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={grade === item.key}
              onClick={() => {
                setGrade(item.key);
                writeStudentPref({ grade: item.key, subject: "" });
              }}
              className={
                grade === item.key
                  ? "min-h-9 rounded-full bg-primary px-3 text-[11px] font-black text-primary-foreground"
                  : "min-h-9 rounded-full border border-border bg-background px-3 text-[11px] font-black text-muted-foreground"
              }
            >
              {ar ? item.ar : item.en}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {subjects.map((item) => {
            const label = ar ? item.ar : item.en;
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={subject === label}
                onClick={() => {
                  setSubject(label);
                  writeStudentPref({ grade, subject: label });
                }}
                className={
                  subject === label
                    ? "min-h-9 rounded-full bg-accent px-3 text-[11px] font-black text-accent-foreground"
                    : "min-h-9 rounded-full border border-border bg-background px-3 text-[11px] font-black text-muted-foreground"
                }
              >
                {label}
              </button>
            );
          })}
        </div>

        {info ? (
          <p className="mt-3 text-[10px] font-bold tabular-nums text-muted-foreground">
            {ar
              ? `أسئلتك المتاحة اليوم: ${info.remaining} من ${info.daily_limit}`
              : `Questions left today: ${info.remaining} of ${info.daily_limit}`}
            {info.plan
              ? ` · ${ar ? info.plan.name_ar : info.plan.name_en}`
              : ` · ${ar ? "الباقة المجانية" : "Free tier"}`}
          </p>
        ) : null}
      </section>

      {/* Transcript */}
      <section className="min-h-64 rounded-2xl border border-border bg-card p-3 shadow-panel sm:p-4">
        {bubbles.length === 0 ? (
          <div className="grid place-items-center px-3 py-8 text-center">
            <Mascot name="kaheel" className="h-24 w-auto" />
            <p className="mt-2 text-sm font-black text-foreground">
              {ar ? "اسألني عن أي درس 🙂" : "Ask me about any lesson 🙂"}
            </p>
            <p className="mt-1 max-w-sm text-[11px] leading-6 text-muted-foreground">
              {ar
                ? "اكتب سؤالك أو ارفع صورته. سأشرح خطوة بخطوة، وأحبّ أن تجرّب أولًا قبل الحل الكامل."
                : "Type your question or upload a photo. I explain step by step and like you to try first."}
            </p>
          </div>
        ) : (
          <ol className="grid gap-2.5">
            {bubbles.map((bubble) => (
              <li
                key={bubble.id}
                className={bubble.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                {bubble.role === "user" ? (
                  <span className="max-w-[85%] rounded-2xl rounded-be-sm bg-primary px-3 py-2 text-xs leading-6 text-primary-foreground">
                    {bubble.hadImage ? (
                      <ImageIcon className="mb-1 inline size-3.5 align-middle" aria-hidden />
                    ) : null}{" "}
                    {bubble.text}
                  </span>
                ) : (
                  <span className="max-w-[92%] whitespace-pre-wrap text-xs leading-7 text-foreground">
                    {bubble.pending ? (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        {ar ? "أفكّر بالحل…" : "Thinking…"}
                      </span>
                    ) : (
                      bubble.text
                    )}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
        <div ref={bottomRef} />
      </section>

      {/* Server verdict (being set up / daily limit / monthly cap …) */}
      {refusalCopy ? (
        <section className="rounded-2xl border border-accent/45 bg-accent/8 p-4">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-black text-foreground">{refusalCopy.title}</p>
              <p className="mt-1 text-[11px] leading-6 text-muted-foreground">{refusalCopy.body}</p>
              {refusalCopy.showPlans ? <StudentBotPlans className="mt-3" /> : null}
              <Link
                to="/guides/students"
                className="mt-3 inline-flex min-h-9 items-center rounded-full border border-border bg-card px-3 text-[11px] font-black text-foreground"
              >
                {ar ? "أدوات الدراسة المجانية" : "Free study tools"}
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* Composer */}
      <section className="rounded-2xl border border-border bg-card p-3 shadow-panel">
        {image ? (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-muted/45 p-2">
            <img
              src={image.previewUrl}
              alt={ar ? "معاينة صورة السؤال" : "Question photo preview"}
              className="size-14 rounded-lg object-cover"
            />
            <p className="min-w-0 flex-1 text-[10px] leading-5 text-muted-foreground">
              {ar
                ? `مضغوطة داخل جهازك (${Math.round(image.bytes / 1024)} ك.ب) — تُحذف فور الإجابة.`
                : `Compressed in your browser (${Math.round(image.bytes / 1024)} KB) — deleted right after the answer.`}
            </p>
            <button
              type="button"
              onClick={dropImage}
              aria-label={ar ? "إزالة الصورة" : "Remove photo"}
              className="grid size-9 place-items-center rounded-full border border-border bg-card text-muted-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          <textarea
            ref={composerRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={2}
            disabled={busy}
            placeholder={ar ? "اكتب سؤالك…" : "Type your question…"}
            className="min-h-11 flex-1 resize-y rounded-xl border border-input bg-background p-2.5 text-xs leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void pickImage(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            aria-label={ar ? "رفع صورة السؤال" : "Upload question photo"}
            className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-background text-muted-foreground"
          >
            <ImageIcon className="size-4" aria-hidden />
          </button>
          <Button
            type="button"
            onClick={() => void send()}
            disabled={busy || (!text.trim() && !image)}
            className="size-11 shrink-0 p-0"
            aria-label={ar ? "إرسال" : "Send"}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
          </Button>
        </div>

        <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-5 text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
          {ar
            ? "صورتك تُحذف فور الإجابة ولا نحتفظ بها — نحفظ نص السؤال والجواب فقط لتتابع مراجعتك."
            : "Your photo is deleted right after the answer and never stored — only the question and answer text are kept."}
        </p>
      </section>

      {/* Earlier conversations */}
      {history.data && history.data.length > 0 ? (
        <section className="rounded-2xl border border-border bg-card p-3 shadow-panel">
          <p className="text-[11px] font-black text-foreground">
            {ar ? "محادثاتك السابقة" : "Your earlier conversations"}
          </p>
          <ul className="mt-2 grid gap-1.5">
            {history.data.slice(0, 8).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => {
                    setConversationId(row.status === "open" ? row.id : null);
                    setGrade(row.grade);
                    setSubject(row.subject);
                    setBubbles(
                      row.messages.map((message, index) => ({
                        ...message,
                        id: `${row.id}-${index}`,
                      })),
                    );
                    setRefusal(null);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-xl bg-background px-3 py-2 text-start"
                >
                  <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-foreground">
                    {row.title || (ar ? "محادثة" : "Conversation")}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {row.subject} · {row.message_count}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Trash2 className="size-3 shrink-0" aria-hidden />
            {ar
              ? "لا صور محفوظة هنا إطلاقًا — نص فقط."
              : "No photos are stored here — text only."}
          </p>
        </section>
      ) : null}
    </div>
  );
}

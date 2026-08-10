/**
 * شاشة إدارة المسميات — /admin/labels
 *
 * بحث فوري في كل كلمة ظاهرة للمستخدم، تعديل مباشر في الصف، «إعادة للافتراضي»،
 * وعمود يوضح الشاشة والسياق. التعديل يسري على كل الزوار (النص المخصص يُقرأ
 * من نفس الجدول عبر `label(key)` بمخزن مؤقت خمس دقائق).
 * قيد: نص فقط، بلا وسوم، وبحد ٨٠ حرفًا — مفروض في الواجهة والقاعدة.
 */

import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/marketplace/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import {
  LABEL_MAX_LENGTH,
  loadLabelRows,
  setLabelCustom,
  type UiLabelRow,
} from "@/lib/mkt-ui-labels";

export const Route = createFileRoute("/admin/labels")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "إدارة المسميات — كَحيل" },
      {
        name: "description",
        content: "تعديل أي كلمة ظاهرة في المنصة: النص الافتراضي، النص المخصص، والشاشة التي تظهر فيها.",
      },
      { property: "og:title", content: "إدارة المسميات — كَحيل" },
      { property: "og:description", content: "تخصيص مسميات الواجهة من مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLabelsPage,
});

function LabelRowEditor({ row, onSaved }: { row: UiLabelRow; onSaved: () => void }) {
  const [value, setValue] = useState(row.custom_text ?? "");
  const [busy, setBusy] = useState(false);
  const current = row.custom_text ?? "";
  const dirty = value.trim() !== current.trim();
  const effective = value.trim() || row.default_text;

  async function save(next: string | null) {
    setBusy(true);
    try {
      await setLabelCustom(row.label_key, next);
      onSaved();
      toast.success(next === null ? "أُعيد النص الافتراضي" : "تم حفظ المسمّى");
    } catch {
      toast.error("تعذّر الحفظ — تأكد من صلاحية الإدارة والنص المسموح");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-2xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <code className="text-nav text-muted-foreground" dir="ltr">
          {row.label_key}
        </code>
        <span className="text-nav text-muted-foreground">
          {row.screen} • {row.context_ar}
        </span>
      </div>
      <p className="mt-1 text-desc text-muted-foreground">
        الافتراضي: <span className="font-semibold text-foreground">{row.default_text}</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input
          value={value}
          maxLength={LABEL_MAX_LENGTH}
          placeholder="نص مخصص (اتركه فارغًا للافتراضي)"
          onChange={(event) => setValue(event.target.value.replace(/[<>]/g, ""))}
          className="min-w-0 flex-1"
          style={{ minHeight: 44 }}
        />
        <Button
          disabled={busy || !dirty}
          style={{ minHeight: 44 }}
          onClick={() => void save(value.trim() ? value : null)}
        >
          حفظ
        </Button>
        <Button
          variant="outline"
          disabled={busy || !row.custom_text}
          className="gap-1"
          style={{ minHeight: 44 }}
          onClick={() => {
            setValue("");
            void save(null);
          }}
        >
          <RotateCcw className="size-4" aria-hidden />
          إعادة للافتراضي
        </Button>
      </div>
      <p className="mt-1 text-nav text-muted-foreground">
        الظاهر للزوار: <strong className="text-foreground">{effective}</strong>
        {row.custom_text ? ` • آخر تعديل ${formatDateTime(row.updated_at)}` : ""}
      </p>
    </li>
  );
}

function AdminLabelsPage() {
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const rows = useQuery({ queryKey: ["mkt", "ui-label-rows"], queryFn: loadLabelRows });

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const all = rows.data ?? [];
    if (!needle) return all;
    return all.filter((row) =>
      [row.label_key, row.default_text, row.custom_text ?? "", row.screen, row.context_ar]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [rows.data, term]);

  const customCount = (rows.data ?? []).filter((row) => row.custom_text).length;

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["mkt", "ui-label-rows"] });
    void qc.invalidateQueries({ queryKey: ["mkt", "ui-labels"] });
  }

  return (
    <AdminShell title="إدارة المسميات">
      <div className="mx-auto w-full max-w-3xl space-y-3 p-4">
        <p className="text-desc text-muted-foreground">
          {(rows.data ?? []).length.toLocaleString("en-US")} مسمّى مسجّل، منها{" "}
          {customCount.toLocaleString("en-US")} مخصّص. النص فقط، بلا وسوم، وبحد {LABEL_MAX_LENGTH}{" "}
          حرفًا.
        </p>
        <div className="relative">
          <Search
            className="pointer-events-none absolute inset-y-0 end-3 my-auto size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="ابحث عن أي كلمة أو مفتاح أو شاشة"
            aria-label="بحث في المسميات"
            className="pe-9"
            style={{ minHeight: 44 }}
          />
        </div>

        {rows.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-body text-muted-foreground">لا نتائج مطابقة.</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((row) => (
              <LabelRowEditor key={row.id} row={row} onSaved={refresh} />
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}

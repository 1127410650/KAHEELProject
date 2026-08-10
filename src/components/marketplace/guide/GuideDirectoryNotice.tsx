/**
 * The directory's standing legal notice. It is shown at the top of the guide
 * list and at the top of every entity page, with the two owner actions —
 * claiming the page and asking for a correction or a removal.
 */
import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";

export function GuideDirectoryNotice({
  placeName,
  placeSlug,
  onClaim,
}: {
  placeName?: string | null;
  placeSlug?: string | null;
  onClaim?: () => void;
}) {
  const removalSearch = placeSlug
    ? { place: placeSlug, name: placeName ?? undefined }
    : undefined;

  const actionClass =
    "min-h-9 content-center rounded-xl border border-primary/30 bg-card px-2.5 text-[10.5px] font-black text-primary hover:bg-primary/8";

  return (
    <aside
      className="rounded-2xl border border-primary/20 bg-primary/6 p-3 sm:p-3.5"
      aria-label="ملاحظة عن دليل كَحيل"
    >
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 space-y-1.5">
          <h2 className="text-[12px] font-black text-foreground">دليل عام لخدمة الناس</h2>
          <p className="text-[11px] font-bold leading-5 text-muted-foreground">
            كَحيل دليل خدمي مجاني يساعدك على الوصول إلى الجهة الصحيحة. المعلومات مجمّعة من مصادر
            عامة منشورة: سجلات رسمية للجهات المعنية وبيانات خرائط مفتوحة (© مساهمو OpenStreetMap —
            ODbL)، وقد تكون ناقصة أو غير محدَّثة. كَحيل لا يمثّل هذه الجهات ولا يرتبط بها ولا
            يتقاضى مقابلًا للإدراج.
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10.5px] font-black text-foreground">صاحب الجهة؟</span>
            {onClaim ? (
              <button type="button" onClick={onClaim} className={actionClass}>
                المطالبة بالصفحة
              </button>
            ) : null}
            <Link
              to="/guides/removal-request"
              search={removalSearch}
              className={actionClass}
            >
              طلب تعديل أو إزالة
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}

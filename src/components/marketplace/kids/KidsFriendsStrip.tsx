import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";
import { KIDS_FRIENDS, kidsFriendMeta, type KidsFriendId } from "@/lib/kids-friends";
import { KidsFriend, KidsFriendTap } from "./KidsFriend";

/** شريط تعريفي لطيف بعائلة أصدقاء كَحيل الصغار (شارات + لمس تفاعلي). */
export function KidsFriendsStrip({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-border bg-card/80 p-4 shadow-sm",
        className,
      )}
      aria-label="أصدقاء كَحيل الصغار"
    >
      <h2 className="text-section font-bold text-foreground">أصدقاء كَحيل الصغار</h2>
      <p className="mt-1 text-desc text-muted-foreground">
        كل صديق يدلّك على قسمه — اضغط عليه ليغمز لك.
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {KIDS_FRIENDS.map((friend) => (
          <li
            key={friend.id}
            className="flex items-center gap-2 rounded-2xl bg-brand-50 px-2.5 py-2 dark:bg-brand-950"
          >
            <KidsFriendTap id={friend.id} size={40} />
            <span className="min-w-0">
              <span className="block truncate text-desc font-bold text-foreground">
                {friend.nameAr}
              </span>
              <span className="block text-desc leading-tight text-muted-foreground">
                {friend.roleAr}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** شارة صغيرة تُستخدم على رقاقات التصنيفات الفرعية. */
export function KidsFriendBadge({ id, size = 26 }: { id: KidsFriendId; size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-brand-50 dark:bg-brand-950"
      style={{ width: size + 6, height: size + 6 }}
    >
      <KidsFriend id={id} size={size} motion="sway" />
    </span>
  );
}

/** حالة فارغة ودودة بشخصية حزينة لطيفة. */
export function KidsEmptyState({
  id = "dabdoob",
  actionHref,
  actionLabel,
}: {
  id?: KidsFriendId;
  actionHref?: string;
  actionLabel?: string;
}) {
  const meta = kidsFriendMeta(id);
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-card/70 px-4 py-10 text-center">
      <KidsFriend id={id} mood="sad" size={96} motion="sway" title={`${meta.nameAr} حزين`} />
      <p className="text-sm font-bold text-foreground">ما في نتائج… جرّب تصنيف تاني</p>
      <p className="text-desc text-muted-foreground">
        {meta.nameAr} دوّر كتير وما لقى شي هون — خلّينا نجرّب قسم غيره.
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <Link
          to="/kids"
          className="rounded-full bg-primary px-4 py-2 text-desc font-bold text-primary-foreground"
        >
          كل أقسام الأطفال
        </Link>
        {actionHref ? (
          <a
            href={actionHref}
            className="rounded-full border border-border px-4 py-2 text-desc font-bold text-foreground"
          >
            {actionLabel ?? "إضافة إعلان"}
          </a>
        ) : null}
      </div>
    </div>
  );
}

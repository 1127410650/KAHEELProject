import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { KidsFriend, KidsFriendTap } from "@/components/marketplace/kids/KidsFriend";
import {
  KidsEmptyState,
  KidsFriendsStrip,
} from "@/components/marketplace/kids/KidsFriendsStrip";
import { KIDS_FRIENDS, isKidsWorld, kidsFriendFor } from "@/lib/kids-friends";
import { loadCategories } from "@/lib/mkt-queries";
import { canonicalLinks, canonicalMeta } from "@/lib/share-links";

export const Route = createFileRoute("/kids")({
  ssr: false,
  head: () => {
    const title = "عالم الصغار — كَحيل";
    const description =
      "ألعاب وملابس أطفال ومستلزمات رضّع وقرطاسية مدرسية — مع أصدقاء كَحيل الصغار يدلّونك على كل قسم.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...canonicalMeta("/kids"),
      ],
      links: canonicalLinks("/kids"),
    };
  },
  component: KidsWorldPage,
});

function KidsWorldPage() {
  const categories = useQuery({ queryKey: ["mkt", "categories"], queryFn: loadCategories });
  const kidsCategories = (categories.data ?? []).filter((c) =>
    isKidsWorld([c.slug, c.name_ar, c.name_en]),
  );

  return (
    <MarketShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <header className="rounded-3xl bg-[#f6f0ff] p-5 dark:bg-[#2a1f3d]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-primary">أطفال · مواليد · ألعاب</p>
              <h1 className="mt-1 text-xl font-bold text-foreground sm:text-2xl">عالم الصغار</h1>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                مساحة مرحة وآمنة — أصدقاؤنا الصغار بيدلّوك على القسم اللي بدّك ياه.
              </p>
            </div>
            <div className="flex shrink-0 items-end gap-1">
              {KIDS_FRIENDS.slice(0, 3).map((f, i) => (
                <KidsFriend
                  key={f.id}
                  id={f.id}
                  size={i === 1 ? 60 : 46}
                  motion={i === 1 ? "hop" : "sway"}
                />
              ))}
            </div>
          </div>
        </header>

        <KidsFriendsStrip className="mt-4" />

        <h2 className="mt-6 text-sm font-bold text-foreground">أقسام الصغار</h2>
        {kidsCategories.length > 0 ? (
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {kidsCategories.map((c, i) => (
              <Link
                key={c.id}
                to="/categories/$slug"
                params={{ slug: c.slug }}
                className="k-press flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:bg-accent"
              >
                <KidsFriendTap id={kidsFriendFor({ slug: c.slug, name: c.name_ar }, i)} size={40} />
                <span className="min-w-0 truncate text-xs font-bold text-foreground">
                  {c.name_ar}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-3">
            <KidsEmptyState id="natnoot" />
          </div>
        )}

        <h2 className="mt-6 text-sm font-bold text-foreground">شارات ومكافآت</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {KIDS_FRIENDS.map((f) => (
            <span
              key={f.id}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pe-3 ps-1 text-[11px] font-bold text-foreground"
            >
              <KidsFriend id={f.id} size={28} motion="sway" />
              نجمة {f.roleAr}
            </span>
          ))}
        </div>
      </div>
    </MarketShell>
  );
}

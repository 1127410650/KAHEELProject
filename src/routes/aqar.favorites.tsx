/**
 * مفضلة كَحيل عقار — محفوظة على هذا الجهاز، مع قوائم مخصصة (سفر، عمل، للعائلة…).
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FolderPlus, Heart, Trash2 } from "lucide-react";
import { useState } from "react";

import { AqarListingCard } from "@/components/marketplace/aqar/AqarListingCard";
import { AqarShell } from "@/components/marketplace/aqar/AqarShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AQAR_DEFAULT_LIST,
  useAqarFavoriteLists,
  useAqarFavorites,
} from "@/lib/aqar-favorites";
import { fetchAqarListing, fetchAqarUsdRate } from "@/lib/mkt-aqar";

export const Route = createFileRoute("/aqar/favorites")({
  head: () => ({
    meta: [
      { title: "المفضلة — كَحيل عقار" },
      {
        name: "description",
        content: "العقارات التي حفظتها على هذا الجهاز في كَحيل عقار، مرتّبة في قوائم مخصصة.",
      },
      { property: "og:title", content: "المفضلة — كَحيل عقار" },
      { property: "og:description", content: "قوائم العقارات المحفوظة في كَحيل عقار." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AqarFavoritesPage,
});

function AqarFavoritesPage() {
  const { ids, toggle } = useAqarFavorites();
  const { lists, createList, removeList, setMembership } = useAqarFavoriteLists();
  const [newList, setNewList] = useState("");
  const [active, setActive] = useState<string>(AQAR_DEFAULT_LIST);

  const usdRate = useQuery({
    queryKey: ["aqar", "usd-rate"],
    queryFn: fetchAqarUsdRate,
    staleTime: 5 * 60 * 1000,
  });
  const listings = useQuery({
    queryKey: ["aqar", "favorites", ids],
    queryFn: async () => {
      const rows = await Promise.all(ids.map((id) => fetchAqarListing(id)));
      return rows.filter((row): row is NonNullable<typeof row> => row !== null);
    },
    enabled: ids.length > 0,
  });

  const rows = listings.data ?? [];
  const listNames = Object.keys(lists);
  const tabs = [AQAR_DEFAULT_LIST, ...listNames];
  const shown =
    active === AQAR_DEFAULT_LIST ? rows : rows.filter((row) => (lists[active] ?? []).includes(row.id));

  return (
    <AqarShell title="المفضلة" subtitle="محفوظة على هذا الجهاز" back="/aqar" backLabel="عقار">
      <div className="mx-auto w-full max-w-3xl p-4 pb-10">
        {ids.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Heart className="size-8 text-primary" aria-hidden />
            <p className="text-body text-foreground">لم تحفظ أي عقار بعد.</p>
            <Link to="/aqar" className="text-desc font-bold text-primary">
              تصفّح العقارات
            </Link>
          </div>
        ) : (
          <>
            {/* تبويبات القوائم */}
            <ul className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tabs.map((name) => {
                const count =
                  name === AQAR_DEFAULT_LIST ? rows.length : (lists[name] ?? []).length;
                const isActive = name === active;
                return (
                  <li key={name} className="shrink-0">
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setActive(name)}
                      className={`rounded-full border px-3 text-desc font-bold ${
                        isActive
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground"
                      }`}
                      style={{ minHeight: 44 }}
                    >
                      {name} ({count.toLocaleString("en-US")})
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* إنشاء قائمة جديدة */}
            <div className="flex flex-wrap items-center gap-2 pb-3">
              <Input
                value={newList}
                maxLength={40}
                onChange={(event) => setNewList(event.target.value)}
                placeholder="قائمة جديدة: صيف، للعائلة، عمل…"
                className="w-auto flex-1"
                style={{ minHeight: 44 }}
                aria-label="اسم القائمة الجديدة"
              />
              <Button
                variant="outline"
                className="gap-1"
                style={{ minHeight: 44 }}
                disabled={!newList.trim()}
                onClick={() => {
                  createList(newList);
                  setActive(newList.trim().slice(0, 40));
                  setNewList("");
                }}
              >
                <FolderPlus className="size-5" aria-hidden />
                إنشاء
              </Button>
              {active !== AQAR_DEFAULT_LIST ? (
                <Button
                  variant="outline"
                  className="gap-1"
                  style={{ minHeight: 44 }}
                  onClick={() => {
                    removeList(active);
                    setActive(AQAR_DEFAULT_LIST);
                  }}
                >
                  <Trash2 className="size-5" aria-hidden />
                  حذف القائمة
                </Button>
              ) : null}
            </div>

            {shown.length === 0 ? (
              <p className="py-8 text-center text-body text-muted-foreground">
                لا عقارات في هذه القائمة بعد — أضف من «المحفوظات».
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {shown.map((listing) => (
                  <li key={listing.id} className="flex flex-col gap-2">
                    <AqarListingCard
                      listing={listing}
                      usdRate={usdRate.data ?? null}
                      isFavorite
                      onToggleFavorite={toggle}
                      className="h-full"
                    />
                    {listNames.length > 0 ? (
                      <ul className="flex flex-wrap gap-1">
                        {listNames.map((name) => {
                          const member = (lists[name] ?? []).includes(listing.id);
                          return (
                            <li key={name}>
                              <button
                                type="button"
                                aria-pressed={member}
                                onClick={() => setMembership(name, listing.id, !member)}
                                className={`rounded-full border px-3 py-1 text-nav font-bold ${
                                  member
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border bg-card text-muted-foreground"
                                }`}
                              >
                                {member ? "✓ " : "+ "}
                                {name}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </AqarShell>
  );
}

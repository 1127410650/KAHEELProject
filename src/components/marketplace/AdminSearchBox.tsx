import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import { useI18n } from "@/i18n";
import { runAdminSearch, searchHref, type SearchGroupType } from "@/lib/mkt-admin-search";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

const GROUP_LABEL: Record<SearchGroupType, string> = {
  users: "admin.nav.users",
  businesses: "admin.nav.businesses",
  listings: "admin.nav.listings",
  reports: "admin.nav.reports",
  verifications: "admin.nav.verifications",
};

export function AdminSearchBox() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 350);
    return () => clearTimeout(timer);
  }, [term]);

  const results = useQuery({
    queryKey: ["mkt", "admin", "search", debounced],
    enabled: debounced.length >= 2,
    staleTime: 15_000,
    queryFn: () => runAdminSearch(debounced, 5),
  });

  const groups = results.data?.groups ?? [];
  const hasResults = groups.length > 0;

  function go(type: SearchGroupType, id: string) {
    setOpen(false);
    setTerm("");
    void navigate({ href: searchHref(type, id) });
  }

  return (
    <Popover open={open && debounced.length >= 2} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={boxRef} className="relative hidden min-w-0 flex-1 sm:block sm:max-w-sm xl:max-w-md">
          <Search
            className="pointer-events-none absolute inset-y-0 start-3 my-auto size-[17px] text-[#6d8582]"
            aria-hidden
          />
          <Input
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && term.trim().length >= 2) {
                setOpen(false);
                void navigate({ to: "/admin/search", search: { q: term.trim() } });
              }
            }}
            className="h-10 rounded-xl border-[#d6e8e6] bg-[#f7fbfa] ps-9 text-xs shadow-none placeholder:text-[#7f9794] focus-visible:border-[#72bdb7] focus-visible:ring-[#087f78]/15 dark:border-border dark:bg-background sm:text-sm"
            aria-label={t("admin.search.label")}
            placeholder={t("admin.search.placeholder")}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[min(25rem,92vw)] rounded-2xl border-[#dcebea] p-2 shadow-2xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="mb-1 flex items-center gap-2 rounded-xl bg-[#f4f9f8] px-3 py-2 dark:bg-accent">
          <Search className="size-4 text-[#087f78]" aria-hidden />
          <p className="truncate text-xs font-bold text-foreground">{term}</p>
        </div>

        {results.isLoading ? (
          <p className="px-3 py-5 text-center text-xs text-muted-foreground">{t("common.loading")}</p>
        ) : !hasResults ? (
          <p className="px-3 py-5 text-center text-xs text-muted-foreground">{t("admin.search.empty")}</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
            {groups.map((group) => (
              <div key={group.type} className="mb-2">
                <p className="flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-muted-foreground">
                  <span>{t(GROUP_LABEL[group.type])}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 tabular-nums">{group.count}</span>
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => go(group.type, item.id)}
                      className="flex min-h-12 w-full flex-col items-start justify-center rounded-xl px-3 text-start transition hover:bg-[#f2f9f8]"
                    >
                      <span className="w-full truncate text-sm font-semibold text-foreground">
                        {item.title || item.id}
                      </span>
                      {item.subtitle || item.meta ? (
                        <span className="mt-0.5 w-full truncate text-[10px] text-muted-foreground">
                          {[item.subtitle, item.meta].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void navigate({ to: "/admin/search", search: { q: debounced } });
              }}
              className="mt-1 flex min-h-11 w-full items-center justify-center rounded-xl border border-[#d6e8e6] bg-white text-xs font-bold text-[#087f78] transition hover:bg-[#f2f9f8] dark:border-border dark:bg-card dark:text-primary"
            >
              {t("admin.search.all")}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

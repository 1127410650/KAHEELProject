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

/**
 * The console's single search box. It never navigates outside the console and
 * never opens a new tab: a hit routes straight to that record's admin file.
 * Typing is debounced and the term must be at least two characters, so a
 * keystroke can not turn into a heavy query.
 */
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
        <div ref={boxRef} className="relative hidden min-w-0 flex-1 sm:block sm:max-w-xs">
          <Search
            className="pointer-events-none absolute inset-y-0 start-2.5 my-auto size-4 text-muted-foreground"
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
            className="h-11 ps-8"
            aria-label={t("admin.search.label")}
            placeholder={t("admin.search.placeholder")}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[min(24rem,90vw)] p-2"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {results.isLoading ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">{t("common.loading")}</p>
        ) : !hasResults ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">{t("admin.search.empty")}</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            {groups.map((group) => (
              <div key={group.type} className="mb-1">
                <p className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                  <span>{t(GROUP_LABEL[group.type])}</span>
                  <span className="tabular-nums">{group.count}</span>
                </p>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => go(group.type, item.id)}
                    className="flex min-h-11 w-full flex-col items-start justify-center rounded-md px-2 text-start hover:bg-accent"
                  >
                    <span className="w-full truncate text-sm text-foreground">
                      {item.title || item.id}
                    </span>
                    {(item.subtitle || item.meta) && (
                      <span className="w-full truncate text-[11px] text-muted-foreground">
                        {[item.subtitle, item.meta].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void navigate({ to: "/admin/search", search: { q: debounced } });
              }}
              className="mt-1 flex min-h-11 w-full items-center justify-center rounded-md border border-border text-xs font-semibold text-foreground hover:bg-accent"
            >
              {t("admin.search.all")}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

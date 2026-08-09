import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ExternalLink, Search, Store } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { catalogErrorKey } from "@/lib/mkt-store-catalog";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { ReasonDialog } from "@/components/marketplace/ReasonDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/stores")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "المتاجر — لوحة مدير النظام" },
      {
        name: "description",
        content: "متابعة متاجر السوق: الحالة والنوع والحساب المالك والمنتجات وإجراءات الإيقاف.",
      },
      { property: "og:title", content: "المتاجر — لوحة مدير النظام" },
      { property: "og:description", content: "إدارة متاجر السوق ومراجعتها." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminStoresPage,
});

interface AdminStoreRow {
  id: string;
  slug: string;
  name_ar: string;
  store_type: string;
  status: string;
  verification_status: string;
  owner_label: string;
  owner_kind: "individual" | "business";
  country_iso2: string | null;
  city_name_ar: string | null;
  items_count: number;
  reports_count: number;
  created_at: string;
  suspension_reason: string | null;
}

const STATUS_FILTERS = ["", "draft", "pending_review", "published", "suspended"] as const;

function AdminStoresPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<string>("");
  const [pending, setPending] = useState<{ row: AdminStoreRow; action: string } | null>(null);

  const stores = useQuery({
    queryKey: ["admin", "stores", term, status],
    staleTime: 5_000,
    queryFn: async (): Promise<AdminStoreRow[]> => {
      const { data, error } = await supabase.rpc("mkt_admin_stores", {
        ...(term ? { _q: term } : {}),
        ...(status ? { _status: status } : {}),
        _limit: 50,
        _offset: 0,
      });
      if (error) throw error;
      return (data ?? []) as unknown as AdminStoreRow[];
    },
  });

  async function act(row: AdminStoreRow, action: string, reason: string | null) {
    const { error } = await supabase.rpc("mkt_admin_store_action", {
      _storefront_id: row.id,
      _action: action,
      ...(reason ? { _reason: reason } : {}),
    });
    if (error) {
      toast.error(t(catalogErrorKey(error)));
      return;
    }
    toast.success(t("admin.stores.actionDone"));
    setPending(null);
    await queryClient.invalidateQueries({ queryKey: ["admin", "stores"] });
  }

  return (
    <AdminShell title={t("admin.stores.title")}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={t("admin.stores.searchPlaceholder")}
              className="ps-9"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((value) => (
              <Button
                key={value || "all"}
                size="sm"
                variant={status === value ? "default" : "outline"}
                onClick={() => setStatus(value)}
              >
                {value ? t(`market.store.status.${value}`) : t("admin.stores.all")}
              </Button>
            ))}
          </div>
        </div>

        {stores.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (stores.data ?? []).length === 0 ? (
          <Card>
            <CardContent className="pt-5 text-sm text-muted-foreground">
              {t("admin.stores.empty")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {(stores.data ?? []).map((row) => (
              <Card key={row.id}>
                <CardContent className="space-y-3 pt-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Store className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{row.name_ar}</span>
                    <Badge variant="secondary">{t(`market.store.status.${row.status}`)}</Badge>
                    <Badge variant="outline">{t(`market.store.type.${row.store_type}`)}</Badge>
                    <Badge variant="outline">
                      {t(`admin.stores.owner.${row.owner_kind}`)}: {row.owner_label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {[row.city_name_ar, row.country_iso2].filter(Boolean).join(" · ")} ·{" "}
                    {t("admin.stores.items")}: {row.items_count} · {t("admin.stores.reports")}:{" "}
                    {row.reports_count} · {formatDateTime(row.created_at)}
                  </p>
                  {row.suspension_reason ? (
                    <p className="text-sm text-destructive">{row.suspension_reason}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {row.status === "published" ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={`/stores/${row.slug}`} target="_blank" rel="noreferrer noopener">
                          <ExternalLink className="me-1 h-4 w-4" />
                          {t("admin.stores.openPublic")}
                        </a>
                      </Button>
                    ) : null}
                    {row.status !== "suspended" ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setPending({ row, action: "suspend" })}
                      >
                        {t("admin.stores.suspend")}
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => void act(row, "reinstate", null)}>
                        {t("admin.stores.reinstate")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPending({ row, action: "request_changes" })}
                    >
                      {t("admin.stores.requestChanges")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {pending ? (
        <ReasonDialog
          open
          title={t(`admin.stores.${pending.action === "suspend" ? "suspend" : "requestChanges"}`)}
          confirmLabel={t("common.confirm")}
          destructive={pending.action === "suspend"}
          onCancel={() => setPending(null)}
          onConfirm={(reason) => void act(pending.row, pending.action, reason)}
        />
      ) : null}
    </AdminShell>
  );
}

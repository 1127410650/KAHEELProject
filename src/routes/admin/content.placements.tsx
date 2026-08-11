/**
 * مواضع الحملات — /admin/content/placements
 *
 * توسعة لنظام الحملات القائم (`mkt_ad_campaigns` + `mkt_ad_campaign_events`)
 * لا جدول حملات ثانٍ: هذه الشاشة تربط حملة موجودة بموضع معرّف في
 * `mkt_cms_ad_placements` عبر `mkt_cms_campaign_placements` مع وزن ونافذة زمنية
 * وحملة بديلة عند غياب المحتوى.
 *
 * التعارض مكشوف لا مسكوت عنه: إذا تجاوز عدد الحملات النشطة في الموضع حده
 * (`max_active`) يظهر تنبيه صريح قبل الحفظ.
 */
import { useMemo, useState } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, LayoutGrid, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { AdminCard, AdminEmptyState, AdminPageHead } from "@/components/admin/AdminPage";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/admin/content/placements")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "مواضع الحملات — كَحيل" },
      {
        name: "description",
        content: "ربط الحملات القائمة بمواضع العرض مع وزن ونافذة زمنية وحملة بديلة.",
      },
      { property: "og:title", content: "مواضع الحملات — كَحيل" },
      { property: "og:description", content: "جدولة الحملات على مواضع العرض وكشف التعارض." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlacementsPage,
});

interface Placement {
  placement_key: string;
  name_ar: string;
  surface: string;
  aspect: string | null;
  max_active: number;
  is_active: boolean;
}

interface Campaign {
  id: string;
  title_ar: string | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
}

interface Assignment {
  id: string;
  campaign_id: string;
  placement_key: string;
  weight: number;
  starts_at: string | null;
  ends_at: string | null;
  fallback_campaign_id: string | null;
}

const PLACEMENTS_KEY = ["admin", "cms", "placements"] as const;
const ASSIGNMENTS_KEY = ["admin", "cms", "campaign-placements"] as const;

function overlaps(a: Assignment, b: Assignment): boolean {
  const aStart = a.starts_at ? new Date(a.starts_at).getTime() : -Infinity;
  const aEnd = a.ends_at ? new Date(a.ends_at).getTime() : Infinity;
  const bStart = b.starts_at ? new Date(b.starts_at).getTime() : -Infinity;
  const bEnd = b.ends_at ? new Date(b.ends_at).getTime() : Infinity;
  return aStart <= bEnd && bStart <= aEnd;
}

function PlacementsPage() {
  const qc = useQueryClient();
  const [placementKey, setPlacementKey] = useState<string>("");
  const [campaignId, setCampaignId] = useState<string>("");
  const [fallbackId, setFallbackId] = useState<string>("");
  const [weight, setWeight] = useState("10");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const placements = useQuery({
    queryKey: PLACEMENTS_KEY,
    queryFn: async (): Promise<Placement[]> => {
      const { data, error } = await supabase
        .from("mkt_cms_ad_placements")
        .select("placement_key, name_ar, surface, aspect, max_active, is_active")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Placement[];
    },
  });

  const campaigns = useQuery({
    queryKey: ["admin", "campaigns", "for-placements"],
    queryFn: async (): Promise<Campaign[]> => {
      const { data, error } = await supabase
        .from("mkt_ad_campaigns")
        .select("id, title_ar, status, starts_at, ends_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Campaign[];
    },
  });

  const assignments = useQuery({
    queryKey: ASSIGNMENTS_KEY,
    queryFn: async (): Promise<Assignment[]> => {
      const { data, error } = await supabase
        .from("mkt_cms_campaign_placements")
        .select("id, campaign_id, placement_key, weight, starts_at, ends_at, fallback_campaign_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Assignment[];
    },
  });

  const campaignName = (id: string | null) =>
    campaigns.data?.find((c) => c.id === id)?.title_ar ?? "—";

  const save = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("mkt_cms_campaign_placements").insert({
        campaign_id: campaignId,
        placement_key: placementKey,
        weight: Math.max(1, Math.min(100, Number(weight) || 10)),
        starts_at: from ? new Date(from).toISOString() : null,
        ends_at: to ? new Date(to).toISOString() : null,
        fallback_campaign_id: fallbackId || null,
        created_by: user.user?.id ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("رُبطت الحملة بالموضع");
      void qc.invalidateQueries({ queryKey: ASSIGNMENTS_KEY });
      setCampaignId("");
      setFallbackId("");
    },
    onError: () => toast.error("تعذّر الحفظ — تحقق من الصلاحية والبيانات"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mkt_cms_campaign_placements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("أُزيل الربط");
      void qc.invalidateQueries({ queryKey: ASSIGNMENTS_KEY });
    },
    onError: () => toast.error("تعذّر الإزالة"),
  });

  /** تعارض = عدد الروابط المتقاطعة زمنيًا في الموضع يتجاوز حدّه. */
  const conflicts = useMemo(() => {
    const rows = assignments.data ?? [];
    const out: { placement_key: string; count: number; max: number }[] = [];
    for (const placement of placements.data ?? []) {
      const list = rows.filter((r) => r.placement_key === placement.placement_key);
      let worst = 0;
      for (const row of list) {
        const overlapping = list.filter((other) => overlaps(row, other)).length;
        worst = Math.max(worst, overlapping);
      }
      if (worst > placement.max_active)
        out.push({ placement_key: placement.placement_key, count: worst, max: placement.max_active });
    }
    return out;
  }, [assignments.data, placements.data]);

  const selected = placementKey
    ? (assignments.data ?? []).filter((a) => a.placement_key === placementKey)
    : (assignments.data ?? []);

  return (
    <AdminShell title="مواضع الحملات">
      <AdminPageHead
        title="المواضع والجدولة"
        description="نفس حملات النظام الحالي — هذه الشاشة تجدولها على مواضع العرض فقط."
      />

      {conflicts.length > 0 && (
        <AdminCard title="تعارض جدولة" className="mb-[var(--sp-4)]">
          <ul className="space-y-1">
            {conflicts.map((c) => (
              <li key={c.placement_key} className="flex items-center gap-2 text-desc text-foreground">
                <TriangleAlert aria-hidden className="size-4 text-destructive" />
                <span dir="ltr">{c.placement_key}</span> — {c.count} حملة متقاطعة والحد {c.max}
              </li>
            ))}
          </ul>
        </AdminCard>
      )}

      <div className="grid gap-[var(--sp-4)] lg:grid-cols-[320px_minmax(0,1fr)]">
        <AdminCard title="ربط حملة بموضع">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-desc">الموضع</Label>
              <Select value={placementKey} onValueChange={setPlacementKey}>
                <SelectTrigger style={{ minHeight: 44 }}>
                  <SelectValue placeholder="اختر موضعًا" />
                </SelectTrigger>
                <SelectContent>
                  {(placements.data ?? []).map((p) => (
                    <SelectItem key={p.placement_key} value={p.placement_key}>
                      {p.name_ar} — حد {p.max_active}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-desc">الحملة</Label>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger style={{ minHeight: 44 }}>
                  <SelectValue placeholder="اختر حملة" />
                </SelectTrigger>
                <SelectContent>
                  {(campaigns.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title_ar ?? c.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-desc">حملة بديلة عند غياب المحتوى</Label>
              <Select value={fallbackId} onValueChange={setFallbackId}>
                <SelectTrigger style={{ minHeight: 44 }}>
                  <SelectValue placeholder="بلا بديل" />
                </SelectTrigger>
                <SelectContent>
                  {(campaigns.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title_ar ?? c.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-desc">من</Label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  style={{ minHeight: 44 }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-desc">إلى</Label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  style={{ minHeight: 44 }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-desc">الوزن (1–100)</Label>
              <Input
                dir="ltr"
                value={weight}
                onChange={(e) => setWeight(e.target.value.replace(/[^0-9]/g, ""))}
                style={{ minHeight: 44 }}
              />
            </div>

            <Button
              className="w-full"
              disabled={!placementKey || !campaignId || save.isPending}
              onClick={() => save.mutate()}
              style={{ minHeight: 44 }}
            >
              حفظ الربط
            </Button>
          </div>
        </AdminCard>

        <AdminCard
          title="الجدول الزمني"
          description="كل ربط مع نافذته ووزنه وبديله — الترتيب من الأحدث."
        >
          {assignments.isLoading || placements.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : selected.length === 0 ? (
            <AdminEmptyState
              icon={LayoutGrid}
              title="لا روابط بعد"
              hint="اختر موضعًا وحملة لبدء الجدولة."
            />
          ) : (
            <ul className="space-y-2">
              {selected.map((row) => (
                <li
                  key={row.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--r-card)] border border-border p-3"
                >
                  <div className="min-w-0">
                    <span className="block truncate text-body font-bold text-foreground">
                      {campaignName(row.campaign_id)}
                    </span>
                    <span className="block truncate text-nav text-muted-foreground" dir="ltr">
                      {row.placement_key} • w{row.weight}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-nav text-muted-foreground">
                      <CalendarDays aria-hidden className="size-4" />
                      {row.starts_at ? formatDate(row.starts_at) : "بلا بداية"} —{" "}
                      {row.ends_at ? formatDate(row.ends_at) : "بلا نهاية"}
                    </span>
                    {row.fallback_campaign_id ? (
                      <span className="block truncate text-nav text-muted-foreground">
                        البديل: {campaignName(row.fallback_campaign_id)}
                      </span>
                    ) : null}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="إزالة"
                    className="size-11 text-destructive"
                    onClick={() => remove.mutate(row.id)}
                  >
                    <Trash2 aria-hidden className="size-5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </AdminShell>
  );
}

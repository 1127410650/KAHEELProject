import { useQuery } from "@tanstack/react-query";
import { Building2, FileText, Gauge, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  COMPLETION_LABELS,
  SERVICE_STATUS_LABELS,
  labelOf,
  pick,
  type PropertySummary,
} from "@/lib/property";

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] text-muted-foreground">{label}</span>
        <span className="num block text-sm font-semibold">{value}</span>
      </span>
    </div>
  );
}

/** Real-estate project summary: identity, deed, license, services and completion. */
export function PropertyCard({ projectId }: { projectId: string }) {
  const { locale } = useI18n();

  const { data } = useQuery({
    queryKey: ["property-summary", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("property_summary", { _project_id: projectId });
      if (error) throw error;
      return data as unknown as PropertySummary;
    },
  });

  const percent = data?.completion?.percent ?? 0;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {locale === "ar" ? "ملخص الملف العقاري" : "Property file summary"}
          </h2>
          <span className="num text-xs font-medium text-muted-foreground">{percent}%</span>
        </div>
        <Progress value={percent} className="h-2" />

        <div className="flex flex-wrap gap-1.5">
          {(data?.completion?.sections ?? []).map((s) => (
            <span
              key={s.key}
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                s.done
                  ? "bg-primary/10 text-primary"
                  : "bg-secondary text-muted-foreground line-through"
              }`}
            >
              {labelOf(locale, COMPLETION_LABELS, s.key)}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            icon={<FileText className="size-4" aria-hidden />}
            label={locale === "ar" ? "رقم الصك" : "Deed no."}
            value={data?.deed_no ?? "—"}
          />
          <Stat
            icon={<Building2 className="size-4" aria-hidden />}
            label={locale === "ar" ? "رخصة البناء" : "License no."}
            value={data?.license_no ?? "—"}
          />
          <Stat
            icon={<Building2 className="size-4" aria-hidden />}
            label={locale === "ar" ? "الوحدات" : "Units"}
            value={data?.units_count ?? 0}
          />
          <Stat
            icon={<Users className="size-4" aria-hidden />}
            label={locale === "ar" ? "المشرفون" : "Supervisors"}
            value={data?.supervisors_count ?? 0}
          />
          <Stat
            icon={<FileText className="size-4" aria-hidden />}
            label={locale === "ar" ? "المستندات" : "Documents"}
            value={data?.documents_count ?? 0}
          />
          <Stat
            icon={<FileText className="size-4" aria-hidden />}
            label={locale === "ar" ? "طلبات مفتوحة" : "Open requests"}
            value={data?.open_requests ?? 0}
          />
          <Stat
            icon={<Gauge className="size-4" aria-hidden />}
            label={locale === "ar" ? "المساحة (م²)" : "Area (m²)"}
            value={data?.land_area ?? "—"}
          />
          <Stat
            icon={<Gauge className="size-4" aria-hidden />}
            label={locale === "ar" ? "المخطط / القطعة" : "Plan / parcel"}
            value={`${data?.plan_no ?? "—"} / ${data?.parcel_no ?? "—"}`}
          />
        </div>

        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {(["water", "electricity", "sewage"] as const).map((k) => (
            <span key={k} className="rounded-full bg-secondary px-2 py-0.5">
              {pick(
                locale,
                k === "water"
                  ? ["مياه", "Water"]
                  : k === "electricity"
                    ? ["كهرباء", "Electricity"]
                    : ["صرف صحي", "Sewage"],
              )}
              : {labelOf(locale, SERVICE_STATUS_LABELS, data?.[k] ?? "not_started")}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

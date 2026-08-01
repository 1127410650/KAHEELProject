import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { InfoTable, type InfoRow } from "@/components/InfoTable";
import { PropertyFormDialog, type FieldDef } from "@/components/property/PropertyFormDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { pdb, pick, type PropertyRow } from "@/lib/property";

export interface SectionProps {
  table: string;
  projectId: string;
  title: [string, string];
  hint?: [string, string];
  fields: FieldDef[];
  /** short heading shown on the collapsed row */
  primary: (row: PropertyRow) => string;
  /** small muted line under the heading */
  secondary?: (row: PropertyRow) => string;
  /** detail rows shown when expanded */
  details: (row: PropertyRow) => InfoRow[];
  canEdit: boolean;
  canDelete?: boolean;
  /** single-record sections (e.g. land) hide the add button once a row exists */
  single?: boolean;
  orderBy?: { column: string; ascending?: boolean };
  defaults?: Record<string, string | number | null>;
}

/** Generic CRUD section: compact list on mobile, schema-driven dialog for edits. */
export function PropertySection({
  table,
  projectId,
  title,
  hint,
  fields,
  primary,
  secondary,
  details,
  canEdit,
  canDelete,
  single,
  orderBy,
  defaults,
}: SectionProps) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PropertyRow | null>(null);

  const queryKey = ["property", table, projectId];

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await pdb
        .from(table)
        .select("*")
        .eq("project_id", projectId)
        .order(orderBy?.column ?? "created_at", { ascending: orderBy?.ascending ?? false });
      if (error) throw error;
      return (data ?? []) as PropertyRow[];
    },
  });

  const save = useMutation({
    mutationFn: async (values: Record<string, string | number | null>) => {
      if (editing) {
        const { error } = await pdb.from(table).update(values).eq("id", String(editing["id"]));
        if (error) throw error;
        return;
      }
      const { error } = await pdb
        .from(table)
        .insert({ ...defaults, ...values, project_id: projectId });
      if (error) throw error;
    },
    onSuccess: async () => {
      setOpen(false);
      setEditing(null);
      await qc.invalidateQueries({ queryKey });
      await qc.invalidateQueries({ queryKey: ["property-summary", projectId] });
      toast.success(locale === "ar" ? "تم الحفظ" : "Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await pdb.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey });
      await qc.invalidateQueries({ queryKey: ["property-summary", projectId] });
      toast.success(locale === "ar" ? "تم الحذف" : "Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const showAdd = canEdit && (!single || rows.length === 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 p-4 pb-2">
        <div className="min-w-0">
          <CardTitle className="text-sm">{pick(locale, title)}</CardTitle>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{pick(locale, hint)}</p>}
        </div>
        {showAdd && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 shrink-0 gap-1 px-2 text-xs"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-3.5" aria-hidden />
            {t("common.add")}
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-4 pt-0">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {locale === "ar" ? "لا توجد بيانات مسجلة." : "No records yet."}
          </p>
        ) : (
          <Accordion type="single" collapsible className="divide-y divide-border">
            {rows.map((row) => (
              <AccordionItem key={String(row["id"])} value={String(row["id"])} className="border-0">
                <AccordionTrigger className="py-2.5 text-start hover:no-underline">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{primary(row)}</span>
                    {secondary && (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {secondary(row)}
                      </span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <InfoTable dense rows={details(row)} />
                  {canEdit && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 px-2 text-xs"
                        onClick={() => {
                          setEditing(row);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        {t("common.edit")}
                      </Button>
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1 px-2 text-xs text-destructive"
                          onClick={() => remove.mutate(String(row["id"]))}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          {t("common.delete")}
                        </Button>
                      )}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>

      <PropertyFormDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
        title={pick(locale, title)}
        fields={fields}
        initial={editing ?? undefined}
        submitting={save.isPending}
        onSubmit={(values) => save.mutate(values)}
      />
    </Card>
  );
}

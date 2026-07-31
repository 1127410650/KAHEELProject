import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import {
  MEMBERSHIP_LABELS_AR,
  MEMBERSHIP_LABELS_EN,
  MEMBERSHIP_TYPES,
  type MembershipType,
} from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, pickName } from "@/lib/format";

interface MemberRow {
  id: string;
  supervisor_id: string;
  membership_type: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  supervisors: { name_ar: string | null; name_en: string | null } | null;
}

/** Project ↔ supervisors memberships (primary, partner, site, follow-up). */
export function ProjectMembersCard({ projectId }: { projectId: string }) {
  const { t, locale } = useI18n();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const labels = locale === "ar" ? MEMBERSHIP_LABELS_AR : MEMBERSHIP_LABELS_EN;
  const manage = can("projects.view_all");

  const [open, setOpen] = useState(false);
  const [supervisorId, setSupervisorId] = useState("");
  const [type, setType] = useState<MembershipType>("partner");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: members = [] } = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_supervisors")
        .select("id, supervisor_id, membership_type, start_date, end_date, is_active, supervisors(name_ar, name_en)")
        .eq("project_id", projectId)
        .order("membership_type");
      if (error) throw error;
      return (data ?? []) as unknown as MemberRow[];
    },
  });

  const { data: supervisors = [] } = useQuery({
    queryKey: ["members-supervisors"],
    enabled: manage,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supervisors")
        .select("id, name_ar, name_en")
        .is("deleted_at", null)
        .order("name_ar");
      if (error) throw error;
      return data ?? [];
    },
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
    void queryClient.invalidateQueries({ queryKey: ["projects"] });
  }

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("project_membership_set", {
        _project_id: projectId,
        _supervisor_id: supervisorId,
        _membership_type: type,
        ...(startDate ? { _start_date: startDate } : {}),
        ...(endDate ? { _end_date: endDate } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("members.added"));
      setOpen(false);
      setSupervisorId("");
      setStartDate("");
      setEndDate("");
      invalidate();
    },
    onError: () => toast.error(t("members.failed")),
  });

  const end = useMutation({
    mutationFn: async (membershipId: string) => {
      const reason = window.prompt(t("members.endReason")) ?? "";
      if (!reason.trim()) throw new Error("REASON_REQUIRED");
      const { error } = await supabase.rpc("project_membership_end", {
        _membership_id: membershipId,
        _reason: reason.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("members.ended"));
      invalidate();
    },
    onError: (error: Error) => {
      if (error.message.includes("REASON_REQUIRED")) toast.error(t("common.required"));
      else toast.error(t("members.failed"));
    },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4" aria-hidden />
          {t("members.title")}
        </CardTitle>
        {manage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-2">
                <Plus className="size-4" aria-hidden />
                {t("members.add")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("members.add")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("projects.supervisor")} *</Label>
                  <Select value={supervisorId} onValueChange={setSupervisorId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("common.select")} />
                    </SelectTrigger>
                    <SelectContent>
                      {supervisors.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {pickName(locale, s.name_ar, s.name_en)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("members.type")} *</Label>
                  <Select value={type} onValueChange={(v) => setType(v as MembershipType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEMBERSHIP_TYPES.map((m) => (
                        <SelectItem key={m} value={m}>
                          {labels[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="m_start">{t("members.startDate")}</Label>
                    <Input
                      id="m_start"
                      type="date"
                      dir="ltr"
                      className="num"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="m_end">{t("members.endDate")}</Label>
                    <Input
                      id="m_end"
                      type="date"
                      dir="ltr"
                      className="num"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  disabled={!supervisorId || save.isPending}
                  onClick={() => save.mutate()}
                >
                  {t("common.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {members.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">{t("members.empty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm">
                <Link
                  to="/supervisors/$id"
                  params={{ id: m.supervisor_id }}
                  className="font-medium text-primary hover:underline"
                >
                  {pickName(locale, m.supervisors?.name_ar, m.supervisors?.name_en)}
                </Link>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                  {labels[(m.membership_type ?? "primary") as MembershipType]}
                </span>
                <span
                  className={
                    m.is_active
                      ? "text-xs font-medium text-success"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {m.is_active ? t("members.active") : t("members.inactive")}
                </span>
                <span className="num text-xs text-muted-foreground">
                  {formatDate(m.start_date)}
                  {m.end_date ? ` — ${formatDate(m.end_date)}` : ""}
                </span>
                {manage && m.is_active && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="ms-auto gap-1 text-destructive"
                    disabled={end.isPending}
                    onClick={() => end.mutate(m.id)}
                  >
                    <UserMinus className="size-4" aria-hidden />
                    {t("members.endMembership")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

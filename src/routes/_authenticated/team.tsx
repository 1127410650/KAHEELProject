import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Copy, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/AppLayout";
import { RecordCard } from "@/components/RecordCard";
import {
  GROUPED_PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_GROUP_LABELS_AR,
  PERMISSION_GROUP_LABELS_EN,
  PERMISSION_LABELS_AR,
  PERMISSION_LABELS_EN,
  ROLE_DEFAULT_PERMISSIONS,
  type Permission,
} from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "الأعضاء والدعوات — تحقّق | Members — Tahqaq" },
      {
        name: "description",
        content:
          "إدارة أعضاء مساحة العمل في تحقّق: دعوة موظفين ومحاسبين ومشرفين ومقدمي خدمات بصلاحيات ومشاريع محددة.",
      },
      { property: "og:title", content: "الأعضاء والدعوات — تحقّق" },
      { property: "og:description", content: "Manage Tahqaq workspace members and invitations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamPage,
});

const INVITE_ROLES = [
  "admin",
  "accountant",
  "employee",
  "supervisor",
  "service_provider",
  "viewer",
] as const;
type InviteRole = (typeof INVITE_ROLES)[number];

interface MemberRow {
  membership_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  permissions: string[] | null;
  project_names: string[] | null;
  joined_at: string | null;
  membership_start: string | null;
  membership_end: string | null;
}

function TeamPage() {
  const { t, locale } = useI18n();
  const { can, isAccountant } = useSession();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [issued, setIssued] = useState<{ link: string; role: string } | null>(null);

  const canManage = isAccountant || can("users.manage");

  const members = useQuery({
    queryKey: ["tenant-members"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("tenant_members_list");
      if (error) throw error;
      return (data ?? []) as MemberRow[];
    },
    enabled: canManage,
  });

  const invitations = useQuery({
    queryKey: ["tenant-invitations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_invitations")
        .select(
          "id,email,mobile,invited_role,invitation_type,status,expires_at,created_at,project_ids,invited_permissions",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: canManage,
  });

  const membershipMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("tenant_memberships")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(t("team.saved"));
      await queryClient.invalidateQueries({ queryKey: ["tenant-members"] });
    },
    onError: () => toast.error(t("team.errors.FORBIDDEN")),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("invitation_revoke", { _id: id });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(t("team.saved"));
      await queryClient.invalidateQueries({ queryKey: ["tenant-invitations"] });
    },
    onError: () => toast.error(t("team.errors.FORBIDDEN")),
  });

  const now = Date.now();
  const activeMembers = (members.data ?? []).filter(
    (m) => m.status === "active" && m.role !== "service_provider",
  );
  const providers = (members.data ?? []).filter((m) => m.role === "service_provider");
  const suspended = (members.data ?? []).filter((m) => m.status !== "active");
  const pendingInvites = (invitations.data ?? []).filter(
    (i) => i.status === "pending" && new Date(i.expires_at).getTime() > now,
  );
  const expiredInvites = (invitations.data ?? []).filter(
    (i) => i.status !== "pending" || new Date(i.expires_at).getTime() <= now,
  );

  if (!canManage) {
    return (
      <div className="page-safe py-6">
        <PageHeader title={t("team.title")} />
        <p className="text-sm text-muted-foreground">{t("team.errors.FORBIDDEN")}</p>
      </div>
    );
  }

  return (
    <div className="page-safe pb-8">
      <PageHeader
        title={t("team.title")}
        description={t("team.subtitle")}
        actions={
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="size-4" aria-hidden />
                {t("team.invite")}
              </Button>
            </DialogTrigger>
            <InviteDialog
              onIssued={(payload) => {
                setIssued(payload);
                setInviteOpen(false);
                void queryClient.invalidateQueries({ queryKey: ["tenant-invitations"] });
              }}
            />
          </Dialog>
        }
      />

      {issued && (
        <div className="surface mb-4 space-y-2 p-3.5">
          <p className="text-sm font-semibold text-foreground">{t("team.link")}</p>
          <p className="text-xs text-muted-foreground">{t("team.linkOnce")}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly dir="ltr" value={issued.link} className="num text-xs" />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(issued.link);
                  toast.success(t("team.copied"));
                }}
              >
                <Copy className="size-4" aria-hidden />
                {t("team.copy")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const message = t("team.shareMessage")
                    .replace("{workspace}", t("app.name"))
                    .replace("{role}", t(`team.roles.${issued.role}`))
                    .replace("{link}", issued.link);
                  void navigator.clipboard.writeText(message);
                  toast.success(t("team.copied"));
                }}
              >
                {t("team.copyMessage")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="active">
        <TabsList className="w-full overflow-x-auto">
          <TabsTrigger value="active">{t("team.tabs.active")}</TabsTrigger>
          <TabsTrigger value="pending">{t("team.tabs.pending")}</TabsTrigger>
          <TabsTrigger value="providers">{t("team.tabs.providers")}</TabsTrigger>
          <TabsTrigger value="suspended">{t("team.tabs.suspended")}</TabsTrigger>
          <TabsTrigger value="expired">{t("team.tabs.expired")}</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <MemberList
            rows={activeMembers}
            onStatus={(id, status) => membershipMutation.mutate({ id, status })}
          />
        </TabsContent>
        <TabsContent value="providers">
          <MemberList
            rows={providers}
            onStatus={(id, status) => membershipMutation.mutate({ id, status })}
          />
        </TabsContent>
        <TabsContent value="suspended">
          <MemberList
            rows={suspended}
            onStatus={(id, status) => membershipMutation.mutate({ id, status })}
          />
        </TabsContent>
        <TabsContent value="pending">
          <InviteList rows={pendingInvites} onRevoke={(id) => revokeMutation.mutate(id)} />
        </TabsContent>
        <TabsContent value="expired">
          <InviteList rows={expiredInvites} />
        </TabsContent>
      </Tabs>

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        {locale === "ar"
          ? "لا يمكن منح دور المالك عبر الدعوة، ولا يمكن منح صلاحية لا تملكها."
          : "Owner role cannot be invited, and you cannot grant a permission you do not hold."}
      </p>
    </div>
  );
}

function MemberList({
  rows,
  onStatus,
}: {
  rows: MemberRow[];
  onStatus: (id: string, status: string) => void;
}) {
  const { t } = useI18n();
  if (rows.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">{t("team.noMembers")}</p>;
  }
  return (
    <>
      <div className="space-y-2 sm:hidden">
        {rows.map((row) => (
          <RecordCard
            key={row.membership_id}
            title={row.full_name || row.email || "—"}
            subtitle={t(`team.roles.${row.role}`)}
            fields={[
              { label: t("team.emailInvite"), value: row.email ?? "—", numeric: true },
              { label: t("team.joined"), value: formatDate(row.joined_at), numeric: true },
              {
                label: t("team.projects"),
                value: (row.project_names ?? []).join(" · ") || t("team.allProjects"),
              },
            ]}
            actions={
              row.role === "owner" ? null : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onStatus(row.membership_id, row.status === "active" ? "suspended" : "active")
                  }
                >
                  {row.status === "active" ? t("team.suspend") : t("team.activate")}
                </Button>
              )
            }
          />
        ))}
      </div>

      <div className="hidden sm:block">
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("signup.fullName")}</TableHead>
                <TableHead>{t("team.emailInvite")}</TableHead>
                <TableHead>{t("team.role")}</TableHead>
                <TableHead>{t("team.projects")}</TableHead>
                <TableHead>{t("team.joined")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.membership_id}>
                  <TableCell className="font-medium">{row.full_name || "—"}</TableCell>
                  <TableCell className="num" dir="ltr">
                    {row.email || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{t(`team.roles.${row.role}`)}</Badge>
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-xs text-muted-foreground">
                    {(row.project_names ?? []).join(" · ") || t("team.allProjects")}
                  </TableCell>
                  <TableCell className="num">{formatDate(row.joined_at)}</TableCell>
                  <TableCell className="text-end">
                    {row.role !== "owner" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onStatus(
                            row.membership_id,
                            row.status === "active" ? "suspended" : "active",
                          )
                        }
                      >
                        {row.status === "active" ? t("team.suspend") : t("team.activate")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}

interface InviteRow {
  id: string;
  email: string;
  mobile: string | null;
  invited_role: string;
  status: string;
  expires_at: string;
  project_ids: string[] | null;
}

function InviteList({
  rows,
  onRevoke,
}: {
  rows: InviteRow[];
  onRevoke?: (id: string) => void;
}) {
  const { t } = useI18n();
  if (rows.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">{t("team.noInvites")}</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <RecordCard
          key={row.id}
          title={row.email}
          subtitle={t(`team.roles.${row.invited_role}`)}
          fields={[
            { label: t("invite.expiresAt"), value: formatDate(row.expires_at), numeric: true },
            { label: t("team.mobile"), value: row.mobile ?? "—", numeric: true },
          ]}
          actions={
            onRevoke ? (
              <Button size="sm" variant="outline" onClick={() => onRevoke(row.id)}>
                {t("team.revoke")}
              </Button>
            ) : null
          }
        />
      ))}
    </div>
  );
}

function InviteDialog({
  onIssued,
}: {
  onIssued: (payload: { link: string; role: string }) => void;
}) {
  const { t, locale } = useI18n();
  const { can, isAccountant } = useSession();
  const [role, setRole] = useState<InviteRole>("employee");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [scopeAll, setScopeAll] = useState(true);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>(
    ROLE_DEFAULT_PERMISSIONS["employee"] ?? [],
  );

  const permissionLabels = locale === "ar" ? PERMISSION_LABELS_AR : PERMISSION_LABELS_EN;
  const groupLabels = locale === "ar" ? PERMISSION_GROUP_LABELS_AR : PERMISSION_GROUP_LABELS_EN;

  const projects = useQuery({
    queryKey: ["invite-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,code")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const grantable = useMemo(
    () =>
      new Set(
        (Object.keys(permissionLabels) as Permission[]).filter(
          (perm) => isAccountant || can(perm),
        ),
      ),
    [can, isAccountant, permissionLabels],
  );

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("invitation_create", {
        _email: email.trim(),
        _invited_role: role,
        _invitation_type: role === "service_provider" ? "service_provider" : "member",
        _permissions: permissions,
        _project_ids: scopeAll ? [] : projectIds,
        ...(mobile.trim() ? { _mobile: mobile.trim() } : {}),
        ...(start ? { _membership_start: start } : {}),
        ...(end ? { _membership_end: end } : {}),
      });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as { token: string } | undefined;
      return row?.token ?? "";
    },
    onSuccess: (token) => {
      onIssued({ link: `${window.location.origin}/invite/${token}`, role });
      toast.success(t("team.saved"));
    },
    onError: (error: { message?: string }) => {
      const message = error?.message ?? "";
      const code = [
        "DUPLICATE_INVITATION",
        "PERMISSION_ESCALATION",
        "RATE_LIMITED",
        "PENDING_LIMIT_REACHED",
        "OWNER_INVITE_FORBIDDEN",
        "NO_ACTIVE_WORKSPACE",
      ].find((candidate) => message.includes(candidate));
      toast.error(t(`team.errors.${code ?? "FORBIDDEN"}`));
    },
  });

  function changeRole(value: InviteRole) {
    setRole(value);
    setPermissions((ROLE_DEFAULT_PERMISSIONS[value] ?? []).filter((perm) => grantable.has(perm)));
  }

  function togglePermission(perm: string, checked: boolean) {
    setPermissions((prev) =>
      checked ? Array.from(new Set([...prev, perm])) : prev.filter((p) => p !== perm),
    );
  }

  return (
    <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{t("team.inviteTitle")}</DialogTitle>
      </DialogHeader>

      <div className="space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">{t("team.emailInvite")}</Label>
          <Input
            id="invite-email"
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="invite-mobile">{t("team.mobile")}</Label>
            <Input
              id="invite-mobile"
              dir="ltr"
              inputMode="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("team.role")}</Label>
            <Select value={role} onValueChange={(value) => changeRole(value as InviteRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITE_ROLES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`team.roles.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="invite-start">{t("team.start")}</Label>
            <Input
              id="invite-start"
              type="date"
              className="num"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-end">{t("team.end")}</Label>
            <Input
              id="invite-end"
              type="date"
              className="num"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("team.projects")}</Label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={scopeAll}
              onCheckedChange={(v) => setScopeAll(v === true)}
              aria-label={t("team.allProjects")}
            />
            <span>{t("team.allProjects")}</span>
          </label>
          {!scopeAll && (
            <div className="max-h-32 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2">
              {(projects.data ?? []).map((project) => (
                <label
                  key={project.id}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <Checkbox
                    checked={projectIds.includes(project.id)}
                    onCheckedChange={(v) =>
                      setProjectIds((prev) =>
                        v === true ? [...prev, project.id] : prev.filter((id) => id !== project.id),
                      )
                    }
                    aria-label={project.name}
                  />
                  <span className="truncate">{project.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>{t("team.permissions")}</Label>
          <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border border-border p-2.5">
            {PERMISSION_GROUPS.map((group) => {
              const items = (GROUPED_PERMISSIONS[group] ?? []).filter((perm) =>
                grantable.has(perm),
              );
              if (items.length === 0) return null;
              return (
                <div key={group} className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {groupLabels[group]}
                  </p>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {items.map((perm) => (
                      <label key={perm} className="flex items-start gap-2 text-xs text-foreground">
                        <Checkbox
                          checked={permissions.includes(perm)}
                          onCheckedChange={(v) => togglePermission(perm, v === true)}
                          aria-label={permissionLabels[perm]}
                        />
                        <span className="leading-snug">{permissionLabels[perm]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button
          className="w-full"
          disabled={create.isPending || !email.includes("@")}
          onClick={() => create.mutate()}
        >
          {create.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {create.isPending ? t("team.sending") : t("team.send")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

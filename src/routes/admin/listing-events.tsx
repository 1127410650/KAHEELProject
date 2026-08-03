import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import { loadStaffAccess, makeStaffAccess, type StaffPerm } from "@/lib/mkt-reports";
import {
  ADMIN_EVENT_TYPES,
  ADMIN_EXTEND_DAYS,
  ADMIN_LISTING_ACTIONS,
  ADMIN_ACTION_PERM,
  adminActionError,
  loadAdminListingBrief,
  loadAdminListingEvents,
  runAdminListingAction,
  type AdminListingAction,
  type AdminListingEvent,
} from "@/lib/mkt-listing-admin";
import { AdminShell } from "@/components/marketplace/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/listing-events")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "سجل عمليات الإعلانات — إدارة سوق تحقّق" },
      {
        name: "description",
        content:
          "سجل عمليات الإعلانات في سوق تحقّق: من فعل ماذا ومتى، مع إجراءات إدارية موثّقة بسبب مكتوب.",
      },
      { property: "og:title", content: "سجل عمليات الإعلانات — إدارة سوق تحقّق" },
      { property: "og:description", content: "سجل غير قابل للتعديل لكل عمليات الإعلانات." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminListingEventsPage,
});

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const PAGE_SIZE = 50;

interface Pending {
  event: AdminListingEvent;
  action: AdminListingAction;
}

function AdminListingEventsPage() {
  const { t } = useI18n();
  const { session } = useSession();

  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState<number>(30);
  const [busy, setBusy] = useState(false);

  const access = useQuery({
    queryKey: ["mkt", "staff-access", session?.user.id],
    enabled: !!session,
    queryFn: loadStaffAccess,
  });
  const staff = makeStaffAccess(access.data);
  const canView = staff.can("ads.events_view");

  const filters = { search, eventType, from, to, page, pageSize: PAGE_SIZE };
  const events = useQuery({
    queryKey: ["mkt", "admin-listing-events", filters],
    enabled: canView,
    queryFn: () => loadAdminListingEvents(filters),
  });

  const brief = useQuery({
    queryKey: ["mkt", "admin-listing-brief", pending?.event.listing_id],
    enabled: !!pending,
    queryFn: () => loadAdminListingBrief(pending!.event.listing_id),
  });

  const rows = events.data ?? [];
  const canViewIp = rows[0]?.can_view_ip ?? staff.can("ads.view_ip_device");

  function openAction(event: AdminListingEvent, action: AdminListingAction) {
    setPending({ event, action });
    setReason("");
    setDays(30);
  }

  async function submit() {
    if (!pending) return;
    if (!reason.trim()) {
      toast.error(t("market.admin.log.reasonRequired"));
      return;
    }
    setBusy(true);
    try {
      await runAdminListingAction({
        listingId: pending.event.listing_id,
        action: pending.action,
        reason: reason.trim(),
        ...(pending.action === "extend" ? { days } : {}),
      });
      toast.success(t("market.admin.log.actionDone"));
      setPending(null);
      await events.refetch();
    } catch (err) {
      toast.error(t(`market.admin.log.err.${adminActionError(err)}`));
    } finally {
      setBusy(false);
    }
  }

  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setPage(0);
      setter(value);
    };
  }

  return (
    <AdminShell
      title={t("market.admin.log.title")}
      staffAccess={canView}
      staffChecking={access.isLoading}
    >
      <p className="text-xs text-muted-foreground">{t("market.admin.log.hint")}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="log-q">{t("market.admin.log.search")}</Label>
          <Input
            id="log-q"
            value={search}
            onChange={(e) => resetPage(setSearch)(e.target.value)}
            placeholder={t("market.admin.log.searchPlaceholder")}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="log-type">{t("market.admin.log.eventType")}</Label>
          <select
            id="log-type"
            className={selectClass}
            value={eventType}
            onChange={(e) => resetPage(setEventType)(e.target.value)}
          >
            <option value="">{t("market.filters.all")}</option>
            {ADMIN_EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`market.admin.log.type.${type}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="log-from">{t("market.admin.log.from")}</Label>
          <Input
            id="log-from"
            type="date"
            value={from}
            onChange={(e) => resetPage(setFrom)(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="log-to">{t("market.admin.log.to")}</Label>
          <Input
            id="log-to"
            type="date"
            value={to}
            onChange={(e) => resetPage(setTo)(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        {canViewIp ? (
          <ShieldCheck className="size-3.5 text-primary" aria-hidden />
        ) : (
          <EyeOff className="size-3.5" aria-hidden />
        )}
        <span>{canViewIp ? t("market.admin.log.ipVisible") : t("market.admin.log.ipMasked")}</span>
      </div>

      {events.isLoading ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {t("market.admin.noResults")}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((event) => (
            <li key={event.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[11px]">
                  {t(`market.admin.log.type.${event.event_type}`)}
                </Badge>
                {event.listing_ref && (
                  <span dir="ltr" className="text-xs font-semibold text-foreground">
                    #{event.listing_ref}
                  </span>
                )}
                <span dir="ltr" className="text-[11px] text-muted-foreground">
                  {formatDateTime(event.created_at)}
                </span>
              </div>

              <p className="mt-1 truncate text-sm font-medium text-foreground">
                {event.listing_title ?? "—"}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>
                  {t("market.admin.log.actor")}: {event.actor_label ?? t("market.admin.log.system")}
                </span>
                {event.listing_status && (
                  <span>
                    {t("market.admin.status")}: {t(`market.dash.status.${event.listing_status}`)}
                  </span>
                )}
                {event.listing_city && <span>{event.listing_city}</span>}
                <span dir="ltr">IP: {event.ip_address ?? "—"}</span>
                <span className="max-w-[16rem] truncate">
                  {t("market.admin.log.device")}: {event.user_agent ?? "—"}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {ADMIN_LISTING_ACTIONS.filter((action) =>
                  staff.can(ADMIN_ACTION_PERM[action] as StaffPerm),
                ).map((action) => (
                  <Button
                    key={action}
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={() => openAction(event, action)}
                  >
                    {t(`market.admin.log.action.${action}`)}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          {t("market.admin.log.prev")}
        </Button>
        <span dir="ltr" className="text-xs text-muted-foreground">
          {page + 1}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={rows.length < PAGE_SIZE}
          onClick={() => setPage((p) => p + 1)}
        >
          {t("market.admin.log.next")}
        </Button>
      </div>

      <Dialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pending ? t(`market.admin.log.action.${pending.action}`) : ""}
            </DialogTitle>
            <DialogDescription>
              {brief.data
                ? `#${brief.data.ref_no ?? "—"} — ${brief.data.title ?? "—"}`
                : t("market.admin.log.loading")}
            </DialogDescription>
          </DialogHeader>

          {pending?.action === "extend" && (
            <div className="space-y-1">
              <Label htmlFor="log-days">{t("market.admin.log.days")}</Label>
              <select
                id="log-days"
                className={selectClass}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                {ADMIN_EXTEND_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="log-reason">{t("market.admin.log.reason")}</Label>
            <Textarea
              id="log-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              {t("market.admin.log.reasonHint")}
            </p>
          </div>

          <DialogFooter>
            <Button onClick={submit} disabled={busy}>
              {busy && <Loader2 className="me-1 size-4 animate-spin" aria-hidden />}
              {t("market.admin.log.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

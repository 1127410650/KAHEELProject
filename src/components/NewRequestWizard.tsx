import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, FileText, FolderKanban, Paperclip, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { REQUEST_KIND_LABELS_AR, REQUEST_KIND_LABELS_EN, type RequestKind } from "@/lib/permissions";
import { ACCEPT, isAllowedFile, isAllowedSize, uploadAttachments } from "@/lib/attachments";
import { buildRequestTitle } from "@/lib/request-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { formatMoney, pickName, todayInRiyadh } from "@/lib/format";
import { cn } from "@/lib/utils";

type WizardType = "general" | "project" | "custody" | "payment";

const KIND_OF_TYPE: Record<WizardType, RequestKind> = {
  general: "general",
  project: "project_service",
  custody: "custody_topup",
  payment: "payment",
};

interface ProjectOption {
  id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
}

interface Draft {
  title: string;
  project_id: string;
  service_type: string;
  movement: string;
  amount: string;
  beneficiary: string;
  authority: string;
  reason: string;
  details: string;
}

const EMPTY: Draft = {
  title: "",
  project_id: "",
  service_type: "",
  movement: "topup",
  amount: "",
  beneficiary: "",
  authority: "",
  reason: "",
  details: "",
};

/** Three short steps: pick a type, fill only its fields, review and send. */
export function NewRequestWizard({
  projects,
  canRequestCustody,
  canRequestPayment,
}: {
  projects: ProjectOption[];
  canRequestCustody: boolean;
  canRequestPayment: boolean;
}) {
  const { t, locale } = useI18n();
  const { session, role } = useSession();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const kindLabels = locale === "ar" ? REQUEST_KIND_LABELS_AR : REQUEST_KIND_LABELS_EN;

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [type, setType] = useState<WizardType>("general");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [files, setFiles] = useState<File[]>([]);

  const types = useMemo(() => {
    const list: { value: WizardType; icon: typeof FileText }[] = [
      { value: "general", icon: FileText },
      { value: "project", icon: FolderKanban },
    ];
    if (canRequestCustody) list.push({ value: "custody", icon: Wallet });
    if (canRequestPayment) list.push({ value: "payment", icon: Wallet });
    return list;
  }, [canRequestCustody, canRequestPayment]);

  const project = projects.find((p) => p.id === draft.project_id);
  const projectName = project ? pickName(locale, project.name_ar, project.name_en) : null;
  const kind = KIND_OF_TYPE[type];

  const movementLabel =
    draft.movement === "settlement"
      ? locale === "ar"
        ? "تسوية عهدة"
        : "Custody settlement"
      : locale === "ar"
        ? "إضافة رصيد عهدة"
        : "Custody top-up";

  const typeLabel = type === "custody" ? movementLabel : kindLabels[kind];

  const autoTitle = buildRequestTitle(
    {
      title: draft.title,
      kind,
      request_type: typeLabel,
      service_type: draft.service_type,
      notes_ar: draft.details,
      reason: draft.reason,
      beneficiary: draft.beneficiary,
      amount: draft.amount ? Number(draft.amount) : null,
      projectName,
    },
    t("requests.untitled"),
  );

  function reset() {
    setStep(1);
    setType("general");
    setDraft(EMPTY);
    setFiles([]);
    if (fileInput.current) fileInput.current.value = "";
  }

  const submit = useMutation({
    mutationFn: async () => {
      if (files.some((f) => !isAllowedFile(f))) throw new Error("FILE_TYPE");
      if (files.some((f) => !isAllowedSize(f))) throw new Error("FILE_SIZE");

      const needsProject = type === "project" || type === "payment";
      const { data, error } = await supabase.rpc("submit_request", {
        _kind: kind,
        _request_type: typeLabel,
        _title: autoTitle,
        _priority: "normal",
        _request_date: todayInRiyadh(),
        ...(needsProject && draft.project_id ? { _project_id: draft.project_id } : {}),
        ...(draft.amount ? { _amount: Number(draft.amount) } : {}),
        ...(draft.authority ? { _authority: draft.authority.trim() } : {}),
        ...(draft.beneficiary ? { _beneficiary: draft.beneficiary.trim() } : {}),
        ...(type === "project" && draft.service_type
          ? { _service_type: draft.service_type.trim() }
          : {}),
        ...(type === "custody" ? { _service_type: draft.movement } : {}),
        ...(draft.reason ? { _reason: draft.reason.trim() } : {}),
        ...(draft.details ? { _notes_ar: draft.details.trim() } : {}),
      });
      if (error) throw error;

      const requestId = data as string;
      if (files.length && requestId) {
        await uploadAttachments(files, {
          projectId: needsProject ? draft.project_id || null : null,
          requestId,
          entityType: "request",
          entityId: requestId,
          kind: "supervisor_doc",
          uploaderRole: role,
          userId: session?.user.id ?? null,
        });
      }
    },
    onSuccess: () => {
      toast.success(t("wizard.submitted"));
      setOpen(false);
      reset();
      void queryClient.invalidateQueries({ queryKey: ["portal"] });
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
    onError: (error: Error) => {
      const message = error.message ?? "";
      if (message.includes("PROJECT_REQUIRED")) toast.error(t("requests.projectRequired"));
      else if (message.includes("AMOUNT_REQUIRED")) toast.error(t("common.required"));
      else if (message.includes("DUPLICATE_FILE")) toast.error(t("attachments.duplicate"));
      else if (message.includes("FILE_TYPE")) toast.error(t("attachments.fileType"));
      else if (message.includes("FILE_SIZE")) toast.error(t("attachments.fileSize"));
      else if (message.includes("FORBIDDEN")) toast.error(t("common.notAllowed"));
      else toast.error(t("portal.submitFailed"));
    },
  });

  function validateStep2(): boolean {
    if ((type === "project" || type === "payment") && !draft.project_id) {
      toast.error(t("requests.projectRequired"));
      return false;
    }
    if ((type === "custody" || type === "payment") && !(Number(draft.amount) > 0)) {
      toast.error(t("common.required"));
      return false;
    }
    if (type === "general" && !draft.details.trim() && !draft.title.trim()) {
      toast.error(t("common.required"));
      return false;
    }
    return true;
  }

  const projectField = (
    <div className="space-y-2">
      <Label>{t("requests.project")} *</Label>
      <Select value={draft.project_id} onValueChange={(v) => setDraft({ ...draft, project_id: v })}>
        <SelectTrigger>
          <SelectValue placeholder={t("common.select")} />
        </SelectTrigger>
        <SelectContent>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <span className="num">{p.code}</span> {pickName(locale, p.name_ar, p.name_en)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const amountField = (
    <div className="space-y-2">
      <Label htmlFor="w_amount">{t("portal.amount")} *</Label>
      <Input
        id="w_amount"
        type="number"
        min="0"
        step="0.01"
        dir="ltr"
        className="num"
        value={draft.amount}
        onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
      />
    </div>
  );

  const filesField = (
    <div className="space-y-2">
      <Label htmlFor="w_files">{t("attachments.add")}</Label>
      <Input
        id="w_files"
        ref={fileInput}
        type="file"
        multiple
        accept={ACCEPT}
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
      />
      {files.length > 0 && (
        <p className="num flex items-center gap-1 text-xs text-muted-foreground">
          <Paperclip className="size-3" aria-hidden />
          {files.length}
        </p>
      )}
    </div>
  );

  const detailsField = (
    <div className="space-y-2">
      <Label htmlFor="w_details">{t("portal.details")}</Label>
      <Textarea
        id="w_details"
        rows={3}
        value={draft.details}
        onChange={(e) => setDraft({ ...draft, details: e.target.value })}
      />
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" aria-hidden />
          {t("portal.newRequest")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("portal.newRequest")}</DialogTitle>
        </DialogHeader>

        <ol className="mb-2 flex items-center gap-2 text-xs">
          {[1, 2, 3].map((n) => (
            <li
              key={n}
              className={cn(
                "flex-1 rounded-full border px-2 py-1.5 text-center font-medium",
                step === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : step > n
                    ? "border-success/40 bg-success/10 text-success"
                    : "border-border text-muted-foreground",
              )}
            >
              <span className="num">{n}</span> · {t(`wizard.step${n}`)}
            </li>
          ))}
        </ol>

        {step === 1 && (
          <div className="grid gap-3">
            {types.map(({ value, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setType(value);
                  setStep(2);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-4 text-start transition hover:bg-secondary/60",
                  type === value ? "border-primary" : "border-border",
                )}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-foreground">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    {t(`wizard.type${value.charAt(0).toUpperCase()}${value.slice(1)}`)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t(`wizard.type${value.charAt(0).toUpperCase()}${value.slice(1)}Hint`)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <form
            id="wizard-step2"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (validateStep2()) setStep(3);
            }}
          >
            {type === "general" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="w_title">{t("wizard.titleOptional")}</Label>
                  <Input
                    id="w_title"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </div>
                {detailsField}
                <div className="space-y-2">
                  <Label htmlFor="w_auth">
                    {t("requests.authority")}{" "}
                    <span className="text-xs text-muted-foreground">({t("common.optional")})</span>
                  </Label>
                  <Input
                    id="w_auth"
                    value={draft.authority}
                    onChange={(e) => setDraft({ ...draft, authority: e.target.value })}
                  />
                </div>
                {filesField}
              </>
            )}

            {type === "project" && (
              <>
                {projectField}
                <div className="space-y-2">
                  <Label htmlFor="w_service">{t("requests.serviceType")} *</Label>
                  <Input
                    id="w_service"
                    required
                    value={draft.service_type}
                    onChange={(e) => setDraft({ ...draft, service_type: e.target.value })}
                  />
                </div>
                {detailsField}
                {filesField}
              </>
            )}

            {type === "custody" && (
              <>
                <div className="space-y-2">
                  <Label>{t("wizard.movementType")} *</Label>
                  <Select
                    value={draft.movement}
                    onValueChange={(v) => setDraft({ ...draft, movement: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="topup">
                        {locale === "ar" ? "إضافة رصيد" : "Top-up"}
                      </SelectItem>
                      <SelectItem value="settlement">
                        {locale === "ar" ? "تسوية" : "Settlement"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {amountField}
                <div className="space-y-2">
                  <Label>
                    {t("requests.project")}{" "}
                    <span className="text-xs text-muted-foreground">({t("common.optional")})</span>
                  </Label>
                  <Select
                    value={draft.project_id}
                    onValueChange={(v) => setDraft({ ...draft, project_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("common.select")} />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="num">{p.code}</span>{" "}
                          {pickName(locale, p.name_ar, p.name_en)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="w_reason">{t("requests.reason")} *</Label>
                  <Input
                    id="w_reason"
                    required
                    value={draft.reason}
                    onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                  />
                </div>
                {filesField}
              </>
            )}

            {type === "payment" && (
              <>
                {projectField}
                {amountField}
                <div className="space-y-2">
                  <Label htmlFor="w_ben">{t("requests.beneficiary")} *</Label>
                  <Input
                    id="w_ben"
                    required
                    value={draft.beneficiary}
                    onChange={(e) => setDraft({ ...draft, beneficiary: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="w_reason2">{t("requests.reason")} *</Label>
                  <Input
                    id="w_reason2"
                    required
                    value={draft.reason}
                    onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                  />
                </div>
                {filesField}
              </>
            )}
          </form>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">{t("wizard.summary")}</h3>
            <dl className="surface divide-y divide-border p-4 text-sm">
              <SummaryRow label={t("requests.title")} value={autoTitle} />
              <SummaryRow label={t("requests.requestType")} value={typeLabel} />
              {projectName && <SummaryRow label={t("requests.project")} value={projectName} />}
              {draft.amount && (
                <SummaryRow
                  label={t("common.amount")}
                  value={formatMoney(Number(draft.amount), locale)}
                />
              )}
              {draft.beneficiary && (
                <SummaryRow label={t("requests.beneficiary")} value={draft.beneficiary} />
              )}
              {draft.service_type && (
                <SummaryRow label={t("requests.serviceType")} value={draft.service_type} />
              )}
              {draft.reason && <SummaryRow label={t("requests.reason")} value={draft.reason} />}
              {draft.details && <SummaryRow label={t("portal.details")} value={draft.details} />}
              {draft.authority && (
                <SummaryRow label={t("requests.authority")} value={draft.authority} />
              )}
              <SummaryRow label={t("requests.attachments")} value={String(files.length)} />
            </dl>
            <p className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
              {t("portal.myRequestsHint")}
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && (
            <Button type="button" variant="outline" className="gap-2" onClick={() => setStep(step - 1)}>
              <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
              {t("wizard.back")}
            </Button>
          )}
          {step === 2 && (
            <Button type="submit" form="wizard-step2">
              {t("wizard.next")}
            </Button>
          )}
          {step === 3 && (
            <Button
              type="button"
              className="gap-2"
              disabled={submit.isPending}
              onClick={() => submit.mutate()}
            >
              <Check className="size-4" aria-hidden />
              {t("wizard.submit")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end font-medium">{value}</dd>
    </div>
  );
}

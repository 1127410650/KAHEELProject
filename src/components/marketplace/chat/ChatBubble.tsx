import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  BadgeCheck,
  Check,
  CheckCheck,
  Clock,
  Copy,
  FileText,
  Landmark,
  MapPin,
  MoreHorizontal,
  Phone,
  Play,
  Trash2,
  User,
} from "lucide-react";

import { useI18n } from "@/i18n";
import { formatTime } from "@/lib/format";
import {
  chatErrorKey,
  deleteMessage,
  respondBankRequest,
  signedUrl,
  type ChatMessage,
} from "@/lib/mkt-chat";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Sent / delivered / read ticks, shown on the viewer's own bubbles only. */
function Receipt({ message }: { message: ChatMessage }) {
  const { t } = useI18n();
  if (message.failed) {
    return (
      <span className="flex items-center gap-1 text-destructive">
        <AlertCircle className="size-3.5" aria-hidden />
        {t("market.chat.receipt.failed")}
      </span>
    );
  }
  if (message.pending) {
    return <Clock className="size-3.5" aria-label={t("market.chat.receipt.sending")} />;
  }
  if (message.read_at) {
    return (
      <CheckCheck className="size-3.5 text-primary" aria-label={t("market.chat.receipt.read")} />
    );
  }
  if (message.delivered_at) {
    return <CheckCheck className="size-3.5" aria-label={t("market.chat.receipt.delivered")} />;
  }
  return <Check className="size-3.5" aria-label={t("market.chat.receipt.sent")} />;
}


/** Private attachments resolve to a short-lived signed link, never a public URL. */
function useSignedUrl(path: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    void signedUrl(path).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}

function str(payload: Record<string, unknown>, key: string): string | undefined {
  const v = payload[key];
  return typeof v === "string" ? v : undefined;
}

function num(payload: Record<string, unknown>, key: string): number | undefined {
  const v = payload[key];
  return typeof v === "number" ? v : undefined;
}

function AttachmentBody({ message }: { message: ChatMessage }) {
  const { t } = useI18n();
  const path = str(message.payload, "path");
  const url = useSignedUrl(path);
  const name = str(message.payload, "name") ?? "";

  if (message.kind === "image") {
    return url ? (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img
          src={url}
          alt={name || t("market.chat.image")}
          loading="lazy"
          className="max-h-64 w-full rounded-lg object-cover"
        />
      </a>
    ) : (
      <div className="h-40 w-56 animate-pulse rounded-lg bg-muted" />
    );
  }

  if (message.kind === "video") {
    return url ? (
      <video src={url} controls preload="metadata" className="max-h-64 w-full rounded-lg" />
    ) : (
      <div className="h-40 w-56 animate-pulse rounded-lg bg-muted" />
    );
  }

  if (message.kind === "audio") {
    const seconds = num(message.payload, "duration");
    return (
      <div className="flex items-center gap-2">
        <Play className="size-4 shrink-0" aria-hidden />
        {url ? (
          <audio src={url} controls preload="metadata" className="h-9 max-w-[220px]" />
        ) : (
          <span className="text-desc">…</span>
        )}
        {seconds ? (
          <span className="text-desc tabular-nums opacity-80" dir="ltr">
            {Math.floor(seconds / 60)}:{String(Math.round(seconds % 60)).padStart(2, "0")}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 underline-offset-2 hover:underline"
    >
      <FileText className="size-4 shrink-0" aria-hidden />
      <span className="line-clamp-2 break-all text-sm">{name || t("market.chat.document")}</span>
    </a>
  );
}

function LocationBody({ message }: { message: ChatMessage }) {
  const { t } = useI18n();
  const lat = num(message.payload, "lat");
  const lng = num(message.payload, "lng");
  const precision = str(message.payload, "precision");
  if (lat === undefined || lng === undefined) return null;
  return (
    <a
      href={`https://maps.google.com/?q=${lat},${lng}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 underline-offset-2 hover:underline"
    >
      <MapPin className="size-4 shrink-0" aria-hidden />
      <span className="text-sm">
        {precision === "approx" ? t("market.chat.location.approx") : t("market.chat.location.exact")}
      </span>
    </a>
  );
}

function ContactBody({ message }: { message: ChatMessage }) {
  const phone = str(message.payload, "phone");
  return (
    <div className="space-y-1 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <User className="size-4" aria-hidden />
        {str(message.payload, "name")}
      </p>
      {phone && (
        <a href={`tel:${phone}`} className="flex items-center gap-2" dir="ltr">
          <Phone className="size-4" aria-hidden />
          {phone}
        </a>
      )}
      {str(message.payload, "note") && (
        <p className="opacity-80">{str(message.payload, "note")}</p>
      )}
    </div>
  );
}

function BankShareBody({ message }: { message: ChatMessage }) {
  const { t } = useI18n();
  const iban = str(message.payload, "iban") ?? "";
  return (
    <div className="w-full max-w-xs space-y-2 rounded-lg border border-border bg-card p-3 text-card-foreground">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Landmark className="size-4" aria-hidden />
        {t("market.chat.bank.title")}
        <BadgeCheck className="size-4 text-primary" aria-hidden />
      </p>
      <dl className="space-y-1 text-desc">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t("market.chat.bank.bankName")}</dt>
          <dd>{str(message.payload, "bank_name")}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t("market.chat.bank.beneficiary")}</dt>
          <dd>{str(message.payload, "beneficiary_name")}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t("market.chat.bank.iban")}</dt>
          <dd className="font-mono" dir="ltr">
            {iban}
          </dd>
        </div>
      </dl>
      <Button
        size="sm"
        variant="secondary"
        className="w-full"
        onClick={() => {
          void navigator.clipboard.writeText(iban);
          toast.success(t("market.chat.bank.copied"));
        }}
      >
        <Copy className="size-4" aria-hidden />
        {t("market.chat.bank.copyIban")}
      </Button>
      <p className="text-desc leading-4 text-muted-foreground">
        {t("market.chat.bank.notice")}
      </p>
    </div>
  );
}

function BankRequestBody({
  message,
  onShare,
  onChanged,
}: {
  message: ChatMessage;
  onShare: (requestMessageId: string) => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const status = str(message.payload, "status") ?? "pending";

  async function respond(action: "cancel" | "decline") {
    try {
      await respondBankRequest(message.id, action);
      onChanged();
    } catch (error) {
      toast.error(t(chatErrorKey(error)));
    }
  }

  return (
    <div className="w-full max-w-xs space-y-2 rounded-lg border border-dashed border-border bg-card p-3 text-card-foreground">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Landmark className="size-4" aria-hidden />
        {t("market.chat.bank.request")}
      </p>
      <p className="text-desc text-muted-foreground">{t(`market.chat.bank.${status}`)}</p>
      {status === "pending" && (
        <div className="flex flex-wrap gap-2">
          {message.mine ? (
            <Button size="sm" variant="secondary" onClick={() => void respond("cancel")}>
              {t("market.chat.bank.cancel")}
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={() => onShare(message.id)}>
                {t("market.chat.bank.share")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void respond("decline")}>
                {t("market.chat.bank.decline")}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  message: ChatMessage;
  onShareBank: (requestMessageId: string) => void;
  onChanged: () => void;
  onRetry?: (message: ChatMessage) => void;
}

export function ChatBubble({ message, onShareBank, onChanged, onRetry }: Props) {
  const { t } = useI18n();
  const mine = message.mine;
  const card = message.kind === "bank_share" || message.kind === "bank_request";
  const optimistic = Boolean(message.pending || message.failed);

  async function remove(scope: "me" | "all") {
    try {
      await deleteMessage(message.id, scope);
      onChanged();
    } catch (error) {
      toast.error(t(chatErrorKey(error)));
    }
  }

  return (
    <li className={mine ? "flex flex-col items-end" : "flex flex-col items-start"}>
      <div className="flex max-w-[85%] items-start gap-1">
        {mine && !message.deleted_at && !optimistic && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>

              <button
                type="button"
                aria-label={t("market.chat.messageActions")}
                className="mt-1 text-muted-foreground"
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => void remove("me")}>
                <Trash2 className="size-4" aria-hidden />
                {t("market.chat.deleteForMe")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void remove("all")}>
                <Trash2 className="size-4" aria-hidden />
                {t("market.chat.deleteForAll")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div
          className={[
            card
              ? "w-full"
              : mine
                ? "rounded-2xl rounded-ee-sm bg-primary px-3 py-2 text-sm text-primary-foreground shadow-sm"
                : "rounded-2xl rounded-ss-sm bg-secondary px-3 py-2 text-sm text-secondary-foreground shadow-sm",
            message.pending ? "opacity-70" : "",
            message.failed ? "ring-1 ring-destructive" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {message.deleted_at ? (
            <span className="text-desc italic opacity-80">{t("market.chat.deleted")}</span>
          ) : message.kind === "text" ? (
            <p className="whitespace-pre-wrap break-words">{message.body}</p>
          ) : message.kind === "location" ? (
            <LocationBody message={message} />
          ) : message.kind === "contact" ? (
            <ContactBody message={message} />
          ) : message.kind === "bank_share" ? (
            <BankShareBody message={message} />
          ) : message.kind === "bank_request" ? (
            <BankRequestBody message={message} onShare={onShareBank} onChanged={onChanged} />
          ) : (
            <AttachmentBody message={message} />
          )}
        </div>
      </div>
      <span className="mt-1 flex items-center gap-1 px-1 text-desc text-muted-foreground">
        <time dateTime={message.created_at} dir="ltr" className="tabular-nums">
          {formatTime(message.created_at)}
        </time>
        {mine && !message.deleted_at ? <Receipt message={message} /> : null}
        {message.failed && onRetry ? (
          <button
            type="button"
            onClick={() => onRetry(message)}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            {t("market.chat.receipt.retry")}
          </button>
        ) : null}
      </span>
    </li>

  );
}

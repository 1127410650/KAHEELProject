import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Image as ImageIcon,
  Landmark,
  MapPin,
  Mic,
  Paperclip,
  Send,
  Square,
  User,
  Video,
} from "lucide-react";

import { useI18n } from "@/i18n";
import {
  CHAT_ACCEPT,
  CHAT_LIMITS,
  chatErrorKey,
  sendAttachment,
  sendContact,
  sendLocation,
  sendMessage,
} from "@/lib/mkt-chat";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  conversationId: string;
  disabled?: boolean;
  onSent: () => void;
  onBankShare: () => void;
  onBankRequest: () => void;
}

type Sheet = "location" | "contact" | null;

export function ChatComposer({
  conversationId,
  disabled = false,
  onSent,
  onBankShare,
  onBankRequest,
}: Props) {
  const { t } = useI18n();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const pickKind = useRef<"image" | "video" | "file">("image");

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => {
      const secs = (Date.now() - started.current) / 1000;
      setElapsed(secs);
      if (secs >= CHAT_LIMITS.audioSeconds) stopRecording();
    }, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  async function guard(run: () => Promise<unknown>) {
    setBusy(true);
    try {
      await run();
      onSent();
    } catch (error) {
      toast.error(t(chatErrorKey(error)));
    } finally {
      setBusy(false);
    }
  }

  function sendText() {
    const text = body.trim();
    if (!text) return;
    void guard(async () => {
      await sendMessage(conversationId, "text", text);
      setBody("");
    });
  }

  function pick(kind: "image" | "video" | "file") {
    pickKind.current = kind;
    if (fileInput.current) {
      fileInput.current.accept = CHAT_ACCEPT[kind];
      fileInput.current.value = "";
      fileInput.current.click();
    }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    void guard(() => sendAttachment(conversationId, pickKind.current, file));
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const seconds = (Date.now() - started.current) / 1000;
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        setRecording(false);
        setElapsed(0);
        if (seconds < 1) return;
        const ext = (rec.mimeType || "audio/webm").includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type });
        void guard(() =>
          sendAttachment(conversationId, "audio", file, { duration: Math.round(seconds) }),
        );
      };
      recorder.current = rec;
      started.current = Date.now();
      setRecording(true);
      rec.start();
    } catch {
      toast.error(t("market.chat.errors.micDenied"));
    }
  }

  function stopRecording() {
    recorder.current?.stop();
    recorder.current = null;
  }

  function shareLocation(precision: "exact" | "approx") {
    if (!navigator.geolocation) {
      toast.error(t("market.chat.location.denied"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSheet(null);
        void guard(() =>
          sendLocation(conversationId, pos.coords.latitude, pos.coords.longitude, precision),
        );
      },
      () => toast.error(t("market.chat.location.denied")),
      { enableHighAccuracy: precision === "exact", timeout: 10000 },
    );
  }

  if (recording) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
        <span className="inline-flex size-2.5 animate-pulse rounded-full bg-destructive" aria-hidden />
        <span className="text-sm tabular-nums" dir="ltr">
          {Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, "0")}
        </span>
        <span className="text-xs text-muted-foreground">{t("market.chat.voice.maxLength")}</span>
        <Button size="sm" className="ms-auto" onClick={stopRecording}>
          <Square className="size-4" aria-hidden />
          {t("market.chat.voice.stop")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileInput}
        type="file"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      <div className="flex items-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              disabled={disabled || busy}
              aria-label={t("market.chat.attach")}
            >
              <Paperclip className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top">
            <DropdownMenuItem onClick={() => pick("image")}>
              <ImageIcon className="size-4" aria-hidden />
              {t("market.chat.image")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => pick("video")}>
              <Video className="size-4" aria-hidden />
              {t("market.chat.video")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => pick("file")}>
              <Paperclip className="size-4" aria-hidden />
              {t("market.chat.document")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSheet("location")}>
              <MapPin className="size-4" aria-hidden />
              {t("market.chat.location.title")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSheet("contact")}>
              <User className="size-4" aria-hidden />
              {t("market.chat.contactCard.title")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onBankShare}>
              <Landmark className="size-4" aria-hidden />
              {t("market.chat.bank.share")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onBankRequest}>
              <Landmark className="size-4" aria-hidden />
              {t("market.chat.bank.request")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Textarea
          rows={1}
          value={body}
          disabled={disabled || busy}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendText();
            }
          }}
          placeholder={t("market.chat.placeholder")}
          className="min-h-10 max-h-32 flex-1 resize-none"
        />

        {body.trim() ? (
          <Button size="icon" onClick={sendText} disabled={disabled || busy} aria-label={t("market.chat.send")}>
            <Send className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button
            size="icon"
            variant="secondary"
            onClick={() => void startRecording()}
            disabled={disabled || busy}
            aria-label={t("market.chat.voice.record")}
          >
            <Mic className="size-4" aria-hidden />
          </Button>
        )}
      </div>

      <Dialog open={sheet === "location"} onOpenChange={(o) => !o && setSheet(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("market.chat.location.title")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Button onClick={() => shareLocation("exact")}>{t("market.chat.location.exact")}</Button>
            <Button variant="secondary" onClick={() => shareLocation("approx")}>
              {t("market.chat.location.approx")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={sheet === "contact"} onOpenChange={(o) => !o && setSheet(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("market.chat.contactCard.title")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const name = String(fd.get("name") ?? "").trim();
              const phone = String(fd.get("phone") ?? "").trim();
              if (!name || !phone) return;
              setSheet(null);
              void guard(() =>
                sendContact(conversationId, name, phone, String(fd.get("note") ?? "").trim()),
              );
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="contact-name">{t("market.chat.contactCard.name")}</Label>
              <Input id="contact-name" name="name" maxLength={80} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-phone">{t("market.chat.contactCard.phone")}</Label>
              <Input id="contact-phone" name="phone" dir="ltr" maxLength={20} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-note">{t("market.chat.contactCard.note")}</Label>
              <Input id="contact-note" name="note" maxLength={120} />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full">
                {t("market.chat.contactCard.share")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

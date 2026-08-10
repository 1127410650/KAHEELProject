/**
 * «العروض الحصرية» في لوحة مدير النظام.
 *
 * المدير يختار ما يُبرَز ويكتب نصّه ووجهته ومدّة سريانه. الوجهة مسار داخلي فقط
 * (قيد `CHECK` في قاعدة البيانات: يبدأ بـ `/`) فلا يمكن تحويل الزائر لمضيف
 * خارجي من هذه المساحة. المسودة والموقوف لا يظهران للزائر إطلاقًا.
 */
import { useMemo, useState } from "react";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import { SEASON_STATUS_LABEL, useAdminOffers, type SeasonStatus } from "@/lib/mkt-seasons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATUSES: SeasonStatus[] = ["draft", "active", "paused", "ended"];

export function ExclusiveOffersCard() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { data, isLoading, save, remove } = useAdminOffers();
  const rows = useMemo(() => data ?? [], [data]);

  const [slug, setSlug] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [subtitleAr, setSubtitleAr] = useState("");
  const [subtitleEn, setSubtitleEn] = useState("");
  const [badgeAr, setBadgeAr] = useState("حصري");
  const [badgeEn, setBadgeEn] = useState("Exclusive");
  const [clickUrl, setClickUrl] = useState("/search");
  const [priority, setPriority] = useState("0");
  const [endsAt, setEndsAt] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    const trimmed = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{3,40}$/.test(trimmed)) {
      toast.error(ar ? "المعرّف: حروف إنجليزية وأرقام وشرطة" : "Slug: latin letters, digits, dashes");
      return;
    }
    if (!clickUrl.startsWith("/")) {
      toast.error(ar ? "الوجهة مسار داخلي يبدأ بـ /" : "Destination must be an internal path");
      return;
    }
    setBusy(true);
    try {
      await save.mutateAsync({
        values: {
          slug: trimmed,
          title_ar: titleAr.trim(),
          title_en: titleEn.trim(),
          subtitle_ar: subtitleAr.trim(),
          subtitle_en: subtitleEn.trim(),
          badge_ar: badgeAr.trim(),
          badge_en: badgeEn.trim(),
          click_url: clickUrl.trim(),
          priority: Number(priority) || 0,
          status: "draft",
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        },
      });
      toast.success(ar ? "أُضيف العرض كمسودة" : "Offer added as a draft");
      setSlug("");
      setTitleAr("");
      setTitleEn("");
      setSubtitleAr("");
      setSubtitleEn("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ERROR");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-4">
        <header className="flex flex-wrap items-center gap-2">
          <span className="grid size-9 place-items-center rounded-[var(--r-card)] bg-primary/10 text-primary">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-black">{ar ? "العروض الحصرية" : "Exclusive offers"}</p>
            <p className="text-desc text-muted-foreground">
              {ar
                ? "مساحة مميزة في الرئيسية بخلفية موسمية خلفها"
                : "A featured home area with a seasonal backdrop behind it"}
            </p>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="offer-slug">{ar ? "المعرّف" : "Slug"}</Label>
            <Input id="offer-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="eid-deals" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="offer-priority">{ar ? "الأولوية" : "Priority"}</Label>
            <Input
              id="offer-priority"
              value={priority}
              inputMode="numeric"
              onChange={(e) => setPriority(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="offer-title-ar">{ar ? "العنوان بالعربية" : "Arabic title"}</Label>
            <Input id="offer-title-ar" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="offer-title-en">{ar ? "العنوان بالإنجليزية" : "English title"}</Label>
            <Input id="offer-title-en" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="offer-sub-ar">{ar ? "الوصف بالعربية" : "Arabic subtitle"}</Label>
            <Input id="offer-sub-ar" value={subtitleAr} onChange={(e) => setSubtitleAr(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="offer-sub-en">{ar ? "الوصف بالإنجليزية" : "English subtitle"}</Label>
            <Input id="offer-sub-en" value={subtitleEn} onChange={(e) => setSubtitleEn(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="offer-badge-ar">{ar ? "الشارة بالعربية" : "Arabic badge"}</Label>
            <Input id="offer-badge-ar" value={badgeAr} onChange={(e) => setBadgeAr(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="offer-badge-en">{ar ? "الشارة بالإنجليزية" : "English badge"}</Label>
            <Input id="offer-badge-en" value={badgeEn} onChange={(e) => setBadgeEn(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="offer-url">{ar ? "الوجهة" : "Destination"}</Label>
            <Input id="offer-url" value={clickUrl} onChange={(e) => setClickUrl(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="offer-end">{ar ? "نهاية السريان" : "Ends at"}</Label>
            <Input
              id="offer-end"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
        </div>

        <Button type="button" onClick={() => void create()} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {ar ? "إضافة عرض كمسودة" : "Add offer as draft"}
        </Button>

        <div className="space-y-2">
          <p className="text-desc font-bold">
            {ar ? "العروض" : "Offers"}
            {isLoading ? " …" : ` (${rows.length})`}
          </p>
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-2 rounded-[var(--r-card)] border border-border/70 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {(ar ? row.title_ar : row.title_en) || row.slug}
                </p>
                <p className="text-desc text-muted-foreground">
                  {SEASON_STATUS_LABEL[row.status][ar ? 0 : 1]} · {row.click_url} ·{" "}
                  {formatDateTime(row.starts_at)}
                  {row.ends_at ? ` → ${formatDateTime(row.ends_at)}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-[var(--sp-2)]">
                {STATUSES.map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={row.status === value ? "default" : "outline"}
                    onClick={() =>
                      void save.mutateAsync({ id: row.id, values: { status: value } }).catch(() =>
                        toast.error(ar ? "تعذّر التحديث" : "Update failed"),
                      )
                    }
                  >
                    {SEASON_STATUS_LABEL[value][ar ? 0 : 1]}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={ar ? "حذف" : "Delete"}
                  onClick={() =>
                    void remove.mutateAsync(row.id).catch(() =>
                      toast.error(ar ? "تعذّر الحذف" : "Delete failed"),
                    )
                  }
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

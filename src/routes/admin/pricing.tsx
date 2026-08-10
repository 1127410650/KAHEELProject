/**
 * /admin/pricing — الأسعار والقيم التشغيلية في مكان واحد.
 *
 * لا قيمة تشغيلية مكتوبة في الكود: حزم شحن الرصيد وأسعارها، وأسعار التمييز
 * ومدده بالنقاط، وسعر صرف الدولار مقابل الليرة — كلها تُقرأ من القاعدة وتُعدَّل
 * من هنا. الكتابة تمرّ بدوال SECURITY DEFINER تفحص صفة مدير المنصة وتسجّل السبب،
 * وإدارة رصيد المحفظة اليدوية (إضافة/خصم بسبب مسجّل) في شاشة رصيد الإعلانات.
 */
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Save, Trash2, Wallet } from "lucide-react";

import { AdminShell } from "@/components/marketplace/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { fetchAqarUsdRate } from "@/lib/mkt-aqar";
import { adminErrorMessage, loadPlatformSettings, savePlatformSetting } from "@/lib/mkt-platform";

export const Route = createFileRoute("/admin/pricing")({
  head: () => ({
    meta: [
      { title: "الأسعار والقيم التشغيلية — كَحيل" },
      { name: "description", content: "حزم شحن الرصيد وأسعار التمييز ومدده وسعر الصرف — كلها من اللوحة." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "الأسعار والقيم التشغيلية — كَحيل" },
      { property: "og:description", content: "تعديل الحزم والأسعار والمدد وسعر الصرف بلا تعديل كود." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PricingPage,
});

interface Pack {
  credits: number;
  amount: number;
}

function PricingPage() {
  const settings = useQuery({ queryKey: ["mkt", "platform-settings"], queryFn: loadPlatformSettings });
  const rate = useQuery({ queryKey: ["mkt", "usd-rate"], queryFn: fetchAqarUsdRate });

  const gateway = settings.data?.find((row) => row.key === "ad_credit.card_gateway");
  const prices = settings.data?.find((row) => row.key === "promotions.point_prices");

  const [packs, setPacks] = useState<Pack[]>([]);
  const [durations, setDurations] = useState<{ days: string; points: string }[]>([]);
  const [usd, setUsd] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const raw = (gateway?.value?.["packs"] ?? []) as Pack[];
    setPacks(raw.map((item) => ({ credits: Number(item.credits), amount: Number(item.amount) })));
  }, [gateway?.updated_at]);

  useEffect(() => {
    const raw = (prices?.value ?? {}) as Record<string, number>;
    setDurations(
      Object.entries(raw)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([days, points]) => ({ days, points: String(points) })),
    );
  }, [prices?.updated_at]);

  useEffect(() => {
    if (rate.data != null) setUsd(String(rate.data));
  }, [rate.data]);

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      void settings.refetch();
      void rate.refetch();
    } catch (error) {
      toast.error(adminErrorMessage(error, "تعذّر الحفظ — راجع القيم وأعد المحاولة."));
    } finally {
      setBusy(false);
    }
  };

  const savePacks = () =>
    void run(async () => {
      const clean = packs
        .filter((pack) => pack.credits > 0 && pack.amount > 0)
        .map((pack) => ({ credits: Math.round(pack.credits), amount: Math.round(pack.amount) }));
      if (clean.length === 0) throw new Error("قيم غير صالحة");
      await savePlatformSetting(
        "ad_credit.card_gateway",
        { ...(gateway?.value ?? {}), packs: clean },
        "تعديل حزم شحن الرصيد من لوحة الأسعار",
      );
    }, "حُدّثت حزم الشحن.");

  const savePrices = () =>
    void run(async () => {
      const map: Record<string, number> = {};
      for (const row of durations) {
        const days = Math.round(Number(row.days));
        const points = Math.round(Number(row.points));
        if (days > 0 && points > 0) map[String(days)] = points;
      }
      if (Object.keys(map).length === 0) throw new Error("قيم غير صالحة");
      await savePlatformSetting("promotions.point_prices", map, "تعديل أسعار التمييز ومدده من لوحة الأسعار");
    }, "حُدّثت أسعار التمييز ومدده.");

  const saveRate = () =>
    void run(async () => {
      const value = Number(usd);
      if (!(value > 0)) throw new Error("قيمة غير صالحة");
      const { error } = await supabase.rpc("mkt_admin_set_usd_rate", {
        _rate: value,
        _reason: "تحديث سعر الصرف من لوحة الأسعار",
      });
      if (error) throw error;
    }, "اعتُمد سعر الصرف الجديد.");

  if (settings.isPending) {
    return (
      <AdminShell title="الأسعار والقيم التشغيلية">
        <div className="space-y-3">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-32 w-full rounded-[var(--r-card)]" />
          ))}
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="الأسعار والقيم التشغيلية"
      actions={
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link to="/admin/ad-credit">
            <Wallet className="size-4" aria-hidden />
            أرصدة المحافظ
          </Link>
        </Button>
      }
    >
      <p className="mb-4 rounded-[var(--r-card)] border border-primary/25 bg-primary/8 p-3 text-desc text-foreground">
        كل قيمة هنا تُقرأ من القاعدة وقت التنفيذ، فلا شيء مكتوب في الكود. إضافة أو خصم رصيد يدوي بسبب
        مسجّل يجري من شاشة «أرصدة المحافظ».
      </p>

      <section aria-labelledby="packs" className="mb-6 rounded-[var(--r-card)] border border-border bg-card p-3">
        <h2 id="packs" className="mb-2 text-section font-extrabold text-foreground">
          حزم شحن الرصيد (SAR)
        </h2>
        <ul className="space-y-2">
          {packs.map((pack, index) => (
            <li key={index} className="flex items-end gap-2">
              <label className="flex-1 text-desc font-bold text-foreground">
                النقاط
                <Input
                  className="num mt-1"
                  type="number"
                  min={1}
                  value={pack.credits}
                  onChange={(event) =>
                    setPacks((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, credits: Number(event.target.value) } : row)),
                    )
                  }
                />
              </label>
              <label className="flex-1 text-desc font-bold text-foreground">
                السعر
                <Input
                  className="num mt-1"
                  type="number"
                  min={1}
                  value={pack.amount}
                  onChange={(event) =>
                    setPacks((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, amount: Number(event.target.value) } : row)),
                    )
                  }
                />
              </label>
              <Button
                size="icon"
                variant="outline"
                aria-label="حذف الحزمة"
                onClick={() => setPacks((prev) => prev.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPacks((prev) => [...prev, { credits: 100, amount: 100 }])}>
            <Plus className="size-4" aria-hidden /> حزمة
          </Button>
          <Button size="sm" className="gap-1.5" disabled={busy} onClick={savePacks}>
            <Save className="size-4" aria-hidden /> حفظ الحزم
          </Button>
        </div>
      </section>

      <section aria-labelledby="promos" className="mb-6 rounded-[var(--r-card)] border border-border bg-card p-3">
        <h2 id="promos" className="mb-2 text-section font-extrabold text-foreground">
          أسعار التمييز ومدده (نقاط لكل عدد أيام)
        </h2>
        <ul className="space-y-2">
          {durations.map((row, index) => (
            <li key={index} className="flex items-end gap-2">
              <label className="flex-1 text-desc font-bold text-foreground">
                المدة (أيام)
                <Input
                  className="num mt-1"
                  type="number"
                  min={1}
                  value={row.days}
                  onChange={(event) =>
                    setDurations((prev) => prev.map((item, i) => (i === index ? { ...item, days: event.target.value } : item)))
                  }
                />
              </label>
              <label className="flex-1 text-desc font-bold text-foreground">
                النقاط
                <Input
                  className="num mt-1"
                  type="number"
                  min={1}
                  value={row.points}
                  onChange={(event) =>
                    setDurations((prev) => prev.map((item, i) => (i === index ? { ...item, points: event.target.value } : item)))
                  }
                />
              </label>
              <Button
                size="icon"
                variant="outline"
                aria-label="حذف المدة"
                onClick={() => setDurations((prev) => prev.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setDurations((prev) => [...prev, { days: "1", points: "10" }])}
          >
            <Plus className="size-4" aria-hidden /> مدة
          </Button>
          <Button size="sm" className="gap-1.5" disabled={busy} onClick={savePrices}>
            <Save className="size-4" aria-hidden /> حفظ الأسعار
          </Button>
        </div>
      </section>

      <section aria-labelledby="fx" className="rounded-[var(--r-card)] border border-border bg-card p-3">
        <h2 id="fx" className="mb-2 text-section font-extrabold text-foreground">
          سعر الصرف (دولار → ليرة سورية)
        </h2>
        <div className="flex items-end gap-2">
          <label className="flex-1 text-desc font-bold text-foreground">
            السعر المعتمد
            <Input className="num mt-1" type="number" min={1} value={usd} onChange={(event) => setUsd(event.target.value)} />
          </label>
          <Button size="sm" className="gap-1.5" disabled={busy} onClick={saveRate}>
            <Save className="size-4" aria-hidden /> اعتماد
          </Button>
        </div>
        <p className="mt-2 text-desc text-muted-foreground">
          الاعتماد يُلغي السعر السابق ويحفظ سجلًا جديدًا — لا يُعدّل أي سجل قديم.
        </p>
      </section>
    </AdminShell>
  );
}

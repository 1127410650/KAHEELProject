/**
 * صفحة معاينة داخلية للشخصيتين — «كَحيل» و«الزعيم كَحيلان».
 *
 * الغرض: يرى صاحب المنصة كل الوضعيات وكل الحركات وكل النصوص في مكان واحد
 * قبل اعتماد الشكل النهائي. لا تكتب هذه الصفحة أي بيانات ولا تنشر شيئًا؛
 * تبديل نسخة الأصول محفوظ في متصفح المسؤول فقط.
 *
 * استبدال الرسم النهائي يبقى سطرًا واحدًا في `src/lib/mascot-assets.ts`.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RotateCcw, Smile } from "lucide-react";

import { AdminShell } from "@/components/marketplace/AdminShell";
import {
  Mascot,
  MascotDuo,
  MASCOT_POSES,
  type MascotName,
  type MascotPose,
} from "@/components/marketplace/campaign/Mascot";
import { MASCOT_PERSONA, MASCOT_KINDS, PopupMascot } from "@/components/marketplace/campaign/PopupMascot";
import {
  MASCOT_ASSETS,
  MASCOT_VARIANTS,
  activeMascotVariant,
  setMascotVariant,
  type MascotVariant,
} from "@/lib/mascot-assets";
import { MASCOT_TIMING, DROP_ANIMATION_MS } from "@/lib/mascot-tap";
import {
  bossCopyAt,
  bossCopyCount,
  entranceCopyAt,
  entranceCopyCount,
  popupCopyAt,
  popupCopyCount,
  rapidTapCopyAt,
  rapidTapCopyCount,
} from "@/lib/takeover-copy";
import { useI18n } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/mascots")({
  head: () => ({
    meta: [
      { title: "معاينة الشخصيات — كَحيل" },
      {
        name: "description",
        content: "معاينة داخلية لوضعيات وحركات ونصوص شخصيتَي كَحيل والزعيم كَحيلان.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "معاينة الشخصيات — كَحيل" },
      {
        property: "og:description",
        content: "كل الوضعيات والحركات والنصوص في مكان واحد للمراجعة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MascotsPreviewPage,
});

type Demo = "drop" | "rapid" | "entrance";

const DEMOS: { id: Demo; ar: string; en: string; ms: number }[] = [
  { id: "drop", ar: "السقوط عند اللمس (طب طب)", en: "Tap drop (bounce)", ms: DROP_ANIMATION_MS },
  { id: "rapid", ar: "مزحة الكبس السريع", en: "Rapid-tap joke", ms: DROP_ANIMATION_MS },
  { id: "entrance", ar: "دخول قسم «الناس»", en: "People-section entrance", ms: 1_100 },
];

function MascotsPreviewPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [variant, setVariant] = useState<MascotVariant>(() => activeMascotVariant());
  const [demo, setDemo] = useState<{ id: Demo; run: number } | null>(null);

  const applyVariant = (next: MascotVariant) => {
    setVariant(next);
    setMascotVariant(next);
  };

  const playDemo = (id: Demo) => {
    setDemo((prev) => ({ id, run: (prev?.run ?? 0) + 1 }));
  };

  return (
    <AdminShell title={ar ? "معاينة الشخصيات" : "Mascot preview"}>
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Smile className="size-4 text-primary" aria-hidden />
              <h2 className="text-sm font-semibold">
                {ar ? "نسخة الأصول المعروضة" : "Displayed asset set"}
              </h2>
              <Badge variant="secondary">
                {MASCOT_ASSETS[variant].kaheel.note[ar ? "ar" : "en"]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {ar
                ? "التبديل هنا يخصّ جهازك فقط لمعاينة الشكل. الرسم النهائي يُستبدل بسطر واحد في src/lib/mascot-assets.ts."
                : "Switching here affects this device only. Swapping the final art is one line in src/lib/mascot-assets.ts."}
            </p>
            <div className="flex flex-wrap gap-2">
              {MASCOT_VARIANTS.map((item) => (
                <Button
                  key={item}
                  size="sm"
                  variant={item === variant ? "default" : "outline"}
                  onClick={() => applyVariant(item)}
                >
                  {item === "final"
                    ? ar
                      ? "الأصول المعتمدة"
                      : "Approved assets"
                    : ar
                      ? "أشكال مؤقتة (SVG)"
                      : "Temporary SVG"}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {(["kaheel", "kaheelan"] as MascotName[]).map((name) => (
          <Card key={name}>
            <CardContent className="space-y-3 p-4">
              <h2 className="text-sm font-semibold">
                {name === "kaheel"
                  ? ar
                    ? "كَحيل — الرسمي المؤدب"
                    : "Kaheel — the polite official"
                  : ar
                    ? "الزعيم كَحيلان — المشاكس"
                    : "Boss Kaheelan — the mischievous one"}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {(MASCOT_POSES[name] as MascotPose[]).map((pose) => (
                  <div
                    key={pose}
                    className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 p-2"
                  >
                    <div className="flex h-28 items-end justify-center">
                      <Mascot
                        name={name}
                        pose={pose}
                        lang={ar ? "ar" : "en"}
                        variant={variant}
                        className="h-28 w-auto"
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground">{pose}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">{ar ? "الحركات" : "Animations"}</h2>
            <div className="flex flex-wrap gap-2">
              {DEMOS.map((item) => (
                <Button key={item.id} size="sm" variant="outline" onClick={() => playDemo(item.id)}>
                  <RotateCcw className="me-1 size-3.5" aria-hidden />
                  {ar ? item.ar : item.en}
                </Button>
              ))}
            </div>
            <div className="relative flex h-56 items-end justify-center overflow-hidden rounded-lg border bg-muted/30">
              {demo ? (
                <div
                  key={`${demo.id}-${demo.run}`}
                  className={
                    demo.id === "entrance"
                      ? "animate-[mascot-enter-start_1.1s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none"
                      : "animate-[mascot-drop_1.05s_cubic-bezier(0.3,1.2,0.4,1)_both] motion-reduce:animate-none"
                  }
                >
                  <Mascot
                    name={demo.id === "drop" || demo.id === "rapid" || demo.id === "entrance" ? "kaheelan" : "kaheelan"}
                    pose={demo.id === "entrance" ? "wave" : "idle"}
                    lang={ar ? "ar" : "en"}
                    variant={variant}
                    animated={false}
                    className="h-48 w-auto animate-[mascot-drop-wobble_1.05s_ease-out_both] motion-reduce:animate-none"
                  />
                </div>
              ) : (
                <p className="self-center text-xs text-muted-foreground">
                  {ar ? "اختر حركة لتشغيلها" : "Pick an animation to play"}
                </p>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {ar
                ? `الساقط دائمًا الزعيم كَحيلان — مدة السقوط ${DROP_ANIMATION_MS}ms، فاصل بين السقطات ${MASCOT_TIMING.tapCooldownMs}ms.`
                : `The falling one is always Boss Kaheelan — drop ${DROP_ANIMATION_MS}ms, cooldown ${MASCOT_TIMING.tapCooldownMs}ms.`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">
              {ar ? "مشهد التعارف (الشخصيتان معًا)" : "Duo introduction scene"}
            </h2>
            <div className="flex h-44 items-end justify-center rounded-lg border bg-muted/30">
              <MascotDuo lang={ar ? "ar" : "en"} variant={variant} className="h-40" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">
              {ar ? "مشاهد النوافذ الترويجية" : "Popup scenes"}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {MASCOT_KINDS.map((kind) => (
                <div
                  key={kind}
                  className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 p-2"
                >
                  <div className="flex h-28 items-end justify-center">
                    <PopupMascot kind={kind} lang={ar ? "ar" : "en"} className="h-28 w-auto" />
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {kind} · {MASCOT_PERSONA[kind]}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <CopyList
          title={ar ? "نصوص عامة (كَحيل والزعيم)" : "General copy"}
          count={popupCopyCount(ar)}
          at={(i) => popupCopyAt(ar, i)}
        />
        <CopyList
          title={ar ? "نصوص الزعيم كَحيلان" : "Boss Kaheelan copy"}
          count={bossCopyCount(ar)}
          at={(i) => bossCopyAt(ar, i)}
        />
        <CopyList
          title={ar ? "نصوص الكبس السريع" : "Rapid-tap copy"}
          count={rapidTapCopyCount(ar)}
          at={(i) => rapidTapCopyAt(ar, i)}
        />
        <CopyList
          title={ar ? "نصوص دخول قسم «الناس»" : "People-entrance copy"}
          count={entranceCopyCount(ar)}
          at={(i) => entranceCopyAt(ar, i)}
        />
      </div>
    </AdminShell>
  );
}

function CopyList({
  title,
  count,
  at,
}: {
  title: string;
  count: number;
  at: (index: number) => { title: string; subtitle: string; mascot: string };
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          <Badge variant="secondary">{count}</Badge>
        </div>
        <ul className="space-y-2">
          {Array.from({ length: count }, (_, index) => {
            const copy = at(index);
            return (
              <li key={index} className="rounded-lg border bg-muted/20 p-2">
                <p className="text-xs font-semibold">{copy.title}</p>
                <p className="text-xs text-muted-foreground">{copy.subtitle}</p>
                <p className="mt-1 text-[11px] text-muted-foreground/80">{copy.mascot}</p>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

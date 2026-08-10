/**
 * إدارة حضور الشخصيتين — من `/admin/appearance`:
 * • تشغيل/إيقاف النظام، الفاصل الزمني بالثواني، ومدة البقاء على الشاشة.
 * • إضافة/تعديل/إظهار/إخفاء العبارات لكل شخصية (بلا حذف نهائي).
 */
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import type { MascotName } from "@/lib/mascot-assets";
import {
  savePresenceSettings,
  useMascotPhrases,
  useMascotPresenceSettings,
  type MascotPhrase,
  type MascotPresenceSettings,
} from "@/lib/mascot-presence";

const NAMES: Record<MascotName, string> = { kaheel: "كَحيل", kaheelan: "الزعيم كَحيلان" };

export function MascotPresenceCard() {
  const client = useQueryClient();
  const settings = useMascotPresenceSettings();
  const phrases = useMascotPhrases(true);
  const [draft, setDraft] = useState<MascotPresenceSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [newText, setNewText] = useState<Record<MascotName, string>>({ kaheel: "", kaheelan: "" });

  useEffect(() => setDraft(settings), [settings]);

  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["mkt", "mascot-phrases"] });
    void client.invalidateQueries({ queryKey: ["mkt", "mascot-presence-settings"] });
  };

  async function save() {
    setSaving(true);
    try {
      await savePresenceSettings(draft);
      refresh();
      toast.success("تم حفظ إعدادات الظهور");
    } catch {
      toast.error("تعذّر الحفظ — تحقّق من صلاحيتك كمدير");
    } finally {
      setSaving(false);
    }
  }

  async function addPhrase(character: MascotName) {
    const text = newText[character].trim();
    if (text.length < 3) return;
    const { error } = await supabase.from("mkt_mascot_phrases").insert({ character, text_ar: text });
    if (error) {
      toast.error("تعذّرت الإضافة");
      return;
    }
    setNewText((prev) => ({ ...prev, [character]: "" }));
    refresh();
    toast.success("أُضيفت العبارة");
  }

  async function togglePhrase(row: MascotPhrase) {
    const { error } = await supabase
      .from("mkt_mascot_phrases")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (error) {
      toast.error("تعذّر التحديث");
      return;
    }
    refresh();
  }

  async function editPhrase(row: MascotPhrase) {
    const next = window.prompt("نص العبارة", row.text_ar)?.trim();
    if (!next || next === row.text_ar) return;
    const { error } = await supabase
      .from("mkt_mascot_phrases")
      .update({ text_ar: next })
      .eq("id", row.id);
    if (error) {
      toast.error("تعذّر التحديث");
      return;
    }
    refresh();
    toast.success("تم التعديل");
  }

  return (
    <section
      aria-labelledby="mascot-presence"
      className="rounded-[var(--r-card)] border border-border bg-card p-[var(--sp-4)]"
    >
      <h2 id="mascot-presence" className="text-section font-extrabold text-foreground">
        حضور الشخصيتين
      </h2>
      <p className="mt-1 text-desc text-muted-foreground">
        تظهر إحدى الشخصيتين كل فترة بعبارة قصيرة، بمدخل وموضع مختلفين في كل مرة، بلا حجب أي زر.
      </p>

      <div className="mt-[var(--sp-4)] grid gap-[var(--sp-3)] sm:grid-cols-3">
        <label className="flex items-center justify-between gap-2 rounded-[var(--r-control)] border border-border p-3">
          <span className="text-desc text-foreground">مُفعّل</span>
          <Switch
            checked={draft.enabled}
            onCheckedChange={(value) => setDraft((prev) => ({ ...prev, enabled: value }))}
          />
        </label>
        <div>
          <Label htmlFor="mascot-interval" className="text-desc">
            الفاصل بين ظهورين (ثانية)
          </Label>
          <Input
            id="mascot-interval"
            type="number"
            min={8}
            max={3600}
            className="mt-1 h-11"
            value={draft.intervalSeconds}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, intervalSeconds: Number(event.target.value) }))
            }
          />
        </div>
        <div>
          <Label htmlFor="mascot-visible" className="text-desc">
            مدة البقاء (ثانية)
          </Label>
          <Input
            id="mascot-visible"
            type="number"
            min={3}
            max={20}
            className="mt-1 h-11"
            value={draft.visibleSeconds}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, visibleSeconds: Number(event.target.value) }))
            }
          />
        </div>
      </div>

      <Button type="button" className="mt-[var(--sp-3)] h-11" onClick={() => void save()} disabled={saving}>
        {saving ? <Loader2 className="me-1 size-4 animate-spin" aria-hidden /> : null}
        حفظ الإعدادات
      </Button>

      <div className="mt-[var(--sp-5)] grid gap-[var(--sp-4)] lg:grid-cols-2">
        {(Object.keys(NAMES) as MascotName[]).map((character) => {
          const rows = (phrases.data ?? []).filter((row) => row.character === character);
          return (
            <div key={character} className="rounded-[var(--r-card)] border border-border p-[var(--sp-3)]">
              <h3 className="text-desc font-extrabold text-foreground">
                عبارات {NAMES[character]}{" "}
                <span className="text-muted-foreground">({rows.length})</span>
              </h3>
              <ul className="mt-2 space-y-2">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-start gap-2 rounded-[var(--r-control)] bg-muted/40 p-2">
                    <p
                      className={`min-w-0 flex-1 text-desc leading-[1.6] ${
                        row.is_active ? "text-foreground" : "text-muted-foreground line-through"
                      }`}
                    >
                      {row.text_ar}
                    </p>
                    <button
                      type="button"
                      className="min-h-11 px-2 text-nav font-bold text-primary"
                      onClick={() => void editPhrase(row)}
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      className="min-h-11 px-2 text-nav text-muted-foreground"
                      onClick={() => void togglePhrase(row)}
                    >
                      {row.is_active ? "إخفاء" : "إظهار"}
                    </button>
                  </li>
                ))}
                {rows.length === 0 ? (
                  <li className="text-desc text-muted-foreground">لا عبارات بعد.</li>
                ) : null}
              </ul>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  className="h-11"
                  placeholder="عبارة قصيرة…"
                  value={newText[character]}
                  onChange={(event) =>
                    setNewText((prev) => ({ ...prev, [character]: event.target.value }))
                  }
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11"
                  onClick={() => void addPhrase(character)}
                >
                  <Plus className="size-4" aria-hidden />
                  إضافة
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default MascotPresenceCard;

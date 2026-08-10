/**
 * مفضلة كَحيل عقار — تخزين محلي في المتصفح، مع قوائم مخصصة.
 *
 * جدول `mkt_favorites` مرتبط بإعلانات السوق العام (مفتاح أجنبي على
 * `mkt_listings`)، فلا يقبل معرّفات الإعلانات العقارية. حتى تُبنى المفضلة
 * الخادمية للقسم، القلب والقوائم يعملان محليًا لكل جهاز — بلا كتابة في القاعدة.
 */

import { useCallback, useEffect, useState } from "react";

const KEY = "aqar.favorites.v1";
const LISTS_KEY = "aqar.favorites.lists.v1";

/** القائمة الافتراضية التي يذهب إليها القلب حين لا يختار المستخدم قائمة. */
export const AQAR_DEFAULT_LIST = "المحفوظات";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function write(ids: string[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* التخزين ممتلئ أو محجوب — نتجاهل بصمت بلا تعطيل الواجهة. */
  }
  window.dispatchEvent(new Event("aqar-favorites"));
}

/** القوائم المخصصة: اسم القائمة ← معرّفات العقارات فيها. */
export type AqarFavoriteLists = Record<string, string[]>;

function readLists(): AqarFavoriteLists {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LISTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: AqarFavoriteLists = {};
    for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue;
      out[name] = value.filter((id): id is string => typeof id === "string");
    }
    return out;
  } catch {
    return {};
  }
}

function writeLists(lists: AqarFavoriteLists): void {
  try {
    window.localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
  } catch {
    /* التخزين ممتلئ أو محجوب — القوائم تبقى كما كانت. */
  }
  window.dispatchEvent(new Event("aqar-favorites"));
}

/** القراءة تحدث بعد الترطيب فقط، فلا يختلف HTML الخادم عن العميل. */
export function useAqarFavorites() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setIds(read());
    sync();
    window.addEventListener("aqar-favorites", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("aqar-favorites", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const current = read();
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    write(next);
    // إزالة العقار من كل القوائم عند إزالته من المفضلة، فلا تبقى قائمة تشير لعقار غير محفوظ.
    if (!next.includes(id)) {
      const lists = readLists();
      let changed = false;
      for (const [name, list] of Object.entries(lists)) {
        if (list.includes(id)) {
          lists[name] = list.filter((item) => item !== id);
          changed = true;
        }
      }
      if (changed) writeLists(lists);
    }
  }, []);

  return { ids, toggle, has: (id: string) => ids.includes(id) };
}

/** القوائم المخصصة: إنشاء، حذف، وإضافة/إزالة عقار من قائمة. */
export function useAqarFavoriteLists() {
  const [lists, setLists] = useState<AqarFavoriteLists>({});

  useEffect(() => {
    const sync = () => setLists(readLists());
    sync();
    window.addEventListener("aqar-favorites", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("aqar-favorites", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const createList = useCallback((rawName: string) => {
    const name = rawName.trim().slice(0, 40);
    if (!name) return;
    const current = readLists();
    if (current[name]) return;
    writeLists({ ...current, [name]: [] });
  }, []);

  const removeList = useCallback((name: string) => {
    const current = readLists();
    if (!(name in current)) return;
    delete current[name];
    writeLists({ ...current });
  }, []);

  const setMembership = useCallback((name: string, id: string, member: boolean) => {
    const current = readLists();
    const list = current[name] ?? [];
    current[name] = member
      ? list.includes(id)
        ? list
        : [...list, id]
      : list.filter((item) => item !== id);
    writeLists({ ...current });
  }, []);

  return { lists, createList, removeList, setMembership };
}

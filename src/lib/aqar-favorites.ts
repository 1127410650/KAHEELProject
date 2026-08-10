/**
 * مفضلة كَحيل عقار — تخزين محلي في المتصفح.
 *
 * جدول `mkt_favorites` مرتبط بإعلانات السوق العام (مفتاح أجنبي على
 * `mkt_listings`)، فلا يقبل معرّفات الإعلانات العقارية. حتى تُبنى المفضلة
 * الخادمية للقسم، القلب يعمل محليًا لكل جهاز — واجهة فقط، بلا كتابة في القاعدة.
 */

import { useCallback, useEffect, useState } from "react";

const KEY = "aqar.favorites.v1";

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
    write(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }, []);

  return { ids, toggle, has: (id: string) => ids.includes(id) };
}

import { useEffect } from "react";

const RENT_WORDS = /(?:إيجار|ايجار|للإيجار|للايجار|تأجير|rent|rental|lease)/i;
const SALE_WORDS = /(?:بيع|للبيع|sale|sell)/i;
const SERVICE_WORDS = /(?:خدمة|صيانة|تركيب|تنظيف|استشارة|service|maintenance|repair)/i;
const TRANSPORT_WORDS = /(?:نقل|توصيل|رحلة|شحن|transport|delivery|trip)/i;
const MATERIAL_WORDS = /(?:مواد|بلوك|حديد|أسمنت|اسمنت|رمل|خرسانة|خشب|دهان|material|cement|steel|wood)/i;
const REAL_ESTATE_WORDS = /(?:شقة|فيلا|أرض|ارض|عقار|مكتب|محل|مستودع|غرفة|دور|عمارة|apartment|villa|land|property|office|warehouse)/i;

const TIME_UNITS = new Set(["hour", "day", "week", "month", "year"]);
const SERVICE_UNITS = new Set(["hour", "day", "service"]);
const TRANSPORT_UNITS = new Set(["trip", "service"]);
const MATERIAL_UNITS = new Set(["piece", "meter", "sqm", "ton", "kg", "litre"]);
const PRODUCT_UNITS = new Set(["piece"]);

function classify(text: string): { allowed: Set<string>; hide: boolean; hint: string } {
  const rental = RENT_WORDS.test(text);
  const sale = SALE_WORDS.test(text);
  const realEstate = REAL_ESTATE_WORDS.test(text);

  if (rental && realEstate) {
    return {
      allowed: TIME_UNITS,
      hide: false,
      hint: "اختر مدة الإيجار المناسبة: ساعة، يوم، أسبوع، شهر أو سنة.",
    };
  }

  if (sale && realEstate) {
    return {
      allowed: new Set<string>(),
      hide: true,
      hint: "سعر البيع إجمالي ولا يحتاج وحدة سعر.",
    };
  }

  if (TRANSPORT_WORDS.test(text)) {
    return { allowed: TRANSPORT_UNITS, hide: false, hint: "السعر للرحلة أو للخدمة." };
  }

  if (SERVICE_WORDS.test(text)) {
    return { allowed: SERVICE_UNITS, hide: false, hint: "السعر حسب الساعة أو اليوم أو الخدمة." };
  }

  if (MATERIAL_WORDS.test(text)) {
    return { allowed: MATERIAL_UNITS, hide: false, hint: "اختر وحدة المادة أو الكمية المناسبة." };
  }

  if (sale) {
    return {
      allowed: new Set<string>(),
      hide: true,
      hint: "سعر البيع إجمالي ولا يحتاج وحدة سعر.",
    };
  }

  return {
    allowed: PRODUCT_UNITS,
    hide: false,
    hint: "تُحدد وحدة السعر تلقائيًا حسب نوع الإعلان.",
  };
}

/**
 * Progressive enhancement for the existing listing form. It keeps the database
 * contract unchanged while making the price-unit control react immediately to
 * the listing title and selected purpose. Invalid stale values are cleared by a
 * real change event so React state and the submitted payload stay in sync.
 */
export function SmartListingPriceController() {
  useEffect(() => {
    let queued = 0;

    const apply = () => {
      const title = document.getElementById("title") as HTMLInputElement | null;
      const select = document.getElementById("price_unit") as HTMLSelectElement | null;
      if (!title || !select) return;

      const purposeText = Array.from(document.querySelectorAll("button"))
        .filter((button) => button.getAttribute("type") === "button")
        .map((button) => button.textContent ?? "")
        .join(" ");
      const result = classify(`${title.value} ${purposeText}`);
      const wrapper = select.closest("div.space-y-1\\.5") as HTMLElement | null;

      for (const option of Array.from(select.options)) {
        if (!option.value) {
          option.hidden = false;
          option.disabled = false;
          continue;
        }
        const visible = result.allowed.has(option.value);
        option.hidden = !visible;
        option.disabled = !visible;
      }

      if (select.value && !result.allowed.has(select.value)) {
        select.value = "";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }

      if (wrapper) {
        wrapper.style.display = result.hide ? "none" : "";
        wrapper.dataset.smartPriceUnit = "true";
      }

      let hint = document.getElementById("smart-price-unit-hint");
      if (!hint) {
        hint = document.createElement("p");
        hint.id = "smart-price-unit-hint";
        hint.className = "text-[11px] text-muted-foreground sm:col-span-2";
        select.closest("div.grid")?.insertAdjacentElement("afterend", hint);
      }
      hint.textContent = result.hint;
    };

    const schedule = () => {
      window.cancelAnimationFrame(queued);
      queued = window.requestAnimationFrame(apply);
    };

    const onInput = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.id === "title" || target?.id === "price_unit" || target?.closest("#field-path")) {
        schedule();
      }
    };

    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);
    document.addEventListener("click", onInput, true);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();

    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
      document.removeEventListener("click", onInput, true);
      observer.disconnect();
      window.cancelAnimationFrame(queued);
      document.getElementById("smart-price-unit-hint")?.remove();
    };
  }, []);

  return null;
}

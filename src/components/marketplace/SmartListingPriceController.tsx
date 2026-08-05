import { useEffect } from "react";

const RENT_WORDS = /(?:إيجار|ايجار|للإيجار|للايجار|تأجير|rent|rental|lease)/i;
const SALE_WORDS = /(?:بيع|للبيع|sale|sell)/i;
const SERVICE_WORDS = /(?:خدمة|صيانة|تركيب|تنظيف|استشارة|مقاول|service|maintenance|repair|installation)/i;
const TRANSPORT_WORDS = /(?:نقل|توصيل|رحلة|شحن|transport|delivery|trip)/i;
const MATERIAL_WORDS = /(?:مواد|بلوك|حديد|أسمنت|اسمنت|رمل|خرسانة|خشب|دهان|material|cement|steel|wood)/i;
const REAL_ESTATE_WORDS = /(?:شقة|فيلا|أرض|ارض|عقار|مكتب|محل|مستودع|غرفة|دور|عمارة|apartment|villa|land|property|office|warehouse)/i;
const CAR_WORDS = /(?:سيارة|سيارات|مركبة|مركبات|دباب|دراجة نارية|car|cars|vehicle|motorcycle)/i;
const EQUIPMENT_WORDS = /(?:معدات|حفار|رافعة|شيول|مولد|كمبروسر|سقالة|equipment|excavator|crane|generator)/i;

const PROPERTY_RENT_UNITS = new Set(["day", "week", "month", "year"]);
const HOURLY_PROPERTY_RENT_UNITS = new Set(["hour", "day", "week", "month", "year"]);
const CAR_RENT_UNITS = new Set(["day", "week", "month"]);
const EQUIPMENT_RENT_UNITS = new Set(["hour", "day", "week", "month"]);
const SERVICE_UNITS = new Set(["hour", "day", "service"]);
const TRANSPORT_UNITS = new Set(["trip", "service"]);
const MATERIAL_UNITS = new Set(["piece", "meter", "sqm", "ton", "kg", "litre"]);
const PRODUCT_UNITS = new Set(["piece"]);

interface PriceClassification {
  allowed: Set<string>;
  hide: boolean;
  hint: string;
}

function classify(text: string): PriceClassification {
  const rental = RENT_WORDS.test(text);
  const sale = SALE_WORDS.test(text);
  const realEstate = REAL_ESTATE_WORDS.test(text);
  const car = CAR_WORDS.test(text);
  const equipment = EQUIPMENT_WORDS.test(text);

  if (sale) {
    return {
      allowed: new Set<string>(),
      hide: true,
      hint: "سعر البيع إجمالي، لذلك لا تحتاج إلى اختيار وحدة سعر.",
    };
  }

  if (rental && realEstate) {
    const allowsHourly = /(?:غرفة|استراحة|قاعة|مكتب مشترك|room|hall|cowork)/i.test(text);
    return {
      allowed: allowsHourly ? HOURLY_PROPERTY_RENT_UNITS : PROPERTY_RENT_UNITS,
      hide: false,
      hint: allowsHourly
        ? "اختر مدة الإيجار: ساعة، يوم، أسبوع، شهر أو سنة."
        : "اختر مدة الإيجار: يوم، أسبوع، شهر أو سنة.",
    };
  }

  if (rental && car) {
    return {
      allowed: CAR_RENT_UNITS,
      hide: false,
      hint: "إيجار المركبات متاح باليوم أو الأسبوع أو الشهر.",
    };
  }

  if (rental && equipment) {
    return {
      allowed: EQUIPMENT_RENT_UNITS,
      hide: false,
      hint: "إيجار المعدات متاح بالساعة أو اليوم أو الأسبوع أو الشهر.",
    };
  }

  if (TRANSPORT_WORDS.test(text)) {
    return { allowed: TRANSPORT_UNITS, hide: false, hint: "اختر التسعير للرحلة أو للخدمة." };
  }

  if (SERVICE_WORDS.test(text)) {
    return { allowed: SERVICE_UNITS, hide: false, hint: "اختر التسعير بالساعة أو اليوم أو للخدمة كاملة." };
  }

  if (MATERIAL_WORDS.test(text)) {
    return { allowed: MATERIAL_UNITS, hide: false, hint: "اختر وحدة المادة أو الكمية المناسبة." };
  }

  if (rental) {
    return {
      allowed: EQUIPMENT_RENT_UNITS,
      hide: false,
      hint: "اختر مدة الإيجار المناسبة.",
    };
  }

  return {
    allowed: PRODUCT_UNITS,
    hide: false,
    hint: "السعر للقطعة. يتغير هذا الخيار تلقائيًا حسب نوع الإعلان والتصنيف.",
  };
}

function selectedPurposeText(): string {
  const form = document.querySelector(".listing-new-flow") ?? document;
  const selected: string[] = [];

  for (const input of Array.from(form.querySelectorAll<HTMLInputElement>('input[type="radio"]:checked, input[type="checkbox"]:checked'))) {
    const label = input.id ? form.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(input.id)}"]`) : null;
    selected.push(label?.textContent ?? input.value ?? "");
  }

  for (const button of Array.from(form.querySelectorAll<HTMLButtonElement>('button[type="button"]'))) {
    const active =
      button.getAttribute("aria-pressed") === "true" ||
      button.getAttribute("data-state") === "on" ||
      button.getAttribute("data-state") === "active" ||
      button.getAttribute("aria-selected") === "true";
    if (active) selected.push(button.textContent ?? "");
  }

  return selected.join(" ");
}

/**
 * Progressive enhancement for the existing listing form. It keeps the database
 * contract unchanged while limiting price units to the selected transaction and
 * category. Invalid stale values are cleared through a real change event so the
 * React state and submitted payload remain synchronized.
 */
export function SmartListingPriceController() {
  useEffect(() => {
    let queued = 0;

    const apply = () => {
      const title = document.getElementById("title") as HTMLInputElement | null;
      const select = document.getElementById("price_unit") as HTMLSelectElement | null;
      if (!title || !select) return;

      const fieldPath = document.getElementById("field-path")?.textContent ?? "";
      const result = classify(`${title.value} ${fieldPath} ${selectedPurposeText()}`);
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
        wrapper.dataset["smartPriceUnit"] = "true";
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

    const onInteraction = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.id === "title" ||
        target?.id === "price_unit" ||
        target?.closest("#field-path") ||
        target?.closest("button") ||
        target?.matches('input[type="radio"], input[type="checkbox"]')
      ) {
        schedule();
      }
    };

    document.addEventListener("input", onInteraction, true);
    document.addEventListener("change", onInteraction, true);
    document.addEventListener("click", onInteraction, true);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    schedule();

    return () => {
      document.removeEventListener("input", onInteraction, true);
      document.removeEventListener("change", onInteraction, true);
      document.removeEventListener("click", onInteraction, true);
      observer.disconnect();
      window.cancelAnimationFrame(queued);
      document.getElementById("smart-price-unit-hint")?.remove();
    };
  }, []);

  return null;
}

/**
 * The taxonomy that drives the ad form: which purposes a main field accepts,
 * and which detail fields make sense for the chosen path.
 *
 * The category tree itself lives in the database (`mkt_categories`); this file
 * only maps existing roots and subcategory slugs to purposes and spec fields,
 * so no category is ever duplicated in code.
 */

export type SpecKind = "number" | "text" | "select" | "bool";

export interface SpecField {
  /** Stored key inside `mkt_listings.specs`. */
  key: string;
  kind: SpecKind;
  /** Translation key under `market.spec.*`. */
  labelKey: string;
  /** Option values for a select; labels come from `market.spec.opt.<value>`. */
  options?: string[];
  /** Optional short suffix translation key (unit). */
  unitKey?: string;
}

/** Purposes (listing type codes) offered per root category slug. */
export const ROOT_PURPOSES: Record<string, string[]> = {
  "real-estate": ["property_sale", "property_rent", "property_wanted_buy", "property_wanted_rent"],
  equipment: ["equipment_rent", "equipment_sale", "need_supplier"],
  "building-materials": ["product", "need_supplier"],
  factories: ["product", "need_supplier"],
  logistics: ["service", "need_contractor"],
  maintenance: ["service", "need_contractor"],
  "general-contracting": ["service", "need_contractor"],
  finishing: ["service", "need_contractor"],
  electrical: ["service", "need_contractor"],
  plumbing: ["service", "need_contractor"],
  hvac: ["service", "need_contractor"],
  professional: ["service", "need_contractor"],
  safety: ["service", "need_contractor", "product"],
};

export const DEFAULT_PURPOSES = ["service", "product", "need_supplier", "need_contractor"];

export function purposesFor(rootSlug: string | null | undefined): string[] {
  if (!rootSlug) return DEFAULT_PURPOSES;
  return ROOT_PURPOSES[rootSlug] ?? DEFAULT_PURPOSES;
}

const FACADE = ["north", "south", "east", "west", "north_east", "north_west", "south_east", "south_west"];

const F = {
  area: { key: "area", kind: "number", labelKey: "market.spec.area", unitKey: "market.spec.sqm" },
  rooms: { key: "rooms", kind: "number", labelKey: "market.spec.rooms" },
  baths: { key: "baths", kind: "number", labelKey: "market.spec.baths" },
  age: { key: "age", kind: "number", labelKey: "market.spec.age", unitKey: "market.spec.years" },
  facade: { key: "facade", kind: "select", labelKey: "market.spec.facade", options: FACADE },
  streetWidth: {
    key: "street_width",
    kind: "number",
    labelKey: "market.spec.streetWidth",
    unitKey: "market.spec.meter",
  },
  floor: { key: "floor", kind: "number", labelKey: "market.spec.floor" },
  furnished: { key: "furnished", kind: "bool", labelKey: "market.spec.furnished" },
  negotiable: { key: "negotiable", kind: "bool", labelKey: "market.spec.negotiable" },
  brand: { key: "brand", kind: "text", labelKey: "market.spec.brand" },
  model: { key: "model", kind: "text", labelKey: "market.spec.model" },
  year: { key: "year", kind: "number", labelKey: "market.spec.year" },
  hours: { key: "operating_hours", kind: "number", labelKey: "market.spec.hours" },
  capacity: { key: "capacity", kind: "text", labelKey: "market.spec.capacity" },
  withOperator: { key: "with_operator", kind: "bool", labelKey: "market.spec.withOperator" },
  rentPeriod: {
    key: "rent_period",
    kind: "select",
    labelKey: "market.spec.rentPeriod",
    options: ["day", "week", "month", "project"],
  },
  spec: { key: "material_spec", kind: "text", labelKey: "market.spec.materialSpec" },
  minOrder: { key: "min_order", kind: "text", labelKey: "market.spec.minOrder" },
  delivery: { key: "delivery", kind: "bool", labelKey: "market.spec.delivery" },
  experience: { key: "experience_years", kind: "number", labelKey: "market.spec.experience" },
  coverage: { key: "coverage", kind: "text", labelKey: "market.spec.coverage" },
  response: { key: "response_time", kind: "text", labelKey: "market.spec.responseTime" },
  warranty: { key: "warranty", kind: "bool", labelKey: "market.spec.warranty" },
  productionCapacity: {
    key: "production_capacity",
    kind: "text",
    labelKey: "market.spec.productionCapacity",
  },
} satisfies Record<string, SpecField>;

/** Real-estate detail fields, per subcategory slug. */
const REAL_ESTATE: Record<string, SpecField[]> = {
  "re-apartments": [F.area, F.rooms, F.baths, F.floor, F.age, F.facade, F.furnished, F.negotiable],
  "re-villas": [F.area, F.rooms, F.baths, F.age, F.facade, F.streetWidth, F.furnished, F.negotiable],
  "re-land": [F.area, F.facade, F.streetWidth, F.negotiable],
  "re-buildings": [F.area, F.rooms, F.baths, F.age, F.facade, F.streetWidth, F.negotiable],
  "re-offices": [F.area, F.rooms, F.baths, F.floor, F.age, F.facade, F.furnished, F.negotiable],
  "re-shops": [F.area, F.baths, F.floor, F.age, F.facade, F.streetWidth, F.negotiable],
  "re-warehouses": [F.area, F.age, F.facade, F.streetWidth, F.negotiable],
  "re-farms": [F.area, F.rooms, F.baths, F.facade, F.streetWidth, F.negotiable],
  "re-chalets": [F.area, F.rooms, F.baths, F.age, F.furnished, F.negotiable],
  "re-rooms": [F.rooms, F.baths, F.floor, F.furnished, F.negotiable],
  "re-investment": [F.area, F.age, F.facade, F.streetWidth, F.negotiable],
};

const EQUIPMENT_BASE = [F.brand, F.model, F.year, F.hours, F.capacity, F.withOperator, F.negotiable];
const PRODUCT_BASE = [F.brand, F.spec, F.minOrder, F.delivery, F.negotiable];
const SERVICE_BASE = [F.experience, F.coverage, F.response, F.warranty, F.negotiable];
const SUPPLIER_BASE = [F.productionCapacity, F.minOrder, F.delivery, F.negotiable];

/**
 * Detail fields for the chosen path. Only the fields that fit the selected
 * subcategory (or, failing that, the main field) are ever shown.
 */
export function specFieldsFor(input: {
  rootSlug: string | null | undefined;
  subSlug: string | null | undefined;
  typeCode: string | null | undefined;
}): SpecField[] {
  const { rootSlug, subSlug, typeCode } = input;
  if (rootSlug === "real-estate") {
    const base = (subSlug && REAL_ESTATE[subSlug]) || [F.area, F.negotiable];
    return base;
  }
  if (rootSlug === "equipment") {
    return typeCode === "equipment_rent" ? [...EQUIPMENT_BASE, F.rentPeriod] : EQUIPMENT_BASE;
  }
  if (rootSlug === "building-materials") return PRODUCT_BASE;
  if (rootSlug === "factories") return SUPPLIER_BASE;
  if (typeCode === "product") return PRODUCT_BASE;
  return SERVICE_BASE;
}

/** Real-estate purposes that mean "wanted", so price becomes a budget. */
export function isWantedType(typeCode: string | null | undefined): boolean {
  return (
    typeCode === "property_wanted_buy" ||
    typeCode === "property_wanted_rent" ||
    typeCode === "need_supplier" ||
    typeCode === "need_contractor"
  );
}

/** deal_kind stored alongside the purpose, for filters that use it. */
export function dealKindFor(typeCode: string | null | undefined): "sale" | "rent" | null {
  switch (typeCode) {
    case "property_sale":
    case "equipment_sale":
      return "sale";
    case "property_rent":
    case "equipment_rent":
      return "rent";
    default:
      return null;
  }
}

/** Titles made of symbols/whitespace only are rejected, mirroring the database. */
export function isValidTitle(raw: string): boolean {
  const value = raw.trim();
  if (value.length < 5 || value.length > 120) return false;
  return /[\p{L}\p{N}]/u.test(value);
}

export const TITLE_MIN = 5;
export const TITLE_MAX = 120;

/** Every known detail field, so a stored spec key can be labelled on the ad page. */
export const SPEC_FIELDS: SpecField[] = Object.values(F);

export function specFieldByKey(key: string): SpecField | null {
  return SPEC_FIELDS.find((field) => field.key === key) ?? null;
}

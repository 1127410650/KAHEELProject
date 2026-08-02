/**
 * Local draft of the ad form.
 *
 * Kept in `sessionStorage` (this tab only) so a refresh or a detour to create a
 * business never loses typed fields. Coordinates and accuracy are deliberately
 * NOT stored locally: they are private location data, and the map simply
 * re-derives them from the saved city or the device when the form resumes.
 */

export interface ListingDraft {
  typeCode: string;
  categoryId: string;
  subcategoryId: string;
  title: string;
  summary: string;
  description: string;
  price: string;
  priceUnit: string;
  priceOnRequest: boolean;
  quantity: string;
  unit: string;
  itemCondition: string;
  cityId: string;
  region: string;
  district: string;
  addressText: string;
  locationVisibility: "approximate" | "exact";
  accountKey: string;
  specs: Record<string, string | number | boolean>;
  step: number;
}

const PREFIX = "tahqaq.mkt.ad-draft:";

export function draftKey(scope: string): string {
  return `${PREFIX}${scope}`;
}

export function loadDraft(scope: string): Partial<ListingDraft> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(draftKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Partial<ListingDraft>;
  } catch {
    return null;
  }
}

export function saveDraft(scope: string, draft: Partial<ListingDraft>): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(draftKey(scope), JSON.stringify(draft));
  } catch {
    /* storage full or unavailable: the form still works without a draft */
  }
}

export function clearDraft(scope: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(draftKey(scope));
  } catch {
    /* ignore */
  }
}

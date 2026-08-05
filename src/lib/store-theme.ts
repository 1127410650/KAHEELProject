export const STORE_THEME_IDS = [
  "general",
  "women",
  "men",
  "kids",
  "games",
  "clubs",
  "restaurant",
  "cars",
  "real-estate",
  "electronics",
  "furniture",
  "contracting",
  "agriculture",
  "handmade",
  "factory",
  "wholesale",
] as const;

export type StoreThemeId = (typeof STORE_THEME_IDS)[number];

export interface StoreThemeAppearance {
  id: StoreThemeId;
  gradient: string;
  softGradient: string;
  ring: string;
  accent: string;
  surface: string;
}

const THEMES: Record<StoreThemeId, StoreThemeAppearance> = {
  general: {
    id: "general",
    gradient: "from-slate-950 via-slate-800 to-slate-600",
    softGradient: "from-slate-950/95 via-slate-800/75 to-slate-500/35",
    ring: "ring-slate-300/70",
    accent: "text-slate-700 dark:text-slate-200",
    surface: "bg-slate-50/70 dark:bg-slate-950/20",
  },
  women: {
    id: "women",
    gradient: "from-fuchsia-950 via-rose-900 to-pink-500",
    softGradient: "from-fuchsia-950/95 via-rose-900/75 to-pink-500/35",
    ring: "ring-rose-300/70",
    accent: "text-rose-700 dark:text-rose-200",
    surface: "bg-rose-50/70 dark:bg-rose-950/20",
  },
  men: {
    id: "men",
    gradient: "from-slate-950 via-blue-950 to-sky-700",
    softGradient: "from-slate-950/95 via-blue-950/75 to-sky-700/35",
    ring: "ring-sky-300/70",
    accent: "text-sky-800 dark:text-sky-200",
    surface: "bg-sky-50/70 dark:bg-sky-950/20",
  },
  kids: {
    id: "kids",
    gradient: "from-cyan-800 via-sky-500 to-yellow-300",
    softGradient: "from-cyan-900/90 via-sky-600/70 to-yellow-300/35",
    ring: "ring-cyan-300/70",
    accent: "text-cyan-800 dark:text-cyan-200",
    surface: "bg-cyan-50/70 dark:bg-cyan-950/20",
  },
  games: {
    id: "games",
    gradient: "from-violet-950 via-indigo-800 to-cyan-500",
    softGradient: "from-violet-950/95 via-indigo-800/75 to-cyan-500/35",
    ring: "ring-violet-300/70",
    accent: "text-violet-800 dark:text-violet-200",
    surface: "bg-violet-50/70 dark:bg-violet-950/20",
  },
  clubs: {
    id: "clubs",
    gradient: "from-zinc-950 via-emerald-900 to-lime-500",
    softGradient: "from-zinc-950/95 via-emerald-900/75 to-lime-500/35",
    ring: "ring-emerald-300/70",
    accent: "text-emerald-800 dark:text-emerald-200",
    surface: "bg-emerald-50/70 dark:bg-emerald-950/20",
  },
  restaurant: {
    id: "restaurant",
    gradient: "from-red-950 via-orange-800 to-amber-400",
    softGradient: "from-red-950/95 via-orange-800/75 to-amber-400/35",
    ring: "ring-amber-300/70",
    accent: "text-orange-800 dark:text-orange-200",
    surface: "bg-orange-50/70 dark:bg-orange-950/20",
  },
  cars: {
    id: "cars",
    gradient: "from-zinc-950 via-red-950 to-red-700",
    softGradient: "from-zinc-950/95 via-red-950/75 to-red-700/35",
    ring: "ring-red-300/70",
    accent: "text-red-800 dark:text-red-200",
    surface: "bg-red-50/70 dark:bg-red-950/20",
  },
  "real-estate": {
    id: "real-estate",
    gradient: "from-emerald-950 via-teal-900 to-cyan-700",
    softGradient: "from-emerald-950/95 via-teal-900/75 to-cyan-700/35",
    ring: "ring-teal-300/70",
    accent: "text-teal-800 dark:text-teal-200",
    surface: "bg-teal-50/70 dark:bg-teal-950/20",
  },
  electronics: {
    id: "electronics",
    gradient: "from-indigo-950 via-violet-900 to-fuchsia-700",
    softGradient: "from-indigo-950/95 via-violet-900/75 to-fuchsia-700/35",
    ring: "ring-indigo-300/70",
    accent: "text-indigo-800 dark:text-indigo-200",
    surface: "bg-indigo-50/70 dark:bg-indigo-950/20",
  },
  furniture: {
    id: "furniture",
    gradient: "from-amber-950 via-orange-900 to-yellow-600",
    softGradient: "from-amber-950/95 via-orange-900/75 to-yellow-600/35",
    ring: "ring-amber-300/70",
    accent: "text-amber-800 dark:text-amber-200",
    surface: "bg-amber-50/70 dark:bg-amber-950/20",
  },
  contracting: {
    id: "contracting",
    gradient: "from-stone-950 via-amber-950 to-orange-700",
    softGradient: "from-stone-950/95 via-amber-950/75 to-orange-700/35",
    ring: "ring-orange-300/70",
    accent: "text-orange-800 dark:text-orange-200",
    surface: "bg-orange-50/70 dark:bg-orange-950/20",
  },
  agriculture: {
    id: "agriculture",
    gradient: "from-lime-950 via-green-900 to-emerald-600",
    softGradient: "from-lime-950/95 via-green-900/75 to-emerald-600/35",
    ring: "ring-lime-300/70",
    accent: "text-green-800 dark:text-green-200",
    surface: "bg-green-50/70 dark:bg-green-950/20",
  },
  handmade: {
    id: "handmade",
    gradient: "from-purple-950 via-indigo-900 to-sky-600",
    softGradient: "from-purple-950/95 via-indigo-900/75 to-sky-600/35",
    ring: "ring-purple-300/70",
    accent: "text-purple-800 dark:text-purple-200",
    surface: "bg-purple-50/70 dark:bg-purple-950/20",
  },
  factory: {
    id: "factory",
    gradient: "from-slate-950 via-blue-950 to-cyan-700",
    softGradient: "from-slate-950/95 via-blue-950/75 to-cyan-700/35",
    ring: "ring-cyan-300/70",
    accent: "text-cyan-800 dark:text-cyan-200",
    surface: "bg-cyan-50/70 dark:bg-cyan-950/20",
  },
  wholesale: {
    id: "wholesale",
    gradient: "from-cyan-950 via-sky-900 to-blue-600",
    softGradient: "from-cyan-950/95 via-sky-900/75 to-blue-600/35",
    ring: "ring-blue-300/70",
    accent: "text-blue-800 dark:text-blue-200",
    surface: "bg-blue-50/70 dark:bg-blue-950/20",
  },
};

export function isStoreThemeId(value: unknown): value is StoreThemeId {
  return typeof value === "string" && STORE_THEME_IDS.includes(value as StoreThemeId);
}

export function normalizeStoreTheme(value: unknown): StoreThemeId {
  return isStoreThemeId(value) ? value : "general";
}

export function storeThemeAppearance(value: unknown): StoreThemeAppearance {
  return THEMES[normalizeStoreTheme(value)];
}

export function demoWorldThemeId(worldId: string): StoreThemeId {
  const mapping: Record<string, StoreThemeId> = {
    women: "women",
    men: "men",
    kids: "kids",
    games: "games",
    clubs: "clubs",
    restaurants: "restaurant",
    cafes: "restaurant",
    jewelry: "women",
    gifts: "handmade",
    pets: "general",
  };
  return mapping[worldId] ?? "general";
}

type RuntimeBridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function getRuntimeBridge(): RuntimeBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { Capacitor?: RuntimeBridge }).Capacitor;
}

export function isNativePlatform(): boolean {
  try {
    return getRuntimeBridge()?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

export function nativePlatformName(): "ios" | "android" | "web" {
  if (!isNativePlatform()) return "web";
  const platform = getRuntimeBridge()?.getPlatform?.();
  return platform === "ios" || platform === "android" ? platform : "web";
}

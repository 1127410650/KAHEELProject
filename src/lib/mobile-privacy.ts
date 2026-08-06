const PRIVACY_SHIELD_ID = "kaheel-native-privacy-shield";

export function showNativePrivacyShield(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(PRIVACY_SHIELD_ID)) return;

  const shield = document.createElement("div");
  shield.id = PRIVACY_SHIELD_ID;
  shield.setAttribute("role", "presentation");
  shield.setAttribute("aria-hidden", "true");
  shield.textContent = "KAHEEL";
  document.body.appendChild(shield);
}

export function hideNativePrivacyShield(): void {
  if (typeof document === "undefined") return;
  document.getElementById(PRIVACY_SHIELD_ID)?.remove();
}

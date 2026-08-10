import { describe, it, expect } from "vitest";
import { PALETTE_GREEN_NAVY, PALETTE_PURPLE, contrastIssues } from "@/lib/theme-tokens";

describe("contrast guard", () => {
  it("passes both builtin palettes", () => {
    expect(contrastIssues(PALETTE_GREEN_NAVY)).toEqual([]);
    expect(contrastIssues(PALETTE_PURPLE)).toEqual([]);
  });
  it("rejects light-gray text on white card", () => {
    const bad = { ...PALETTE_GREEN_NAVY, "text-secondary": "#CFD8E3" } as typeof PALETTE_GREEN_NAVY;
    const issues = contrastIssues(bad);
    console.log(issues);
    expect(issues.length).toBeGreaterThan(0);
  });
  it("rejects white text on a pale header", () => {
    const bad = { ...PALETTE_GREEN_NAVY, "header-from": "#DDEEFF" } as typeof PALETTE_GREEN_NAVY;
    console.log(contrastIssues(bad));
    expect(contrastIssues(bad).length).toBeGreaterThan(0);
  });
});

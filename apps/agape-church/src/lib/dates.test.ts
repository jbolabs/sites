import { describe, expect, it } from "vitest";

import { churchDate, isCurrent } from "./dates.ts";

describe(churchDate, () => {
  it("uses Yorba Linda's date, not UTC's", () => {
    // 03:30 UTC on Oct 26 is still the evening of Oct 25 in California (PDT).
    expect(churchDate(new Date("2026-10-26T03:30:00Z"))).toBe("2026-10-25");
  });

  it("follows the winter offset after daylight saving ends", () => {
    // 07:59 UTC on Dec 1 is 11:59 PM on Nov 30 in PST.
    expect(churchDate(new Date("2026-12-01T07:59:00Z"))).toBe("2026-11-30");
  });
});

describe(isCurrent, () => {
  it("keeps an announcement through its end date", () => {
    expect(isCurrent("2026-10-25", "2026-10-25")).toBeTruthy();
  });

  it("hides an announcement the day after it ends", () => {
    expect(isCurrent("2026-10-25", "2026-10-26")).toBeFalsy();
  });

  it("never hides an announcement without an end date", () => {
    expect(isCurrent(null, "2099-01-01")).toBeTruthy();
    expect(isCurrent("", "2099-01-01")).toBeTruthy();
  });
});

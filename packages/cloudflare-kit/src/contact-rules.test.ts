import { describe, expect, it } from "vitest";

import { fitsContactLimit, isEmailAddress } from "./contact-rules.ts";

describe(isEmailAddress, () => {
  it("takes one @ before a dotted domain", () => {
    const checked = [
      "jordan@example.com",
      "jordan@example",
      "jordan@@example.com",
      "jor dan@example.com",
    ].map(isEmailAddress);
    expect(checked).toStrictEqual([true, false, false, false]);
  });
});

describe(fitsContactLimit, () => {
  it("measures the trimmed value against the server's limits", () => {
    const checked = [
      fitsContactLimit("name", "Al"),
      fitsContactLimit("name", " A "),
      fitsContactLimit("message", "Too short"),
      fitsContactLimit("message", "Kitchen remodel in spring"),
      fitsContactLimit("phone", ""),
      fitsContactLimit("phone", "1".repeat(41)),
    ];
    expect(checked).toStrictEqual([true, false, false, true, true, false]);
  });
});

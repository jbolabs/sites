import { describe, expect, it } from "vitest";

import { entrySlug, localePath } from "./locales.ts";

describe(entrySlug, () => {
  it("drops the locale EmDash puts in front of a Romanian entry id", () => {
    expect(entrySlug("ro/copii")).toBe("copii");
    expect(localePath("ro", `/ministries/${entrySlug("ro/copii")}`)).toBe(
      "/ro/ministries/copii"
    );
  });

  it("keeps an English id, and a slug that only looks like a locale", () => {
    expect(entrySlug("youth")).toBe("youth");
    expect(entrySlug("ro")).toBe("ro");
    expect(entrySlug("media/ro")).toBe("media/ro");
  });
});

import { describe, expect, it } from "vitest";

import { legacyRedirect } from "./legacy.ts";

const at = (path: string) =>
  legacyRedirect(new URL(path, "https://agapeoc.com"));

describe(legacyRedirect, () => {
  it("sends old .html pages to their new homes", () => {
    expect(at("/donations.html")).toBe("/give");
    expect(at("/pastors.html")).toBe("/leadership");
    expect(at("/kids.html")).toBe("/ministries/children");
  });

  it("matches the old URL with a space and odd capitalization", () => {
    expect(at("/bible%2024.html")).toBe("/bible-reading-plan");
    expect(at("/Youth.html")).toBe("/ministries/youth");
  });

  it("leaves every other path alone", () => {
    expect(at("/give")).toBeUndefined();
    expect(at("/constructor")).toBeUndefined();
    expect(at("/%E0%A4%A.html")).toBeUndefined();
    expect(at("/vision.html")).toBe("/vision");
  });
});

import { describe, expect, it } from "vitest";

import { adminLinkPath } from "./admin-link.ts";

const origin = "https://aniwenger.com";

describe(adminLinkPath, () => {
  it("opens an entry the assistant linked, keeping its query", () => {
    expect(
      adminLinkPath(
        "https://aniwenger.com/_emdash/admin/content/products/01M6?locale=en",
        origin
      )
    ).toBe("/_emdash/admin/content/products/01M6?locale=en");
    expect(adminLinkPath("/_emdash/admin/content/pages/7", origin)).toBe(
      "/_emdash/admin/content/pages/7"
    );
  });

  it("leaves public pages and other sites to the browser", () => {
    expect(adminLinkPath("/products/towel", origin)).toBeUndefined();
    expect(
      adminLinkPath("https://example.com/_emdash/admin/content/x", origin)
    ).toBeUndefined();
    expect(adminLinkPath("/_emdash/admin/", origin)).toBe("/_emdash/admin/");
  });
});

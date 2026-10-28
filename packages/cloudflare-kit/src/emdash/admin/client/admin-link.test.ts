import { describe, expect, it } from "vitest";

import { adminLinkPath } from "./admin-link.ts";

const origin = "https://aniwenger.com";
const dashboard = "/_emdash/admin/";

describe(adminLinkPath, () => {
  it("opens an entry the assistant linked in place, keeping its query", () => {
    expect(
      adminLinkPath(
        "https://aniwenger.com/_emdash/admin/content/products/01M6?locale=en",
        origin,
        dashboard
      )
    ).toBe("/_emdash/admin/content/products/01M6?locale=en");
    expect(
      adminLinkPath("/_emdash/admin/content/pages/7", origin, dashboard)
    ).toBe("/_emdash/admin/content/pages/7");
  });

  it("loads the screen already open normally, so it shows the new draft", () => {
    const open = "/_emdash/admin/content/pages/7";
    expect(adminLinkPath(open, origin, open)).toBeUndefined();
    expect(adminLinkPath(open, origin, dashboard)).toBe(open);
  });

  it("leaves public pages and other sites to the browser", () => {
    expect(adminLinkPath("/products/towel", origin, dashboard)).toBeUndefined();
    expect(
      adminLinkPath(
        "https://example.com/_emdash/admin/content/x",
        origin,
        dashboard
      )
    ).toBeUndefined();
    expect(adminLinkPath("/_emdash/admin/media", origin, dashboard)).toBe(
      "/_emdash/admin/media"
    );
  });
});

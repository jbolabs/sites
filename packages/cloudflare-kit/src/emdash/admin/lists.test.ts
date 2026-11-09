import { describe, expect, it } from "vitest";

import { adminListsCss } from "./lists.ts";

describe(adminListsCss, () => {
  it("hides the publish status, date and stored columns a site's own columns replace", () => {
    expect(
      adminListsCss({
        appointments: {
          columns: [{ field: "phone", label: "Phone" }],
          hideStatus: true,
        },
      })
    ).toBe(
      [
        'html[data-theme] main table:has(a[href^="/_emdash/admin/content/appointments/"]) :is(th, td):is([data-admin-cell=status], [data-admin-cell=date], [data-admin-cell=field]){display:none}',
        'html[data-theme] main:has(tbody a[href^="/_emdash/admin/content/appointments/"]) button[aria-label="Filter by status"]{display:none}',
        "html[data-theme] main tr:has([data-admin-fade]) > td{opacity:0.5}",
        "html[data-theme] main [data-admin-format=phone]{white-space:nowrap}",
      ].join("\n")
    );
  });

  it("keeps the status and its filter when only columns are set", () => {
    const css = adminListsCss({
      products: { columns: [{ field: "brand", label: "Brand" }] },
    });
    expect(css).toContain(
      ":is(th, td):is([data-admin-cell=field]){display:none}"
    );
    expect(css).not.toContain("Filter by status");
  });

  it("adds nothing for a site without list options", () => {
    expect(adminListsCss()).toBe("");
    expect(adminListsCss({ pages: {} })).toBe("");
  });
});

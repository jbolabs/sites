import { describe, expect, it } from "vitest";

import { adminNavCss } from "./nav.ts";

describe(adminNavCss, () => {
  it("hides only the entries a site has not asked for", () => {
    expect(
      adminNavCss([
        "byline-schema",
        "bylines",
        "calendar",
        "categories",
        "import",
        "sections",
        "tags",
        "widgets",
      ])
    ).toBe(
      'html[data-theme] [data-sidebar=menu-item]:has(> :is(a[href="/_emdash/admin/comments"], a[href^="/_emdash/admin/comments?"])){display:none}'
    );
  });

  it("hides the blog features by default", () => {
    const css = adminNavCss();
    expect(css).toContain('a[href="/_emdash/admin/taxonomies/tag"]');
    expect(css).toContain('a[href^="/_emdash/admin/taxonomies/tag?"]');
    expect(css).toContain('a[href="/_emdash/admin/bylines"]');
    expect(css).toContain('a[href="/_emdash/admin/import/wordpress"]');
    expect(css).not.toContain("/_emdash/admin/menus");
  });

  it("hides the byline filter on content lists while bylines are hidden", () => {
    expect(adminNavCss()).toContain(
      'html[data-theme] main button[aria-label="Filter by byline"]{display:none}'
    );
    expect(adminNavCss(["bylines"])).not.toContain("Filter by byline");
  });

  it("adds nothing when a site shows every entry", () => {
    expect(
      adminNavCss([
        "byline-schema",
        "bylines",
        "calendar",
        "categories",
        "comments",
        "import",
        "sections",
        "tags",
        "widgets",
      ])
    ).toBe("");
  });

  it("puts a pinned page right under Dashboard and drops its emptied group's name", () => {
    const link = 'a[href="/_emdash/admin/plugins/schedule/schedule"]';
    const group =
      "html[data-theme] [data-sidebar=content] [data-sidebar=group]";
    expect(
      adminNavCss(
        [
          "byline-schema",
          "bylines",
          "calendar",
          "categories",
          "comments",
          "import",
          "sections",
          "tags",
          "widgets",
        ],
        ["/plugins/schedule/schedule"]
      )
    ).toBe(
      [
        `${group}:first-child{order:-2}`,
        `${group}:has(> [data-sidebar=menu] > [data-sidebar=menu-item] > :is(${link})), ${group}:has(> [data-sidebar=menu] > [data-sidebar=menu-item] > :is(${link})) > [data-sidebar=menu]{display:contents}`,
        `html[data-theme] [data-sidebar=content] [data-sidebar=menu-item]:has(> :is(${link})){order:-1}`,
        `${group}:has(> [data-sidebar=menu] > [data-sidebar=menu-item]:only-child > :is(${link})) > [data-sidebar=group-label]{display:none}`,
      ].join("\n")
    );
  });

  it("never nests :has(), which would void the rule", () => {
    const rules = adminNavCss([], ["plugins/schedule/schedule"])
      .split("\n")
      .filter((rule) => rule.includes("plugins/schedule/schedule"));
    expect(rules).toHaveLength(3);
    expect(
      rules.filter((rule) => /:has\([^)]*:has\(/u.test(rule))
    ).toStrictEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import { dropSiteDevStyles } from "./dev-styles.ts";

describe(dropSiteDevStyles, () => {
  it("drops the site's own dev styles and keeps EmDash's", () => {
    expect(
      dropSiteDevStyles(
        [
          "<head>",
          '<style data-vite-dev-id="/repo/node_modules/@emdash-cms/admin/dist/styles.css?url">.a{}</style>',
          '<style type="text/css" data-vite-dev-id="/repo/apps/site/src/styles/global.css">.hidden{display:none}\n.flex{}</style>',
          "<style>body{color:red}</style>",
          '<script type="module" src="/src/styles/global.css"></script>',
          '<script type="module" src="/@fs/repo/node_modules/@emdash-cms/admin/dist/styles.css?url"></script>',
          '<script type="module" src="/src/admin.ts"></script>',
          "</head>",
        ].join("")
      )
    ).toBe(
      [
        "<head>",
        '<style data-vite-dev-id="/repo/node_modules/@emdash-cms/admin/dist/styles.css?url">.a{}</style>',
        "<style>body{color:red}</style>",
        '<script type="module" src="/@fs/repo/node_modules/@emdash-cms/admin/dist/styles.css?url"></script>',
        '<script type="module" src="/src/admin.ts"></script>',
        "</head>",
      ].join("")
    );
  });
});

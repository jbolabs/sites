import { describe, expect, it } from "vitest";

import { dropAdminDevStyles, dropSiteDevStyles } from "./dev-styles.ts";

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

describe(dropAdminDevStyles, () => {
  it("drops the admin's own styles from site pages and keeps the rest", () => {
    expect(
      dropAdminDevStyles(
        [
          "<head>",
          '<style data-vite-dev-id="/repo/node_modules/.bun/@emdash-cms+admin@1.1.0/node_modules/@emdash-cms/admin/dist/styles.css?url">.hidden{display:none}</style>',
          '<style data-vite-dev-id="/repo/node_modules/emdash/src/astro/routes/admin.astro?astro&amp;type=style&amp;index=0&amp;lang.css">#boot{}</style>',
          '<style data-vite-dev-id="/repo/apps/site/src/styles/global.css">.flex{}</style>',
          '<style data-vite-dev-id="/repo/node_modules/emdash/src/components/Image.astro?astro&amp;type=style&amp;index=0&amp;lang.css">img{}</style>',
          '<script type="module" src="/@fs/repo/node_modules/@emdash-cms/admin/dist/styles.css?url"></script>',
          '<script type="module" src="/src/styles/global.css"></script>',
          "</head>",
        ].join("")
      )
    ).toBe(
      [
        "<head>",
        '<style data-vite-dev-id="/repo/apps/site/src/styles/global.css">.flex{}</style>',
        '<style data-vite-dev-id="/repo/node_modules/emdash/src/components/Image.astro?astro&amp;type=style&amp;index=0&amp;lang.css">img{}</style>',
        '<script type="module" src="/src/styles/global.css"></script>',
        "</head>",
      ].join("")
    );
  });
});

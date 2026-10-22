/**
 * In dev, EmDash's runtime imports `astro:config/server`, which pulls Astro's whole page
 * manifest, admin route included, into every route's module graph. Astro's dev CSS crawl
 * then inlines every route's styles into every page: the site's Tailwind into the admin
 * (stacked layouts, missing labels, wrong colors) and EmDash's admin build into the site.
 * Production bundles CSS per route, so neither happens there. These filters make each side
 * match production.
 */
const DEV_STYLE =
  /<style\b[^>]*\bdata-vite-dev-id="(?<id>[^"]*)"[^>]*>[\s\S]*?<\/style>/gu;
/** Vite's hot-reload client re-injects the same stylesheet from a module script. */
const DEV_STYLE_SCRIPT =
  /<script\b[^>]*\btype="module"[^>]*\bsrc="(?<id>[^"]*\.css(?:\?[^"]*)?)"[^>]*><\/script>/gu;

/** Styles only the admin route uses: EmDash's admin build and its shell page. */
const ADMIN_ONLY = [
  "/@emdash-cms/admin/",
  "/emdash/src/astro/routes/admin.astro",
];

const keepDevStyles = (keep: (id: string) => boolean) => {
  const filter = (tag: string, id: string) => (keep(id) ? tag : "");
  return (html: string): string =>
    html.replaceAll(DEV_STYLE, filter).replaceAll(DEV_STYLE_SCRIPT, filter);
};

/** For the admin: EmDash's styles come from node_modules; the project's own are the site's. */
export const dropSiteDevStyles = keepDevStyles((id) =>
  id.includes("/node_modules/")
);

/** For site pages: everything except the admin's own styles. */
export const dropAdminDevStyles = keepDevStyles(
  (id) => !ADMIN_ONLY.some((path) => id.includes(path))
);

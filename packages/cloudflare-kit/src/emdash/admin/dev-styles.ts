/**
 * In dev, EmDash's runtime imports `astro:config/server`, which pulls Astro's whole page
 * manifest into the admin route's module graph. Astro's dev CSS crawl then inlines every
 * site page's styles into the admin, and the site's Tailwind utilities override EmDash's
 * (stacked layouts, missing labels, wrong colors). Production bundles CSS per route, so the
 * admin there links only EmDash's stylesheet. Dropping the project's own dev styles makes
 * dev match production; EmDash's styles come from node_modules and stay.
 */
const DEV_STYLE =
  /<style\b[^>]*\bdata-vite-dev-id="(?<id>[^"]*)"[^>]*>[\s\S]*?<\/style>/gu;
/** Vite's hot-reload client re-injects the same stylesheet from a module script. */
const DEV_STYLE_SCRIPT =
  /<script\b[^>]*\btype="module"[^>]*\bsrc="(?<id>[^"]*\.css(?:\?[^"]*)?)"[^>]*><\/script>/gu;

const keepEmDash = (tag: string, id: string) =>
  id.includes("/node_modules/") ? tag : "";

export const dropSiteDevStyles = (html: string): string =>
  html
    .replaceAll(DEV_STYLE, keepEmDash)
    .replaceAll(DEV_STYLE_SCRIPT, keepEmDash);

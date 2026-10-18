/**
 * The site's languages. English is served unprefixed at `/`, Romanian under
 * `/ro/` (Astro i18n with `prefixDefaultLocale: false`, see astro.config.ts).
 */
export const LOCALES = ["en", "ro"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const isLocale = (value: string | undefined): value is Locale =>
  value === "en" || value === "ro";

/** `Astro.currentLocale` narrowed to a supported locale. */
export const toLocale = (value: string | undefined): Locale =>
  isLocale(value) ? value : DEFAULT_LOCALE;

/** The locale a URL path belongs to (for pages, like the 404, that Astro does not localize). */
export const pathLocale = (pathname: string): Locale =>
  pathname === "/ro" || pathname.startsWith("/ro/") ? "ro" : DEFAULT_LOCALE;

/** BCP 47 tag for `<html lang>` and `og:locale`. */
export const LANGUAGE_TAG: Record<Locale, string> = {
  en: "en-US",
  ro: "ro-RO",
};

/** Prefixes a site path with the locale segment (`/give` -> `/ro/give`). */
export const localePath = (locale: Locale, path: string): string => {
  if (locale === DEFAULT_LOCALE) {
    return path;
  }
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
};

/**
 * An entry's URL slug. EmDash ids a non-default-locale entry as
 * `<locale>/<slug>`, the way i18n routing prefixes its URL, so the prefix
 * comes off before the id goes into a path built with `localePath`.
 */
export const entrySlug = (id: string): string => {
  const [first, ...rest] = id.split("/");
  return rest.length > 0 && isLocale(first) ? rest.join("/") : id;
};

/**
 * CMS pages the site chrome links to directly (header buttons, footer), keyed
 * by locale. Renaming one of these pages' slugs in the CMS needs a change here.
 */
export const CHROME_PATHS = {
  give: { en: "/give", ro: "/ro/donatii" },
  live: { en: "/live", ro: "/ro/live" },
  prayer: { en: "/prayer", ro: "/ro/rugaciune" },
  visit: { en: "/visit", ro: "/ro/vizita" },
} as const satisfies Record<string, Record<Locale, string>>;

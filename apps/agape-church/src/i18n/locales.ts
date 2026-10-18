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

/** Routes that live in code rather than the CMS, keyed by locale. */
export const CONTACT_PATH: Record<Locale, string> = {
  en: "/contact",
  ro: "/ro/contact",
};

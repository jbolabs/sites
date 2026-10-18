/**
 * Data for the CMS routes, shared by the English and Romanian page files
 * (Astro i18n needs a file per locale prefix). Returns `null` when the entry
 * does not exist in the page's language, so the page can rewrite to the 404.
 * EmDash falls back to English for a missing translation (`fallbackLocale`);
 * served under `/ro/` that would be an English duplicate page, so it is
 * treated as not found.
 */
import type { AstroGlobal } from "astro";
import { decodeSlug, getSeoMeta } from "emdash";

import { site } from "../../site.config.ts";
import { entrySlug, localePath, toLocale } from "../i18n/locales.ts";
import type { Locale } from "../i18n/locales.ts";
import { ui } from "../i18n/ui.ts";
import {
  getAlternates,
  getHomePage,
  getMinistries,
  getMinistry,
  getPage,
} from "./content.ts";

const cache = (
  astro: AstroGlobal,
  hint: Parameters<NonNullable<AstroGlobal["cache"]>["set"]>[0]
) => {
  if (astro.cache?.enabled) {
    astro.cache.set(hint);
  }
};

export const loadHome = async (astro: AstroGlobal) => {
  const locale: Locale = toLocale(astro.currentLocale);
  const { cacheHint, entry: page, fallbackLocale } = await getHomePage(locale);
  if (!page || fallbackLocale !== undefined) {
    return null;
  }
  cache(astro, cacheHint);
  const seo = getSeoMeta(page, {
    defaultDescription: page.data.intro ?? site.description,
    path: localePath(locale, "/"),
    siteUrl: astro.url.origin,
  });
  return { alternates: await getAlternates("home", page.data.id), page, seo };
};

export const loadPage = async (astro: AstroGlobal) => {
  const locale: Locale = toLocale(astro.currentLocale);
  const slug = decodeSlug(astro.params.slug) ?? "";
  if (slug === "") {
    return null;
  }
  const {
    cacheHint,
    entry: page,
    fallbackLocale,
  } = await getPage(slug, locale);
  if (!page || fallbackLocale !== undefined) {
    return null;
  }
  cache(astro, cacheHint);
  const path = localePath(locale, `/${slug}`);
  const seo = getSeoMeta(page, {
    defaultDescription: page.data.intro,
    path,
    siteUrl: astro.url.origin,
  });
  const crumbs = [
    { label: ui(locale).home, path: localePath(locale, "/") },
    { label: page.data.title, path },
  ];
  return {
    alternates: await getAlternates("pages", page.data.id),
    crumbs,
    page,
    seo,
  };
};

/** The ministries hub page's slug in each language (its breadcrumb parent). */
const MINISTRIES_PAGE: Record<Locale, string> = {
  en: "/ministries",
  ro: "/lucrari",
};

export const loadMinistry = async (astro: AstroGlobal) => {
  const locale: Locale = toLocale(astro.currentLocale);
  const slug = decodeSlug(astro.params.slug) ?? "";
  if (slug === "") {
    return null;
  }
  const [{ cacheHint, entry: ministry, fallbackLocale }, all] =
    await Promise.all([getMinistry(slug, locale), getMinistries(locale)]);
  if (!ministry || fallbackLocale !== undefined) {
    return null;
  }
  cache(astro, cacheHint);
  cache(astro, all.cacheHint);
  const path = localePath(locale, `/ministries/${slug}`);
  const seo = getSeoMeta(ministry, {
    defaultDescription: ministry.data.summary,
    path,
    siteUrl: astro.url.origin,
  });
  const t = ui(locale);
  const crumbs = [
    { label: t.home, path: localePath(locale, "/") },
    { label: t.ministries, path: localePath(locale, MINISTRIES_PAGE[locale]) },
    { label: ministry.data.title, path },
  ];
  const others = all.entries.flatMap((entry) =>
    entry.id === ministry.id
      ? []
      : [
          {
            title: entry.data.title,
            url: localePath(locale, `/ministries/${entrySlug(entry.id)}`),
          },
        ]
  );
  return {
    alternates: await getAlternates("ministries", ministry.data.id),
    crumbs,
    ministry,
    others,
    seo,
  };
};

export type HomeData = NonNullable<Awaited<ReturnType<typeof loadHome>>>;
export type PageData = NonNullable<Awaited<ReturnType<typeof loadPage>>>;
export type MinistryData = NonNullable<
  Awaited<ReturnType<typeof loadMinistry>>
>;

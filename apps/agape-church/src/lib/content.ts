/**
 * Content queries. Every function takes the page's locale and returns plain
 * data plus the EmDash cache hints, so routes can register them with
 * `Astro.cache`.
 */
import {
  getEmDashCollection,
  getEmDashEntry,
  getMenuWithCacheHint,
  getSiteSettingsWithCacheHint,
  getTranslations,
} from "emdash";
import type { CacheHint } from "emdash";

import type { Home, Ministry, Page } from "../../emdash-env";
import { LOCALES, localePath } from "../i18n/locales.ts";
import type { Locale } from "../i18n/locales.ts";
import { isCurrent } from "./dates.ts";

export type MediaImage = NonNullable<Page["image"]>;

/** Blocks from any routable collection; all three allow the same block types. */
export type ContentBlock =
  | NonNullable<Home["content"]>[number]
  | NonNullable<Page["content"]>[number]
  | NonNullable<Ministry["content"]>[number];

export interface NavItem {
  readonly label: string;
  readonly url: string;
}

export interface ScheduleItem {
  readonly day: string;
  readonly name: string;
  readonly time: string;
}

export interface SiteChrome {
  readonly title: string;
  readonly tagline: string;
  readonly motto: string;
  readonly primary: readonly NavItem[];
  readonly footer: readonly NavItem[];
  readonly resources: readonly NavItem[];
  readonly schedule: readonly ScheduleItem[];
  readonly volunteer: {
    readonly title: string;
    readonly body: string;
    readonly giveLabel: string;
  };
  readonly cacheHints: readonly CacheHint[];
}

const menuItems = (menu: { items: { label: string; url: string }[] } | null) =>
  (menu?.items ?? []).map(({ label, url }) => ({ label, url }));

export const getSiteChrome = async (
  locale: Locale,
  fallbackTitle: string
): Promise<SiteChrome> => {
  const [settings, primary, footer, resources, text] = await Promise.all([
    getSiteSettingsWithCacheHint(),
    getMenuWithCacheHint("primary", { locale }),
    getMenuWithCacheHint("footer", { locale }),
    getMenuWithCacheHint("resources", { locale }),
    getEmDashEntry("site_text", "site", { locale }),
  ]);
  const site = text.entry?.data;
  return {
    cacheHints: [
      settings.cacheHint,
      primary.cacheHint,
      footer.cacheHint,
      resources.cacheHint,
      text.cacheHint,
    ],
    footer: menuItems(footer.data),
    motto: site?.motto ?? "",
    primary: menuItems(primary.data),
    resources: menuItems(resources.data),
    schedule: (site?.schedule ?? []).map(({ day, name, time }) => ({
      day,
      name,
      time,
    })),
    tagline: settings.data.tagline ?? "",
    title: settings.data.title ?? fallbackTitle,
    volunteer: {
      body: site?.volunteer_body ?? "",
      giveLabel: site?.give_label ?? "",
      title: site?.volunteer_title ?? "",
    },
  };
};

/** The weekly schedule alone, for sections that show service times. */
export const getSchedule = async (
  locale: Locale
): Promise<{ schedule: readonly ScheduleItem[]; cacheHint: CacheHint }> => {
  const { cacheHint, entry } = await getEmDashEntry("site_text", "site", {
    locale,
  });
  return {
    cacheHint,
    schedule: (entry?.data.schedule ?? []).map(({ day, name, time }) => ({
      day,
      name,
      time,
    })),
  };
};

export const getPage = async (slug: string, locale: Locale) =>
  await getEmDashEntry("pages", slug, { locale });

/** The home page lives in its own `home` collection (URL pattern `/`) so the sitemap lists `/`. */
export const getHomePage = async (locale: Locale) =>
  await getEmDashEntry("home", "home", { locale });

export const getMinistry = async (slug: string, locale: Locale) =>
  await getEmDashEntry("ministries", slug, { locale });

/** Every published ministry in the locale, in the order editors set. */
export const getMinistries = async (locale: Locale) =>
  await getEmDashCollection("ministries", {
    locale,
    orderBy: { sort_order: "asc" },
  });

/** Every published page in the locale, by title (the site map). */
export const getPages = async (locale: Locale) =>
  await getEmDashCollection("pages", { locale, orderBy: { title: "asc" } });

/**
 * Announcements still running on `today` (YYYY-MM-DD, the church's local
 * date), lowest sort order first.
 */
export const getAnnouncements = async (locale: Locale, today: string) => {
  const result = await getEmDashCollection("announcements", {
    locale,
    orderBy: { sort_order: "asc" },
  });
  return {
    cacheHint: result.cacheHint,
    entries: result.entries.filter((entry) =>
      isCurrent(entry.data.ends_on, today)
    ),
  };
};

/** Where the language switcher sends a visitor: the same page in each other language. */
export type Alternates = Partial<Record<Locale, string>>;

const COLLECTION_PATH = {
  home: () => "/",
  ministries: (slug: string) => `/ministries/${slug}`,
  pages: (slug: string) => `/${slug}`,
} as const;

/**
 * Paths of every published translation of a CMS entry, by locale. EmDash
 * emits the matching hreflang tags itself; this feeds the visible switcher.
 */
export const getAlternates = async (
  collection: keyof typeof COLLECTION_PATH,
  id: string
): Promise<Alternates> => {
  const { translations } = await getTranslations(collection, id);
  const alternates: Alternates = {};
  for (const translation of translations) {
    const locale = LOCALES.find(
      (candidate) => candidate === translation.locale
    );
    if (locale === undefined || translation.status !== "published") {
      continue;
    }
    if (collection === "home") {
      alternates[locale] = localePath(locale, "/");
    } else if (translation.slug !== null) {
      alternates[locale] = localePath(
        locale,
        COLLECTION_PATH[collection](translation.slug)
      );
    }
  }
  return alternates;
};

/**
 * Content queries for pages. Every function returns plain data plus the
 * EmDash cache hints, so routes can register them with `Astro.cache`.
 */
import {
  getEmDashCollection,
  getEmDashEntry,
  getMenuWithCacheHint,
  getSiteSettingsWithCacheHint,
} from "emdash";
import type { CacheHint } from "emdash";

import type { Announcement, Event, Sermon } from "../../emdash-env";
import { site } from "../../site.config";
import { dateIn, isoDate, scheduleOf } from "./calendar.ts";
import type { PlainDate, Scheduled } from "./calendar.ts";

export type MediaImage = NonNullable<Event["image"]>;
export type {
  Announcement,
  Event,
  Ministry,
  People,
  Sermon,
} from "../../emdash-env";

/** A published entry: its slug (`id`) and fields. */
export interface Entry<T> {
  readonly id: string;
  readonly data: T;
}

export interface NavItem {
  readonly label: string;
  readonly url: string;
}

export interface SiteChrome {
  readonly title: string;
  /** Settings → SEO → Default OG image; the layout falls back to `public/og-default.*`. */
  readonly socialImage: string | undefined;
  readonly tagline: string;
  readonly primary: readonly NavItem[];
  readonly footer: readonly NavItem[];
  readonly cacheHints: readonly CacheHint[];
}

const menuItems = (menu: { items: { label: string; url: string }[] } | null) =>
  (menu?.items ?? []).map(({ label, url }) => ({ label, url }));

export const getSiteChrome = async (
  fallbackTitle: string
): Promise<SiteChrome> => {
  const [settings, primary, footer] = await Promise.all([
    getSiteSettingsWithCacheHint(),
    getMenuWithCacheHint("primary"),
    getMenuWithCacheHint("footer"),
  ]);
  return {
    cacheHints: [settings.cacheHint, primary.cacheHint, footer.cacheHint],
    footer: menuItems(footer.data),
    primary: menuItems(primary.data),
    socialImage: settings.data.seo?.defaultOgImage?.url,
    tagline: settings.data.tagline ?? "",
    title: settings.data.title ?? fallbackTitle,
  };
};

/** External links (giving, YouTube) open in a new tab. */
export const isExternal = (url: string) => /^https?:\/\//u.test(url);

/** Today's date at the church. */
export const churchToday = (now: Date = new Date()): PlainDate =>
  dateIn(site.timeZone, now);

const ENTRY_DATE = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  timeZone: site.timeZone,
  year: "numeric",
});

/** A stored instant, or undefined when the field is empty or not a date. */
const instantOf = (iso: string | null | undefined): Date | undefined => {
  const instant = new Date(iso ?? "");
  return Number.isNaN(instant.getTime()) ? undefined : instant;
};

/** "October 25, 2026" for a stored instant, read at the church. */
export const formatEntryDate = (iso: string | null | undefined): string => {
  const instant = instantOf(iso);
  return instant === undefined ? "" : ENTRY_DATE.format(instant);
};

export const getPage = async (slug: string) =>
  await getEmDashEntry("pages", slug);

/** The home page lives in its own `home` collection (URL pattern `/`) so the sitemap lists `/`. */
export const getHomePage = async () => await getEmDashEntry("home", "home");

// News

const isActive = (announcement: Announcement, now: Date) => {
  // EmDash returns `null` for unset fields at runtime, whatever the generated type says.
  const expires = instantOf(announcement.expires_on);
  return expires === undefined || expires > now;
};

/** Current news (not past its end date), pinned first, then newest first. */
export const getCurrentNews = async (now: Date = new Date()) => {
  const all = await getEmDashCollection("announcements", {
    limit: 100,
    orderBy: { published_on: "desc" },
  });
  const current = all.entries.filter((entry) => isActive(entry.data, now));
  return {
    cacheHint: all.cacheHint,
    entries: [
      ...current.filter((entry) => entry.data.pinned === true),
      ...current.filter((entry) => entry.data.pinned !== true),
    ],
  };
};

export const getAnnouncement = async (slug: string) =>
  await getEmDashEntry("announcements", slug);

// Sermons

export const SERMONS_PER_PAGE = 12;

export const getSermons = async (page: number) =>
  await getEmDashCollection("sermons", {
    limit: SERMONS_PER_PAGE,
    offset: (page - 1) * SERMONS_PER_PAGE,
    orderBy: { preached_on: "desc" },
  });

const preachedOn = (entry: Entry<Sermon>) =>
  isoDate(churchToday(new Date(entry.data.preached_on)));

/** The most recent sermon (a morning sermon when the latest Sunday has one). */
export const getLatestSermon = async () => {
  const recent = await getEmDashCollection("sermons", {
    limit: 4,
    orderBy: { preached_on: "desc" },
  });
  const [newest] = recent.entries;
  const sameSunday = recent.entries.filter(
    (entry) => newest !== undefined && preachedOn(entry) === preachedOn(newest)
  );
  return {
    cacheHint: recent.cacheHint,
    entry:
      sameSunday.find((entry) => entry.data.service === "Morning worship") ??
      newest,
  };
};

export const getSermon = async (slug: string) =>
  await getEmDashEntry("sermons", slug);

/** Other sermons in a series, newest first. */
export const getSeries = async (series: string) =>
  await getEmDashCollection("sermons", {
    limit: 7,
    orderBy: { preached_on: "desc" },
    where: { series },
  });

// Events

export const getEvents = async () =>
  await getEmDashCollection("events", {
    limit: 200,
    orderBy: { title: "asc" },
  });

export const getEvent = async (slug: string) =>
  await getEmDashEntry("events", slug);

/** Events with a usable schedule (the rest have no time to show). */
export const scheduled = (
  entries: readonly Entry<Event>[]
): Scheduled<Entry<Event>>[] =>
  entries.flatMap((entry) => {
    const schedule = scheduleOf(entry.data, site.timeZone);
    return schedule === undefined ? [] : [{ item: entry, schedule }];
  });

/** Sunday's services in time order (events marked "Show with the Sunday service times"). */
export const sundayServices = (entries: readonly Entry<Event>[]) =>
  scheduled(entries)
    .filter(
      ({ item, schedule }) =>
        item.data.sunday_service === true &&
        schedule.repeats !== "once" &&
        schedule.weekday === "sunday"
    )
    .toSorted((left, right) => left.schedule.start - right.schedule.start);

// Ministries and people

export const getMinistries = async () =>
  await getEmDashCollection("ministries", {
    limit: 50,
    orderBy: { sort_order: "asc" },
  });

export const getMinistry = async (slug: string) =>
  await getEmDashEntry("ministries", slug);

export const getPeople = async () =>
  await getEmDashCollection("people", {
    limit: 50,
    orderBy: { sort_order: "asc" },
  });

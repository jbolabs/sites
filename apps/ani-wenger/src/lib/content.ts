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

import type { Service, Studio } from "../../emdash-env";

export type MediaImage = NonNullable<Service["image"]>;

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
  readonly studio: Studio | undefined;
  readonly cacheHints: readonly CacheHint[];
}

const menuItems = (menu: { items: { label: string; url: string }[] } | null) =>
  (menu?.items ?? []).map(({ label, url }) => ({ label, url }));

/** The salon, hours, and booking rules: one entry in the `studio` collection. */
export const getStudio = async () => await getEmDashEntry("studio", "studio");

export const getSiteChrome = async (
  fallbackTitle: string
): Promise<SiteChrome> => {
  const [settings, primary, footer, studio] = await Promise.all([
    getSiteSettingsWithCacheHint(),
    getMenuWithCacheHint("primary"),
    getMenuWithCacheHint("footer"),
    getStudio(),
  ]);
  return {
    cacheHints: [
      settings.cacheHint,
      primary.cacheHint,
      footer.cacheHint,
      studio.cacheHint,
    ],
    footer: menuItems(footer.data),
    primary: menuItems(primary.data),
    socialImage: settings.data.seo?.defaultOgImage?.url,
    studio: studio.entry?.data,
    tagline: settings.data.tagline ?? "",
    title: settings.data.title ?? fallbackTitle,
  };
};

export const getPage = async (slug: string) =>
  await getEmDashEntry("pages", slug);

/** The home page lives in its own `home` collection (URL pattern `/`) so the sitemap lists `/`. */
export const getHomePage = async () => await getEmDashEntry("home", "home");

/** Every published service in menu order (category, then the editor's order). */
export const getServices = async () => {
  const list = await getEmDashCollection("services", {
    orderBy: { sort_order: "asc" },
  });
  return { cacheHint: list.cacheHint, services: list.entries };
};

export const getService = async (slug: string) =>
  await getEmDashEntry("services", slug);

export const getQuestions = async (limit?: number) => {
  const order = { orderBy: { published_at: "desc" } } as const;
  const list = await getEmDashCollection(
    "questions",
    limit === undefined ? order : { ...order, limit }
  );
  return { cacheHint: list.cacheHint, questions: list.entries };
};

export const getQuestion = async (slug: string) =>
  await getEmDashEntry("questions", slug, {
    references: { products: { limit: 12 }, services: { limit: 6 } },
  });

/** Products in the editor's order; `featured` keeps only those marked for the home page. */
export const getProducts = async (options: { featured?: boolean } = {}) => {
  const list = await getEmDashCollection("products", {
    orderBy: { sort_order: "asc" },
  });
  const products =
    options.featured === true
      ? list.entries.filter((entry) => entry.data.featured === true)
      : list.entries;
  return { cacheHint: list.cacheHint, products };
};

export type ServiceEntry = Awaited<
  ReturnType<typeof getServices>
>["services"][number];
export type QuestionEntry = Awaited<
  ReturnType<typeof getQuestions>
>["questions"][number];
export type ProductEntry = Awaited<
  ReturnType<typeof getProducts>
>["products"][number];

export type { Product, Question, Service, Studio } from "../../emdash-env";

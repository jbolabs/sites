/**
 * EmDash's sidebar lists every built-in screen, including blog features (comments,
 * bylines, tags) a marketing site never uses; to a client that reads as a lot of
 * things they might have to manage. These are hidden unless a site lists them in
 * `nav.show`. The screens still exist; only their nav entries go.
 *
 * EmDash has no option to drop a built-in entry, so each one is matched by its link:
 * the routes are part of EmDash's admin URL scheme and do not move between releases.
 */

/** Hideable entries, keyed by name, valued by their path under the admin root. */
const OPTIONAL_NAV = {
  "byline-schema": "byline-schema",
  bylines: "bylines",
  calendar: "calendar",
  categories: "taxonomies/category",
  comments: "comments",
  import: "import/wordpress",
  sections: "sections",
  tags: "taxonomies/tag",
  widgets: "widgets",
} as const;

export type OptionalNavItem = keyof typeof OPTIONAL_NAV;

/** List controls that only filter by a hidden screen's data; matched by EmDash's own labels. */
const LIST_FILTERS = new Map<string, string>([
  ["bylines", 'main button[aria-label="Filter by byline"]'],
]);

const ADMIN_ROOT = "/_emdash/admin/";

const GROUP = "html[data-theme] [data-sidebar=content] [data-sidebar=group]";

/**
 * Entries listed right under Dashboard. EmDash files plugin pages in a last "Plugins"
 * group, under every collection; a page the client opens daily belongs on top. Kumo's
 * groups stack in a flex column, so the pinned entry's group and list dissolve into it
 * (`display: contents`) and the entry alone takes an order ahead of the rest; its
 * group's name goes when the entry was all it held. Each step names the group by its
 * child chain (group > menu > item > link): a `:has()` inside `:has()` is invalid CSS.
 */
const pinnedNavCss = (first: readonly string[]): string[] => {
  if (first.length === 0) {
    return [];
  }
  const links = first
    .map((path) => `a[href="${ADMIN_ROOT}${path.replace(/^\/+/u, "")}"]`)
    .join(", ");
  const item = "[data-sidebar=menu] > [data-sidebar=menu-item]";
  const group = `${GROUP}:has(> ${item} > :is(${links}))`;
  return [
    `${GROUP}:first-child{order:-2}`,
    `${group}, ${group} > [data-sidebar=menu]{display:contents}`,
    `html[data-theme] [data-sidebar=content] [data-sidebar=menu-item]:has(> :is(${links})){order:-1}`,
    `${GROUP}:has(> ${item}:only-child > :is(${links})) > [data-sidebar=group-label]{display:none}`,
  ];
};

/** The rule that hides every optional entry a site has not asked for, and puts `first` on top. */
export const adminNavCss = (
  show: readonly OptionalNavItem[] = [],
  first: readonly string[] = []
): string => {
  const links: string[] = [];
  const filters: string[] = [];
  for (const [name, path] of Object.entries(OPTIONAL_NAV)) {
    if (!show.some((shown) => shown === name)) {
      // Taxonomy links gain `?locale=` on translated sites, so a query string still matches.
      links.push(
        `a[href="${ADMIN_ROOT}${path}"]`,
        `a[href^="${ADMIN_ROOT}${path}?"]`
      );
      const filter = LIST_FILTERS.get(name);
      if (filter !== undefined) {
        filters.push(filter);
      }
    }
  }
  const rules = [
    ...(links.length === 0
      ? []
      : [
          `html[data-theme] [data-sidebar=menu-item]:has(> :is(${links.join(", ")})){display:none}`,
        ]),
    ...filters.map((filter) => `html[data-theme] ${filter}{display:none}`),
    ...pinnedNavCss(first),
  ];
  return rules.join("\n");
};

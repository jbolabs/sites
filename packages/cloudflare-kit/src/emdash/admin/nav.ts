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

/** The rule that hides every optional entry a site has not asked for. */
export const adminNavCss = (show: readonly OptionalNavItem[] = []): string => {
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
  ];
  return rules.join("\n");
};

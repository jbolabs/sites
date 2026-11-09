/**
 * The site's `lists` options on EmDash's content lists. `client/admin-marks.ts` marks
 * each cell and its header with what it holds (`data-admin-cell`), and a list is
 * recognized by its entries' links, which carry the collection slug.
 */
import type { ListOptions } from "./options.ts";

const ADMIN_ROOT = "/_emdash/admin/";

/**
 * At any width: rows the kit's columns fade (`fade` values, e.g. a cancelled booking),
 * and phone numbers kept whole, not broken at their space or hyphen.
 */
const COLUMN_RULES = [
  "html[data-theme] main tr:has([data-admin-fade]) > td{opacity:0.5}",
  "html[data-theme] main [data-admin-format=phone]{white-space:nowrap}",
];

export const adminListsCss = (
  lists: Readonly<Record<string, ListOptions>> = {}
): string => {
  const rules = Object.entries(lists).flatMap(([collection, list]) => {
    const entry = `a[href^="${ADMIN_ROOT}content/${collection}/"]`;
    const table = `html[data-theme] main table:has(${entry})`;
    const hidden = [
      ...(list.hideStatus === true ? ["status", "date"] : []),
      ...(list.columns === undefined ? [] : ["field"]),
    ];
    const cells = hidden.map((cell) => `[data-admin-cell=${cell}]`).join(", ");
    return [
      ...(hidden.length === 0
        ? []
        : [`${table} :is(th, td):is(${cells}){display:none}`]),
      // With the badge gone, a filter by publish status only confuses.
      ...(list.hideStatus === true
        ? [
            // Named by the rows' links, not the table: a `:has()` inside `:has()` is invalid CSS.
            `html[data-theme] main:has(tbody ${entry}) button[aria-label="Filter by status"]{display:none}`,
          ]
        : []),
    ];
  });
  return rules.length === 0 ? "" : [...rules, ...COLUMN_RULES].join("\n");
};

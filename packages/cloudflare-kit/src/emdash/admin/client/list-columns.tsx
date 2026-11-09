// oxlint-disable anti-slop/no-runtime-typeof, anti-slop/no-unknown-parameters, anti-slop/no-unsafe-dictionary-type -- EmDash hands each list cell the entry's stored fields as untyped JSON; `fieldText` is that boundary, and the admin bundle cannot load Effect Schema to decode them.
/**
 * The site's `lists` columns as EmDash content-list columns (the `contentListColumns`
 * export of a trusted plugin's admin bundle). EmDash renders them after its own
 * columns; `lists.ts` hides the ones they replace and `mobile.ts` lays them out as
 * card lines on a phone.
 */
import type { ComponentType } from "react";

import type { ListOptions } from "../options.ts";
import { columnText } from "./list-values.ts";

/** The part of EmDash's `ContentListColumnExtension` this bundle uses; the kit does not depend on the admin package. */
export interface ContentListColumn {
  readonly id: string;
  readonly label: string;
  readonly collections: readonly string[];
  readonly order: number;
  readonly cell: ComponentType<{
    readonly item: { readonly data: Readonly<Record<string, unknown>> };
  }>;
}

/** A stored text or number as its text; nothing for an empty or other value. */
export const fieldText = (value: unknown): string | undefined => {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }
  const text = String(value);
  return text.trim() === "" ? undefined : text;
};

export const contentListColumns = (
  lists: Readonly<Record<string, ListOptions>> = {},
  timeZone?: string,
  /** Only decides whether a date shows its year, so the bundle's load time is near enough. */
  now: Date = new Date()
): ContentListColumn[] =>
  Object.entries(lists).flatMap(([collection, list]) =>
    (list.columns ?? []).map((column, order) => {
      const fade = new Set(column.fade);
      const Cell: ContentListColumn["cell"] = ({ item }) => {
        const text = fieldText(item.data[column.field]);
        return (
          <span
            data-admin-fade={
              text !== undefined && fade.has(text) ? "" : undefined
            }
            data-admin-format={column.format}
          >
            {text === undefined
              ? ""
              : columnText(column, text, { now, timeZone })}
          </span>
        );
      };
      Cell.displayName = `ListColumn(${collection}.${column.field})`;
      return {
        cell: Cell,
        collections: [collection],
        id: `${collection}-${column.field}`,
        label: column.label,
        order,
      };
    })
  );

/**
 * How the kit's list columns (`options.ts` `ListColumn`) read a field's stored value.
 * Plain functions, so the formats are tested without a browser, and worker-safe, so a
 * site's own admin screens can show a phone number the same way
 * (`@jakebodea/cloudflare-kit/emdash/admin/format`).
 */
import type { ListColumn } from "../options.ts";

/** A US number as (949) 555-0142, with or without its leading 1; anything else as typed. */
export const formatPhone = (value: string): string => {
  const digits = value.replaceAll(/\D/gu, "");
  const local =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) {
    return value.trim();
  }
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Built once per locale, zone and year choice; a list renders one per row. */
const dateTimeFormatter = (
  locale: string | undefined,
  timeZone: string | undefined,
  withYear: boolean
): Intl.DateTimeFormat => {
  const key = `${locale ?? ""}|${timeZone ?? ""}|${String(withYear)}`;
  const cached = formatters.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone,
    weekday: "short",
  };
  if (withYear) {
    options.year = "numeric";
  }
  const formatter = new Intl.DateTimeFormat(locale, options);
  formatters.set(key, formatter);
  return formatter;
};

const yearIn = (instant: Date, timeZone: string | undefined): string =>
  dateTimeFormatter("en-US", timeZone, true)
    .formatToParts(instant)
    .find((part) => part.type === "year")?.value ?? "";

/** "Tue, Nov 10, 10:00 AM" in `timeZone`; the year only when it is not the current one. */
export const formatDateTime = (
  value: string,
  {
    locale,
    now,
    timeZone,
  }: {
    readonly locale?: string;
    readonly now: Date;
    readonly timeZone?: string;
  }
): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const withYear = yearIn(date, timeZone) !== yearIn(now, timeZone);
  return dateTimeFormatter(locale, timeZone, withYear).format(date);
};

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");

/** The text a column shows for a stored value (already read with `fieldText`). */
export const columnText = (
  column: Pick<ListColumn, "format" | "labels">,
  text: string,
  context: {
    readonly locale?: string;
    readonly now: Date;
    readonly timeZone?: string;
  }
): string => {
  if (column.format === "datetime") {
    return formatDateTime(text, context);
  }
  if (column.format === "phone") {
    return formatPhone(text);
  }
  return column.labels === undefined
    ? text
    : (column.labels[text] ?? capitalize(text));
};

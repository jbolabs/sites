/**
 * The salon facts pages show (address, phone, weekly hours), read from the
 * `studio` entry editors keep in "Salon and hours".
 */
import {
  formatTime,
  isWeekday,
  parseLocalTime,
  WEEKDAYS,
} from "./booking/calendar.ts";
import type { Weekday } from "./booking/calendar.ts";
import type { Studio } from "./content.ts";

export interface HoursLine {
  readonly days: string;
  readonly times: string;
}

const DAY_LABELS: Record<Weekday, string> = {
  friday: "Friday",
  monday: "Monday",
  saturday: "Saturday",
  sunday: "Sunday",
  thursday: "Thursday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
};

/** Monday first, the way people read a week of opening hours. */
const WEEK: readonly Weekday[] = [...WEEKDAYS.slice(1), "sunday"];

/** One row of opening hours in minutes, or nothing when an editor typed it badly. */
const openRange = (row: Studio["hours"][number]) => {
  const opens = parseLocalTime(row.opens);
  const closes = parseLocalTime(row.closes);
  if (opens === undefined || closes === undefined) {
    return [];
  }
  return closes > opens ? [{ closes, opens }] : [];
};

const timesFor = (studio: Studio, day: Weekday): string => {
  const ranges = studio.hours
    .flatMap((row) => (row.day === day ? openRange(row) : []))
    .toSorted((a, b) => a.opens - b.opens);
  return ranges.length === 0
    ? "Closed"
    : ranges
        .map(
          (range) => `${formatTime(range.opens)} to ${formatTime(range.closes)}`
        )
        .join(", ");
};

/** Consecutive days with the same hours collapse: "Tuesday to Friday: 9:00 AM to 6:00 PM". */
export const hoursLines = (studio: Studio): HoursLine[] => {
  const lines: { first: Weekday; last: Weekday; times: string }[] = [];
  for (const day of WEEK) {
    const times = timesFor(studio, day);
    const previous = lines.at(-1);
    if (previous !== undefined && previous.times === times) {
      previous.last = day;
    } else {
      lines.push({ first: day, last: day, times });
    }
  }
  return lines.map(({ first, last, times }) => ({
    days:
      first === last
        ? DAY_LABELS[first]
        : `${DAY_LABELS[first]} to ${DAY_LABELS[last]}`,
    times,
  }));
};

/** schema.org `openingHoursSpecification` from the weekly hours. */
export const openingHoursSpecification = (studio: Studio) =>
  studio.hours.flatMap((row) =>
    isWeekday(row.day)
      ? [
          {
            "@type": "OpeningHoursSpecification",
            closes: row.closes,
            dayOfWeek: `https://schema.org/${DAY_LABELS[row.day]}`,
            opens: row.opens,
          },
        ]
      : []
  );

/** "James Mathew Salon, 123 Main St, Laguna Niguel, CA 92677" without empty parts. */
export const addressLine = (
  studio: Pick<
    Studio,
    "salon_name" | "street" | "city" | "region" | "postal_code"
  >
): string =>
  [
    studio.salon_name,
    studio.street,
    [studio.city, [studio.region, studio.postal_code].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", "),
  ]
    .filter((part) => part !== undefined && part !== null && part !== "")
    .join(", ");

/** `tel:` link for a phone number typed any way ("949-275-6251", "(949) 275 6251"). */
export const telHref = (phone: string): string =>
  `tel:+1${phone.replaceAll(/\D/gu, "").replace(/^1(?=\d{10}$)/u, "")}`;

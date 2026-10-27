/**
 * iCalendar (RFC 5545) for church events: one event's "Add to calendar" file
 * and the whole calendar as a feed members subscribe to once. Repeating events
 * carry an RRULE and wall-clock times in the church's zone (with its VTIMEZONE),
 * so a weekly 10:00 am service stays at 10:00 am across daylight saving.
 */
import type { PlainDate, Schedule, Weekday } from "./calendar.ts";
import { nextDates } from "./calendar.ts";

export interface CalendarItem {
  /** Stable across edits, so subscribed calendars update the event in place. */
  readonly uid: string;
  readonly summary: string;
  readonly schedule: Schedule;
  readonly description?: string | undefined;
  readonly location?: string | undefined;
  readonly url?: string | undefined;
}

/** Drops control characters (line breaks are already escaped by then). */
const printableOnly = (text: string) => {
  let result = "";
  for (let index = 0; index < text.length; index += 1) {
    const code = text.codePointAt(index) ?? 0;
    if (code >= 32 && code !== 127) {
      result += text.charAt(index);
    }
  }
  return result;
};

/** RFC 5545 TEXT: escape backslash, semicolon, and comma; every line break becomes `\n`. */
export const escapeText = (text: string): string =>
  printableOnly(
    text
      .replaceAll("\\", String.raw`\\`)
      .replaceAll(";", String.raw`\;`)
      .replaceAll(",", String.raw`\,`)
      .replaceAll(/\r\n|\r|\n/gu, String.raw`\n`)
  );

const encoder = new TextEncoder();

/** Lines longer than 75 octets continue on the next line after a space. */
const fold = (line: string): string => {
  if (encoder.encode(line).length <= 75) {
    return line;
  }
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    const limit = parts.length === 0 ? 75 : 74;
    if (encoder.encode(current + char).length > limit) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join("\r\n ");
};

const pad = (value: number) => String(value).padStart(2, "0");

const localStamp = (date: PlainDate, minutes: number) =>
  `${date.year}${pad(date.month)}${pad(date.day)}T${pad(Math.floor(minutes / 60))}${pad(minutes % 60)}00`;

const utcStamp = (instant: Date) =>
  instant
    .toISOString()
    .replaceAll(/[-:]/gu, "")
    .replace(/\.\d{3}/u, "");

const BYDAY: Record<Weekday, string> = {
  friday: "FR",
  monday: "MO",
  saturday: "SA",
  sunday: "SU",
  thursday: "TH",
  tuesday: "TU",
  wednesday: "WE",
};

export const recurrenceRule = (schedule: Schedule): string | undefined => {
  if (schedule.repeats === "once") {
    return undefined;
  }
  const day = BYDAY[schedule.weekday];
  const rules = {
    first: `FREQ=MONTHLY;BYDAY=1${day}`,
    first_third: `FREQ=MONTHLY;BYDAY=1${day},3${day}`,
    weekly: `FREQ=WEEKLY;BYDAY=${day}`,
  } as const;
  return rules[schedule.repeats];
};

/** US Pacific rules since 2007; the church's zone. */
const PACIFIC = [
  "BEGIN:VTIMEZONE",
  "TZID:America/Los_Angeles",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0800",
  "TZOFFSETTO:-0700",
  "TZNAME:PDT",
  "DTSTART:20070311T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0700",
  "TZOFFSETTO:-0800",
  "TZNAME:PST",
  "DTSTART:20071104T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

const DEFAULT_LENGTH_MINUTES = 60;

const eventLines = (
  item: CalendarItem,
  today: PlainDate,
  now: Date
): string[] => {
  const { schedule } = item;
  // Repeating events start at their next date; a past one-time event keeps its own.
  const first =
    schedule.repeats === "once"
      ? schedule.date
      : nextDates(schedule, today, 1)[0];
  if (first === undefined) {
    return [];
  }
  const end = schedule.end ?? schedule.start + DEFAULT_LENGTH_MINUTES;
  const rule = recurrenceRule(schedule);
  return [
    "BEGIN:VEVENT",
    `UID:${item.uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART;TZID=America/Los_Angeles:${localStamp(first, schedule.start)}`,
    `DTEND;TZID=America/Los_Angeles:${localStamp(first, end)}`,
    ...(rule === undefined ? [] : [`RRULE:${rule}`]),
    `SUMMARY:${escapeText(item.summary)}`,
    ...(item.description === undefined
      ? []
      : [`DESCRIPTION:${escapeText(item.description)}`]),
    ...(item.location === undefined
      ? []
      : [`LOCATION:${escapeText(item.location)}`]),
    ...(item.url === undefined ? [] : [`URL:${item.url}`]),
    "END:VEVENT",
  ];
};

export const calendarFile = (
  items: readonly CalendarItem[],
  options: {
    readonly name: string;
    readonly today: PlainDate;
    readonly now: Date;
  }
): string =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Grace Church Laguna Niguel//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(options.name)}`,
    "X-WR-TIMEZONE:America/Los_Angeles",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
    ...PACIFIC,
    ...items.flatMap((item) => eventLines(item, options.today, options.now)),
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n")
    .concat("\r\n");

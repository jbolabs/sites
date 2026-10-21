/**
 * iCalendar (RFC 5545) for one appointment (the client's "add to calendar"
 * file) and for Ani's subscribed calendar feed. Times are UTC, so every
 * calendar app shows them in its own zone.
 */
export interface CalendarEvent {
  readonly uid: string;
  readonly start: Date;
  readonly end: Date;
  readonly summary: string;
  readonly description?: string;
  readonly location?: string;
  readonly cancelled?: boolean;
  /** Last change; calendar apps use it to replace older copies of the event. */
  readonly updated: Date;
}

const stamp = (date: Date) =>
  date
    .toISOString()
    .replaceAll(/[-:]/gu, "")
    .replace(/\.\d{3}/u, "");

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

/**
 * RFC 5545 TEXT: escape backslash, semicolon, and comma; every kind of line
 * break becomes a literal `\n`. A bare CR left in a booker's name would let
 * them start a new property (a fake event) in Ani's feed.
 */
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

const eventLines = (event: CalendarEvent): string[] => [
  "BEGIN:VEVENT",
  `UID:${event.uid}`,
  `DTSTAMP:${stamp(event.updated)}`,
  `LAST-MODIFIED:${stamp(event.updated)}`,
  `DTSTART:${stamp(event.start)}`,
  `DTEND:${stamp(event.end)}`,
  `SUMMARY:${escapeText(event.summary)}`,
  ...(event.description === undefined
    ? []
    : [`DESCRIPTION:${escapeText(event.description)}`]),
  ...(event.location === undefined
    ? []
    : [`LOCATION:${escapeText(event.location)}`]),
  `STATUS:${event.cancelled === true ? "CANCELLED" : "CONFIRMED"}`,
  "END:VEVENT",
];

export const calendarFile = (
  events: readonly CalendarEvent[],
  name: string
): string =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ani Wenger//Appointments//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
    ...events.flatMap(eventLines),
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n")
    .concat("\r\n");

/** A Google Calendar "add event" link, for people without a calendar app that opens .ics files. */
export const googleCalendarUrl = (event: CalendarEvent): string => {
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", event.summary);
  url.searchParams.set("dates", `${stamp(event.start)}/${stamp(event.end)}`);
  if (event.description !== undefined) {
    url.searchParams.set("details", event.description);
  }
  if (event.location !== undefined) {
    url.searchParams.set("location", event.location);
  }
  return url.href;
};

/**
 * Ani's own work calendar as busy time. She books clients who text her in
 * Apple Calendar; the calendar's public iCloud link (an iCalendar file) is read
 * here, and every event on it blocks its time on the booking page, all-day
 * events included. Only start and end are kept: titles name her clients and
 * never leave this function.
 *
 * Pure: the caller fetches the file and passes the clock in. Recurring events
 * are expanded with ical.js; wall-clock times are turned into instants with the
 * salon clock (`calendar.ts`), which knows every IANA zone's daylight saving,
 * so a calendar's VTIMEZONE rules are only a fallback.
 */
import { Option, Schema } from "effect";
import ICAL from "ical.js";

import type { Busy } from "./availability.ts";
import { fromLocal } from "./calendar.ts";

/** A recurring event is expanded at most this far, so a broken rule cannot spin. */
const MAX_OCCURRENCES_PER_EVENT = 20_000;

/** The property that marks a changed occurrence of a recurring event. */
const RECURRENCE_ID = "recurrence-id";

const pad = (value: number) => String(value).padStart(2, "0");

const knownZones = new Map<string, boolean>();

const isIanaZone = (tzid: string): boolean => {
  const known = knownZones.get(tzid);
  if (known !== undefined) {
    return known;
  }
  let valid = true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tzid }).format(0);
  } catch {
    valid = false;
  }
  knownZones.set(tzid, valid);
  return valid;
};

/**
 * The instant an iCalendar time stands for. `tzid` is the event's own zone
 * (expanded occurrences lose it); a date with no zone at all is read on the
 * salon's clock, the way her phone shows it.
 */
const instant = (
  time: ICAL.Time,
  tzid: string | undefined,
  timeZone: string
): Date => {
  const date = `${time.year}-${pad(time.month)}-${pad(time.day)}`;
  if (time.isDate) {
    return fromLocal(date, 0, timeZone);
  }
  if (time.zone === ICAL.Timezone.utcTimezone) {
    return new Date(
      Date.UTC(
        time.year,
        time.month - 1,
        time.day,
        time.hour,
        time.minute,
        time.second
      )
    );
  }
  const minutes = time.hour * 60 + time.minute;
  const seconds = time.second * 1000;
  if (tzid !== undefined && isIanaZone(tzid)) {
    return new Date(fromLocal(date, minutes, tzid).getTime() + seconds);
  }
  const { zone } = time;
  if (
    zone !== undefined &&
    zone !== null &&
    zone !== ICAL.Timezone.localTimezone
  ) {
    return new Date(time.toUnixTime() * 1000);
  }
  return new Date(fromLocal(date, minutes, timeZone).getTime() + seconds);
};

const decodeTzid = Schema.decodeUnknownOption(Schema.NonEmptyString);

/** The TZID an event names for one of its times, if any; UTC and floating times name none. */
const zoneOf = (
  component: ICAL.Component,
  property: "dtend" | "dtstart" | typeof RECURRENCE_ID
): string | undefined => {
  const found = component.getFirstProperty(property);
  return found === null
    ? undefined
    : Option.getOrUndefined(decodeTzid(found.getParameter("tzid")));
};

const cancelled = (component: ICAL.Component) =>
  String(component.getFirstPropertyValue("status") ?? "").toUpperCase() ===
  "CANCELLED";

/** End of an event with no DTEND or DURATION: a day for a date, otherwise the start. */
const endOf = (start: Date, end: Date, allDay: boolean): Date =>
  end.getTime() > start.getTime() || !allDay
    ? end
    : new Date(start.getTime() + 86_400_000);

/** Overlapping or touching blocks become one, in start order. */
export const mergeBusy = (blocks: readonly Busy[]): Busy[] => {
  const sorted = blocks.toSorted(
    (a, b) => a.start.getTime() - b.start.getTime()
  );
  const merged: Busy[] = [];
  for (const block of sorted) {
    const last = merged.at(-1);
    if (last !== undefined && block.start.getTime() <= last.end.getTime()) {
      if (block.end.getTime() > last.end.getTime()) {
        merged[merged.length - 1] = { end: block.end, start: last.start };
      }
    } else {
      merged.push({ end: block.end, start: block.start });
    }
  }
  return merged;
};

/** The calendar file could not be read as a calendar. */
export class NotACalendarError extends Error {
  override readonly name = "NotACalendarError";
}

interface Window {
  readonly from: Date;
  readonly to: Date;
  readonly timeZone: string;
}

const parseCalendar = (file: string): ICAL.Component => {
  let calendar: ICAL.Component;
  try {
    calendar = ICAL.Component.fromString(file);
  } catch (error) {
    throw new NotACalendarError("Not an iCalendar file", { cause: error });
  }
  if (calendar.name !== "vcalendar") {
    throw new NotACalendarError("Not an iCalendar file");
  }
  return calendar;
};

/**
 * A changed occurrence of a recurring event is its own VEVENT with a
 * RECURRENCE-ID: the instants it replaces, by event UID.
 */
const replacedOccurrences = (
  events: readonly ICAL.Component[],
  timeZone: string
): Map<string, Set<number>> => {
  const replaced = new Map<string, Set<number>>();
  for (const component of events.filter((event) =>
    event.hasProperty(RECURRENCE_ID)
  )) {
    const event = new ICAL.Event(component);
    const original = instant(
      event.recurrenceId,
      zoneOf(component, RECURRENCE_ID) ?? zoneOf(component, "dtstart"),
      timeZone
    ).getTime();
    replaced.set(
      event.uid,
      (replaced.get(event.uid) ?? new Set()).add(original)
    );
  }
  return replaced;
};

const isDone = (time: ICAL.Time | null | undefined): time is null | undefined =>
  time === undefined || time === null;

/** Every busy stretch one VEVENT stands for, recurring ones expanded up to `to`. */
const eventBusy = (
  component: ICAL.Component,
  replaced: ReadonlyMap<string, ReadonlySet<number>>,
  { timeZone, to }: Window
): Busy[] => {
  const event = new ICAL.Event(component);
  const startZone = zoneOf(component, "dtstart");
  const endZone = zoneOf(component, "dtend") ?? startZone;
  const allDay = event.startDate.isDate;
  const block = (startTime: ICAL.Time, endTime: ICAL.Time): Busy => {
    const start = instant(startTime, startZone, timeZone);
    return {
      end: endOf(start, instant(endTime, endZone, timeZone), allDay),
      start,
    };
  };
  if (component.hasProperty(RECURRENCE_ID) || !event.isRecurring()) {
    return [block(event.startDate, event.endDate)];
  }
  const skipped = replaced.get(event.uid) ?? new Set<number>();
  const blocks: Busy[] = [];
  const iterator = event.iterator();
  let next: ICAL.Time | null | undefined = iterator.next();
  for (
    let count = 0;
    !isDone(next) && count < MAX_OCCURRENCES_PER_EVENT;
    count += 1
  ) {
    const occurrence = block(next, event.getOccurrenceDetails(next).endDate);
    if (occurrence.start.getTime() >= to.getTime()) {
      break;
    }
    if (!skipped.has(occurrence.start.getTime())) {
      blocks.push(occurrence);
    }
    next = iterator.next();
  }
  return blocks;
};

const inWindow = ({ end, start }: Busy, { from, to }: Window) =>
  !Number.isNaN(start.getTime()) &&
  end.getTime() > start.getTime() &&
  start.getTime() < to.getTime() &&
  end.getTime() > from.getTime();

/**
 * Every busy stretch in an iCalendar file that overlaps [from, to), merged.
 * Cancelled events and cancelled occurrences block nothing.
 */
export const busyFromCalendar = (file: string, window: Window): Busy[] => {
  const calendar = parseCalendar(file);
  for (const zone of calendar.getAllSubcomponents("vtimezone")) {
    ICAL.TimezoneService.register(zone);
  }
  const events = calendar.getAllSubcomponents("vevent");
  const replaced = replacedOccurrences(events, window.timeZone);
  return mergeBusy(
    events.flatMap((component) =>
      cancelled(component)
        ? []
        : eventBusy(component, replaced, window).filter((block) =>
            inWindow(block, window)
          )
    )
  );
};

/**
 * The address to fetch for a calendar link as Ani pastes it: iPhone shares
 * `webcal://`, which is the same file over https. Anything that is not a web
 * address is refused.
 */
export const calendarAddress = (pasted: string): string | undefined => {
  const trimmed = pasted.trim();
  const candidate = /^webcals?:\/\//iu.test(trimmed)
    ? trimmed.replace(/^webcals?:\/\//iu, "https://")
    : trimmed;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return undefined;
  }
  if (url.protocol === "http:") {
    url.protocol = "https:";
  }
  return url.protocol === "https:" && url.hostname.includes(".")
    ? url.toString()
    : undefined;
};

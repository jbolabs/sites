/**
 * Wall-clock dates and times in the salon's time zone. Workers run in UTC, and
 * opening hours are local ("Tuesday 9:00 to 17:00 in Laguna Niguel"), so every
 * conversion between the two goes through here.
 *
 * A local date is `YYYY-MM-DD`; a local time is minutes after midnight. Both
 * are plain values so the booking island can share them without a date library.
 */
export const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const LOCAL_DATE = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/u;
const LOCAL_TIME = /^(?<hours>[01]\d|2[0-3]):(?<minutes>[0-5]\d)$/u;
const MINUTES_PER_DAY = 1440;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = MINUTES_PER_DAY * MS_PER_MINUTE;

const dateParts = (date: string): [number, number, number] => {
  const groups = LOCAL_DATE.exec(date)?.groups;
  if (groups?.year === undefined || groups.month === undefined) {
    throw new RangeError(`Not a YYYY-MM-DD date: ${date}`);
  }
  return [Number(groups.year), Number(groups.month), Number(groups.day)];
};

/** Whether `value` names a weekday, narrowing it for callers. */
export const isWeekday = (value: string): value is Weekday =>
  WEEKDAYS.some((day) => day === value);

export const isLocalDate = (value: string): boolean => {
  const groups = LOCAL_DATE.exec(value)?.groups;
  if (groups === undefined) {
    return false;
  }
  const [year, month, day] = dateParts(value);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
};

/** `HH:MM` (24-hour) to minutes after midnight, or `undefined` when malformed. */
export const parseLocalTime = (value: string): number | undefined => {
  const groups = LOCAL_TIME.exec(value.trim())?.groups;
  if (groups?.hours === undefined || groups.minutes === undefined) {
    return undefined;
  }
  return Number(groups.hours) * 60 + Number(groups.minutes);
};

const pad = (value: number) => String(value).padStart(2, "0");

/** Minutes after midnight to `HH:MM`. */
export const localTime = (minutes: number): string =>
  `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

const fromEpochDay = (epochDay: number): string => {
  const date = new Date(epochDay * MS_PER_DAY);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

const toEpochDay = (date: string): number => {
  const [year, month, day] = dateParts(date);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
};

export const addDays = (date: string, days: number): string =>
  fromEpochDay(toEpochDay(date) + days);

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export const daysBetween = (from: string, to: string): number =>
  toEpochDay(to) - toEpochDay(from);

export const weekday = (date: string): Weekday => {
  // 1970-01-01 was a Thursday (index 4).
  const index = (((toEpochDay(date) + 4) % 7) + 7) % 7;
  return WEEKDAYS[index] ?? "sunday";
};

const formatters = new Map<string, Intl.DateTimeFormat>();

const partsFormatter = (timeZone: string): Intl.DateTimeFormat => {
  const cached = formatters.get(timeZone);
  if (cached !== undefined) {
    return cached;
  }
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  });
  formatters.set(timeZone, formatter);
  return formatter;
};

/** A wall-clock reading: a local date and minutes after midnight. */
export interface LocalDateTime {
  readonly date: string;
  readonly minutes: number;
}

/** The local date and time an instant shows on a clock in `timeZone`. */
export const toLocal = (instant: Date, timeZone: string): LocalDateTime => {
  const parts = Object.fromEntries(
    partsFormatter(timeZone)
      .formatToParts(instant)
      .map((part) => [part.type, part.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
};

/** How far `timeZone` is ahead of UTC at `instant`, in minutes (-420 for PDT). */
const offsetMinutes = (instant: Date, timeZone: string): number => {
  const local = toLocal(instant, timeZone);
  const asUtc = toEpochDay(local.date) * MINUTES_PER_DAY + local.minutes;
  return asUtc - Math.floor(instant.getTime() / MS_PER_MINUTE);
};

/**
 * The instant a wall clock in `timeZone` reads `date` at `minutes`. Times that
 * do not exist (the hour skipped when clocks spring forward) resolve to the hour before,
 * which never matters for salon hours.
 */
export const fromLocal = (
  date: string,
  minutes: number,
  timeZone: string
): Date => {
  const wall = (toEpochDay(date) * MINUTES_PER_DAY + minutes) * MS_PER_MINUTE;
  const first = wall - offsetMinutes(new Date(wall), timeZone) * MS_PER_MINUTE;
  const second =
    wall - offsetMinutes(new Date(first), timeZone) * MS_PER_MINUTE;
  return new Date(second);
};

/** "9:30 AM", the way the site shows times. */
export const formatTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const suffix = hours < 12 ? "AM" : "PM";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${pad(minutes % 60)} ${suffix}`;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const capitalize = (value: string) =>
  `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

/** "Tuesday, October 21" (with the year when it differs from `currentYear`). */
export const formatDate = (date: string, currentYear?: number): string => {
  const [year, month, day] = dateParts(date);
  const base = `${capitalize(weekday(date))}, ${MONTHS[month - 1] ?? ""} ${day}`;
  return currentYear === undefined || currentYear === year
    ? base
    : `${base}, ${year}`;
};

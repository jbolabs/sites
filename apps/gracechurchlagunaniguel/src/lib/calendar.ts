/**
 * The church calendar as pure functions. Events repeat by rule (every week, the
 * first week of the month, the first and third weeks) or happen once, at a
 * wall-clock time in the church's time zone. Everything works on plain
 * calendar dates; only "what day is it at the church" needs the clock, and the
 * caller passes it in.
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

export type Repeats = "weekly" | "first" | "first_third" | "once";

/** A calendar date with no time zone (month is 1 to 12). */
export interface PlainDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

interface Times {
  /** Minutes after midnight, church time. */
  readonly start: number;
  readonly end?: number;
}

/** A one-time event has a date; a repeating one has a weekday and a rule. */
export type Schedule =
  | (Times & { readonly repeats: "once"; readonly date: PlainDate })
  | (Times & {
      readonly repeats: Exclude<Repeats, "once">;
      readonly weekday: Weekday;
    });

/**
 * How often an event happens, as editors pick it in the CMS. The options are
 * written for volunteers, so they read as words, not codes.
 */
export const REPEAT_OPTIONS = {
  "Every week": "weekly",
  "First and third weeks of the month": "first_third",
  "First week of the month": "first",
  "One date only": "once",
} as const satisfies Record<string, Repeats>;

/** The CMS fields an event carries (EmDash returns `null` for unset fields). */
export interface ScheduleFields {
  readonly repeats?: string | null;
  readonly weekday?: string | null;
  readonly date?: string | null;
  readonly start_time?: string | null;
  readonly end_time?: string | null;
}

const CLOCK = /^(?<hours>[01]?\d|2[0-3]):(?<minutes>[0-5]\d)$/u;
const MINUTES_PER_HOUR = 60;
const NOON = 12 * MINUTES_PER_HOUR;
const DAY_MS = 86_400_000;

/** "18:30" as minutes after midnight, or undefined when it is not a 24-hour time. */
export const parseClock = (
  value: string | null | undefined
): number | undefined => {
  const groups = CLOCK.exec(value?.trim() ?? "")?.groups;
  if (groups?.hours === undefined || groups.minutes === undefined) {
    return undefined;
  }
  return Number(groups.hours) * MINUTES_PER_HOUR + Number(groups.minutes);
};

const repeatsFor = (option: string): Repeats | undefined =>
  Object.entries(REPEAT_OPTIONS).find(([label]) => label === option)?.[1];

const isWeekday = (value: string): value is Weekday =>
  WEEKDAYS.some((option) => option === value);

/** The calendar date at the church when `instant` happens. */
export const dateIn = (timeZone: string, instant: Date): PlainDate => {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "numeric",
    timeZone,
    year: "numeric",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((entry) => entry.type === type)?.value);
  return { day: part("day"), month: part("month"), year: part("year") };
};

/** Minutes after midnight at the church when `instant` happens. */
export const clockIn = (timeZone: string, instant: Date): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hourCycle: "h23",
    minute: "numeric",
    timeZone,
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((entry) => entry.type === type)?.value);
  return part("hour") * MINUTES_PER_HOUR + part("minute");
};

/**
 * The schedule an event's fields describe, or undefined when they describe no
 * time (no start, a repeating event without a day, a one-time event without a date).
 */
export const scheduleOf = (
  fields: ScheduleFields,
  timeZone: string
): Schedule | undefined => {
  const start = parseClock(fields.start_time);
  const repeats = repeatsFor(fields.repeats ?? "Every week");
  if (start === undefined || repeats === undefined) {
    return undefined;
  }
  const end = parseClock(fields.end_time);
  const times: Times =
    end !== undefined && end > start ? { end, start } : { start };
  if (repeats === "once") {
    const instant = new Date(fields.date ?? "");
    return Number.isNaN(instant.getTime())
      ? undefined
      : { ...times, date: dateIn(timeZone, instant), repeats };
  }
  // Editors pick "Wednesday"; the schedule keeps the lowercase name.
  const weekday = fields.weekday?.toLowerCase() ?? "";
  return isWeekday(weekday) ? { ...times, repeats, weekday } : undefined;
};

const toUtc = (date: PlainDate) =>
  Date.UTC(date.year, date.month - 1, date.day);

const fromUtc = (ms: number): PlainDate => {
  const value = new Date(ms);
  return {
    day: value.getUTCDate(),
    month: value.getUTCMonth() + 1,
    year: value.getUTCFullYear(),
  };
};

export const addDays = (date: PlainDate, days: number): PlainDate =>
  fromUtc(toUtc(date) + days * DAY_MS);

export const weekdayOf = (date: PlainDate): Weekday =>
  WEEKDAYS[new Date(toUtc(date)).getUTCDay()] ?? "sunday";

export const sameDate = (left: PlainDate, right: PlainDate) =>
  toUtc(left) === toUtc(right);

export const compareDates = (left: PlainDate, right: PlainDate) =>
  toUtc(left) - toUtc(right);

/** Which week of its month a date falls in (days 1 to 7 are week 1). */
const weekOfMonth = (date: PlainDate) => Math.ceil(date.day / 7);

export const occursOn = (schedule: Schedule, date: PlainDate): boolean => {
  if (schedule.repeats === "once") {
    return sameDate(schedule.date, date);
  }
  if (weekdayOf(date) !== schedule.weekday) {
    return false;
  }
  if (schedule.repeats === "first") {
    return weekOfMonth(date) === 1;
  }
  if (schedule.repeats === "first_third") {
    return weekOfMonth(date) === 1 || weekOfMonth(date) === 3;
  }
  return true;
};

/** The next `count` dates on or after `from` (searching a little over a year ahead). */
export const nextDates = (
  schedule: Schedule,
  from: PlainDate,
  count: number
): PlainDate[] => {
  const dates: PlainDate[] = [];
  for (let offset = 0; offset < 400 && dates.length < count; offset += 1) {
    const date = addDays(from, offset);
    if (occursOn(schedule, date)) {
      dates.push(date);
    }
  }
  return dates;
};

export interface Scheduled<T> {
  readonly item: T;
  readonly schedule: Schedule;
}

export interface AgendaDay<T> {
  readonly date: PlainDate;
  readonly items: readonly Scheduled<T>[];
}

/** Each of the `days` days from `from`, with what happens that day in start-time order. */
export const agenda = <T>(
  events: readonly Scheduled<T>[],
  from: PlainDate,
  days: number
): AgendaDay<T>[] =>
  Array.from({ length: days }, (_, offset) => {
    const date = addDays(from, offset);
    return {
      date,
      items: events
        .filter(({ schedule }) => occursOn(schedule, date))
        .toSorted((left, right) => left.schedule.start - right.schedule.start),
    };
  });

/** "6:30 pm", "10:00 am", "12:00 pm". */
export const formatClock = (minutes: number): string => {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = String(minutes % MINUTES_PER_HOUR).padStart(2, "0");
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}:${rest} ${minutes < NOON ? "am" : "pm"}`;
};

/** "6:30 to 8:00 pm" when both ends share am/pm, else "11:30 am to 1:00 pm". */
export const formatTimes = (schedule: Schedule): string => {
  if (schedule.end === undefined) {
    return formatClock(schedule.start);
  }
  const start = formatClock(schedule.start);
  const end = formatClock(schedule.end);
  const sameHalf = schedule.start < NOON === schedule.end < NOON;
  return `${sameHalf ? start.slice(0, -3) : start} to ${end}`;
};

const capitalize = (text: string) =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  weekday: "long",
});

/** "Wednesday, October 28". */
export const formatDate = (date: PlainDate): string =>
  DATE_FORMAT.format(new Date(toUtc(date)));

const MONTH_DAY_FORMAT = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** "October 28". */
export const formatMonthDay = (date: PlainDate): string =>
  MONTH_DAY_FORMAT.format(new Date(toUtc(date)));

/** "Wednesday". */
export const weekdayName = (date: PlainDate): string => {
  const weekday = weekdayOf(date);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}`;
};

/** When an event happens, in words: "Every Wednesday, 6:30 to 8:00 pm". */
export const describeSchedule = (schedule: Schedule): string => {
  const times = formatTimes(schedule);
  if (schedule.repeats === "once") {
    return `${formatDate(schedule.date)}, ${times}`;
  }
  const day = capitalize(schedule.weekday);
  switch (schedule.repeats) {
    case "first": {
      return `First ${day} of the month, ${times}`;
    }
    case "first_third": {
      return `First and third ${day}s, ${times}`;
    }
    case "weekly": {
      return `${day}s, ${times}`;
    }
    default: {
      return times;
    }
  }
};

/** ISO date for `<time datetime>` and URLs: "2026-10-28". */
export const isoDate = (date: PlainDate): string =>
  [
    String(date.year),
    String(date.month).padStart(2, "0"),
    String(date.day).padStart(2, "0"),
  ].join("-");

/** How early the stream page switches to the live player, and how long it stays after a service. */
const STREAM_LEAD_MINUTES = 15;
const STREAM_TAIL_MINUTES = 15;
const DEFAULT_SERVICE_MINUTES = 90;

export interface StreamStatus {
  /** A streamed service is on (or about to start) right now. */
  readonly live: boolean;
  /** The next service that will stream, when not live. */
  readonly next:
    | { readonly date: PlainDate; readonly start: number }
    | undefined;
}

/** Whether a streamed service is on at `minutes` past midnight on `today`, and the next one if not. */
export const streamStatus = (
  services: readonly Schedule[],
  today: PlainDate,
  minutes: number
): StreamStatus => {
  const live = services.some((service) => {
    const end = service.end ?? service.start + DEFAULT_SERVICE_MINUTES;
    return (
      occursOn(service, today) &&
      minutes >= service.start - STREAM_LEAD_MINUTES &&
      minutes <= end + STREAM_TAIL_MINUTES
    );
  });
  // Each service's next two dates, so a service already past today still yields its next one.
  const upcoming = services
    .flatMap((service) =>
      nextDates(service, today, 2).flatMap((date) =>
        compareDates(date, today) > 0 || service.start > minutes
          ? [{ date, start: service.start }]
          : []
      )
    )
    .toSorted(
      (left, right) =>
        compareDates(left.date, right.date) || left.start - right.start
    );
  return { live, next: upcoming[0] };
};

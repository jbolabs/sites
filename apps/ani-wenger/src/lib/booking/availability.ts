/**
 * Which appointment times are open. Pure: the caller loads Ani's hours and
 * what is already taken (appointments, time off), and passes the clock in, so the same rules
 * answer both the booking calendar and the final check before a booking is
 * saved.
 */
import {
  addDays,
  daysBetween,
  fromLocal,
  toLocal,
  weekday,
} from "./calendar.ts";
import type { Weekday } from "./calendar.ts";

/** One stretch of opening hours on a weekday, in local minutes after midnight. */
export interface OpeningHours {
  readonly day: Weekday;
  readonly opens: number;
  readonly closes: number;
}

/** Time that cannot be booked: an appointment plus its cleanup buffer, or time off. */
export interface Busy {
  readonly start: Date;
  readonly end: Date;
}

export interface BookingRules {
  readonly timeZone: string;
  readonly hours: readonly OpeningHours[];
  /** Start times are offered on this grid from opening (15 gives 9:00, 9:15, ...). */
  readonly stepMinutes: number;
  /** The earliest bookable start is this far from now. */
  readonly minNoticeMinutes: number;
  /** The last bookable day is this many days after today. */
  readonly horizonDays: number;
}

export interface ServiceLength {
  readonly durationMinutes: number;
  /** Cleanup after the appointment; it must not overlap the next one. */
  readonly bufferMinutes: number;
}

export interface Slot {
  /** UTC instant, ISO 8601. */
  readonly start: string;
  /** Local minutes after midnight, for display. */
  readonly minutes: number;
}

export interface Day {
  readonly date: string;
  readonly slots: readonly Slot[];
}

const MS_PER_MINUTE = 60_000;

const overlaps = (start: number, end: number, busy: Busy) =>
  start < busy.end.getTime() && busy.start.getTime() < end;

const daySlots = (
  date: string,
  rules: BookingRules,
  service: ServiceLength,
  busy: readonly Busy[],
  earliest: number
): Slot[] => {
  const day = weekday(date);
  const step = Math.max(5, rules.stepMinutes);
  return rules.hours
    .filter((hours) => hours.day === day)
    .toSorted((a, b) => a.opens - b.opens)
    .flatMap((hours) => {
      const slots: Slot[] = [];
      for (
        let minutes = hours.opens;
        minutes + service.durationMinutes <= hours.closes;
        minutes += step
      ) {
        const instant = fromLocal(date, minutes, rules.timeZone).getTime();
        const occupiedUntil =
          instant +
          (service.durationMinutes + service.bufferMinutes) * MS_PER_MINUTE;
        const open =
          instant >= earliest &&
          !busy.some((taken) => overlaps(instant, occupiedUntil, taken));
        if (open) {
          slots.push({ minutes, start: new Date(instant).toISOString() });
        }
      }
      return slots;
    });
};

/**
 * Open start times for a service on `days` consecutive local dates from
 * `from`, clipped to the booking horizon. Days with nothing open are kept
 * (with no slots) so a calendar can grey them out.
 */
export const availableDays = ({
  busy,
  days,
  from,
  now,
  rules,
  service,
}: {
  readonly rules: BookingRules;
  readonly service: ServiceLength;
  readonly busy: readonly Busy[];
  readonly now: Date;
  readonly from: string;
  readonly days: number;
}): Day[] => {
  const today = toLocal(now, rules.timeZone).date;
  const earliest = now.getTime() + rules.minNoticeMinutes * MS_PER_MINUTE;
  const result: Day[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(from, offset);
    const ahead = daysBetween(today, date);
    const bookable = ahead >= 0 && ahead <= rules.horizonDays;
    result.push({
      date,
      slots: bookable ? daySlots(date, rules, service, busy, earliest) : [],
    });
  }
  return result;
};

/** Whether `start` (an ISO instant) is still an open start time for the service. */
export const isOpenSlot = ({
  busy,
  now,
  rules,
  service,
  start,
}: {
  readonly rules: BookingRules;
  readonly service: ServiceLength;
  readonly busy: readonly Busy[];
  readonly now: Date;
  readonly start: Date;
}): boolean => {
  const { date } = toLocal(start, rules.timeZone);
  const [day] = availableDays({
    busy,
    days: 1,
    from: date,
    now,
    rules,
    service,
  });
  return (day?.slots ?? []).some((slot) => slot.start === start.toISOString());
};

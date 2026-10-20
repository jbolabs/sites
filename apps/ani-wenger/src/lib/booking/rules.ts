/**
 * Ani's booking rules as the scheduler needs them, read from the "Salon and
 * hours" entry. Rows an editor typed badly (closing before opening, a time
 * like "9am") are skipped rather than guessed at.
 */
import type { BookingRules, OpeningHours } from "./availability.ts";
import { isWeekday, parseLocalTime } from "./calendar.ts";

export interface StudioRules {
  readonly hours: readonly {
    readonly day: string;
    readonly opens: string;
    readonly closes: string;
  }[];
  readonly step_minutes: number;
  readonly min_notice_hours: number;
  readonly horizon_days: number;
}

export const bookingRules = (
  studio: StudioRules,
  timeZone: string
): BookingRules => ({
  horizonDays: studio.horizon_days,
  hours: studio.hours.flatMap((row): OpeningHours[] => {
    const opens = parseLocalTime(row.opens);
    const closes = parseLocalTime(row.closes);
    if (
      !isWeekday(row.day) ||
      opens === undefined ||
      closes === undefined ||
      closes <= opens
    ) {
      return [];
    }
    return [{ closes, day: row.day, opens }];
  }),
  minNoticeMinutes: studio.min_notice_hours * 60,
  stepMinutes: studio.step_minutes,
  timeZone,
});

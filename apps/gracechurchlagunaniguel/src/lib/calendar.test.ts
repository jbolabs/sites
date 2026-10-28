/**
 * Expected dates come from the church's previous website, which listed the
 * next occurrences of each repeating event on Monday, October 26, 2026, and
 * from a printed November 2026 calendar (Thursdays fall on the 5th, 12th,
 * 19th, and 26th).
 */
import { describe, expect, it } from "vitest";

import {
  agenda,
  clockIn,
  dateIn,
  describeSchedule,
  formatTimes,
  nextDates,
  scheduleOf,
  streamStatus,
} from "./calendar.ts";
import type { Schedule, ScheduleFields } from "./calendar.ts";

const ZONE = "America/Los_Angeles";
const MONDAY_OCT_26 = { day: 26, month: 10, year: 2026 };

const schedule = (fields: ScheduleFields): Schedule => {
  const parsed = scheduleOf(fields, ZONE);
  if (parsed === undefined) {
    throw new Error(`no schedule for ${JSON.stringify(fields)}`);
  }
  return parsed;
};

describe(nextDates, () => {
  it("finds the fellowship meal on the first Sunday of each month", () => {
    const meal = schedule({
      repeats: "First week of the month",
      start_time: "11:45",
      weekday: "Sunday",
    });
    expect(nextDates(meal, MONDAY_OCT_26, 2)).toStrictEqual([
      { day: 1, month: 11, year: 2026 },
      { day: 6, month: 12, year: 2026 },
    ]);
  });

  it("finds the men's study on the first Saturday of each month", () => {
    const study = schedule({
      repeats: "First week of the month",
      start_time: "07:30",
      weekday: "Saturday",
    });
    expect(nextDates(study, MONDAY_OCT_26, 2)).toStrictEqual([
      { day: 7, month: 11, year: 2026 },
      { day: 5, month: 12, year: 2026 },
    ]);
  });

  it("finds a weekly Tuesday gathering starting tomorrow", () => {
    const youngAdults = schedule({
      start_time: "18:30",
      weekday: "Tuesday",
    });
    expect(nextDates(youngAdults, MONDAY_OCT_26, 2)).toStrictEqual([
      { day: 27, month: 10, year: 2026 },
      { day: 3, month: 11, year: 2026 },
    ]);
  });

  it("finds first and third Thursdays", () => {
    const womensStudy = schedule({
      repeats: "First and third weeks of the month",
      start_time: "09:30",
      weekday: "Thursday",
    });
    expect(nextDates(womensStudy, MONDAY_OCT_26, 2)).toStrictEqual([
      { day: 5, month: 11, year: 2026 },
      { day: 19, month: 11, year: 2026 },
    ]);
  });

  it("places a one-time event on its date at the church, not in UTC", () => {
    // 9:00 pm Pacific on November 14 is already November 15 in UTC.
    const dinner = schedule({
      date: "2026-11-15T05:00:00.000Z",
      repeats: "One date only",
      start_time: "18:00",
    });
    expect(nextDates(dinner, MONDAY_OCT_26, 3)).toStrictEqual([
      { day: 14, month: 11, year: 2026 },
    ]);
  });
});

describe(scheduleOf, () => {
  it("needs a day for repeating events and a real 24-hour start time", () => {
    expect(scheduleOf({ start_time: "18:30" }, ZONE)).toBeUndefined();
    expect(
      scheduleOf({ start_time: "6:30pm", weekday: "Tuesday" }, ZONE)
    ).toBeUndefined();
    expect(
      scheduleOf(
        { end_time: "20:00", start_time: "18:30", weekday: "Tuesday" },
        ZONE
      )
    ).toStrictEqual({
      end: 1200,
      repeats: "weekly",
      start: 1110,
      weekday: "tuesday",
    });
  });
});

describe(dateIn, () => {
  it("reads the date at the church", () => {
    // 5:30 am UTC on the 27th is 10:30 pm Pacific (daylight time) on the 26th.
    expect(dateIn(ZONE, new Date("2026-10-27T05:30:00Z"))).toStrictEqual(
      MONDAY_OCT_26
    );
  });
});

describe(describeSchedule, () => {
  it("says when an event happens in words", () => {
    expect(
      describeSchedule(
        schedule({
          end_time: "20:00",
          start_time: "18:30",
          weekday: "Wednesday",
        })
      )
    ).toBe("Wednesdays, 6:30 to 8:00 pm");
    expect(
      describeSchedule(
        schedule({
          repeats: "First week of the month",
          start_time: "11:45",
          weekday: "Sunday",
        })
      )
    ).toBe("First Sunday of the month, 11:45 am");
    expect(
      describeSchedule(
        schedule({
          end_time: "11:00",
          repeats: "First and third weeks of the month",
          start_time: "09:30",
          weekday: "Thursday",
        })
      )
    ).toBe("First and third Thursdays, 9:30 to 11:00 am");
  });

  it("keeps am and pm on both ends when a time range crosses noon", () => {
    expect(
      formatTimes(
        schedule({ end_time: "13:00", start_time: "11:30", weekday: "Sunday" })
      )
    ).toBe("11:30 am to 1:00 pm");
  });
});

describe(agenda, () => {
  it("lists a day's events in start-time order", () => {
    const events = [
      {
        item: "Fellowship meal",
        schedule: schedule({
          repeats: "First week of the month",
          start_time: "11:45",
          weekday: "Sunday",
        }),
      },
      {
        item: "Morning worship",
        schedule: schedule({ start_time: "10:00", weekday: "Sunday" }),
      },
      {
        item: "Young adults",
        schedule: schedule({ start_time: "18:30", weekday: "Tuesday" }),
      },
      {
        item: "Sunday school",
        schedule: schedule({ start_time: "09:00", weekday: "Sunday" }),
      },
    ];
    const days = agenda(events, { day: 1, month: 11, year: 2026 }, 3);
    expect(days.map((day) => day.items.map(({ item }) => item))).toStrictEqual([
      ["Sunday school", "Morning worship", "Fellowship meal"],
      [],
      ["Young adults"],
    ]);
  });
});

describe("the live stream", () => {
  const services = [
    schedule({ end_time: "11:30", start_time: "10:00", weekday: "Sunday" }),
    schedule({ end_time: "19:00", start_time: "18:00", weekday: "Sunday" }),
  ];
  const SUNDAY_NOV_1 = { day: 1, month: 11, year: 2026 };

  it("is on from shortly before a service until shortly after it", () => {
    expect(streamStatus(services, SUNDAY_NOV_1, 9 * 60 + 50).live).toBeTruthy();
    expect(
      streamStatus(services, SUNDAY_NOV_1, 11 * 60 + 40).live
    ).toBeTruthy();
    expect(streamStatus(services, SUNDAY_NOV_1, 13 * 60).live).toBeFalsy();
  });

  it("names the next service when it is off", () => {
    expect(streamStatus(services, SUNDAY_NOV_1, 13 * 60).next).toStrictEqual({
      date: SUNDAY_NOV_1,
      start: 18 * 60,
    });
    expect(streamStatus(services, MONDAY_OCT_26, 12 * 60)).toStrictEqual({
      live: false,
      next: { date: SUNDAY_NOV_1, start: 10 * 60 },
    });
  });

  it("reads the clock at the church", () => {
    // 5:30 pm UTC on November 1 is 9:30 am Pacific (standard time).
    expect(clockIn(ZONE, new Date("2026-11-01T17:30:00Z"))).toBe(570);
  });
});

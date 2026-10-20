import { describe, expect, it } from "vitest";

import { availableDays, isOpenSlot } from "./availability.ts";
import type { BookingRules } from "./availability.ts";
import {
  addDays,
  formatDate,
  formatTime,
  fromLocal,
  parseLocalTime,
  toLocal,
  weekday,
} from "./calendar.ts";

const LA = "America/Los_Angeles";

/** Tuesday mornings 9:00 to 12:00, offered every half hour. */
const tuesdayMornings: BookingRules = {
  horizonDays: 30,
  hours: [{ closes: 720, day: "tuesday", opens: 540 }],
  minNoticeMinutes: 60,
  stepMinutes: 30,
  timeZone: LA,
};

const hourWithCleanup = { bufferMinutes: 15, durationMinutes: 60 };
const hourFlat = { bufferMinutes: 0, durationMinutes: 60 };
/** Monday 2026-10-19, noon in Laguna Niguel (PDT, UTC-7). */
const mondayNoon = new Date("2026-10-19T19:00:00Z");

describe("salon clock", () => {
  it("turns local salon times into UTC instants across daylight saving", () => {
    // 9:00 PDT (UTC-7) before clocks fall back on 2026-11-01, 9:00 PST (UTC-8) after.
    expect(fromLocal("2026-10-20", 540, LA).toISOString()).toBe(
      "2026-10-20T16:00:00.000Z"
    );
    expect(fromLocal("2026-11-03", 540, LA).toISOString()).toBe(
      "2026-11-03T17:00:00.000Z"
    );
    expect(toLocal(new Date("2026-11-03T17:00:00Z"), LA)).toStrictEqual({
      date: "2026-11-03",
      minutes: 540,
    });
  });

  it("names weekdays and formats dates for people", () => {
    expect(weekday("2026-10-20")).toBe("tuesday");
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(formatDate("2026-10-20", 2026)).toBe("Tuesday, October 20");
    expect(formatDate("2027-01-05", 2026)).toBe("Tuesday, January 5, 2027");
  });

  it("reads and writes clock times", () => {
    expect([570, 780, 720].map(formatTime)).toStrictEqual([
      "9:30 AM",
      "1:00 PM",
      "12:00 PM",
    ]);
    expect(parseLocalTime("17:45")).toBe(1065);
    // Opening hours are typed as 24-hour HH:MM; anything else is refused, not guessed.
    expect(["7:45", "9am", "24:00"].map(parseLocalTime)).toStrictEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });
});

describe(availableDays, () => {
  it("keeps an appointment and its cleanup clear of existing bookings", () => {
    // Booked 10:30 to 11:30 with 15 minutes of cleanup (17:30Z to 18:45Z).
    const busy = [
      {
        end: new Date("2026-10-20T18:45:00Z"),
        start: new Date("2026-10-20T17:30:00Z"),
      },
    ];
    const [tuesday] = availableDays({
      busy,
      days: 1,
      from: "2026-10-20",
      now: mondayNoon,
      rules: tuesdayMornings,
      service: hourWithCleanup,
    });
    // 9:00 ends with cleanup at 10:15; every later start runs into the booking.
    expect(tuesday).toStrictEqual({
      date: "2026-10-20",
      slots: [{ minutes: 540, start: "2026-10-20T16:00:00.000Z" }],
    });
  });

  it("offers nothing sooner than the notice period", () => {
    // 8:30 on the day with an hour's notice: 9:30 is the first start.
    const [tuesday] = availableDays({
      busy: [],
      days: 1,
      from: "2026-10-20",
      now: new Date("2026-10-20T15:30:00Z"),
      rules: tuesdayMornings,
      service: hourFlat,
    });
    expect(tuesday?.slots.map((slot) => slot.minutes)).toStrictEqual([
      570, 600, 630, 660,
    ]);
  });

  it("closes days off and the hours of a partial day off", () => {
    const days = availableDays({
      busy: [
        // Away all of Tuesday the 20th (local midnight to midnight, PDT).
        {
          end: new Date("2026-10-21T07:00:00Z"),
          start: new Date("2026-10-20T07:00:00Z"),
        },
        // Away 10:00 to 11:00 on Tuesday the 27th.
        {
          end: new Date("2026-10-27T18:00:00Z"),
          start: new Date("2026-10-27T17:00:00Z"),
        },
      ],
      days: 8,
      from: "2026-10-20",
      now: mondayNoon,
      rules: tuesdayMornings,
      service: hourFlat,
    });
    expect(
      days.map((day) => [day.date, day.slots.map((slot) => slot.minutes)])
    ).toStrictEqual([
      ["2026-10-20", []],
      ["2026-10-21", []],
      ["2026-10-22", []],
      ["2026-10-23", []],
      ["2026-10-24", []],
      ["2026-10-25", []],
      ["2026-10-26", []],
      // Away 10:00 to 11:00: an hour-long visit fits at 9:00 and 11:00 only.
      ["2026-10-27", [540, 660]],
    ]);
  });

  it("stops at the booking horizon", () => {
    const days = availableDays({
      busy: [],
      days: 2,
      from: "2026-11-17",
      now: mondayNoon,
      rules: { ...tuesdayMornings, horizonDays: 28 },
      service: hourFlat,
    });
    // 2026-11-17 is 29 days after 2026-10-19, one past the horizon.
    expect(days).toStrictEqual([
      { date: "2026-11-17", slots: [] },
      { date: "2026-11-18", slots: [] },
    ]);
  });
});

describe(isOpenSlot, () => {
  it("accepts an open start and refuses one that would overlap", () => {
    const busy = [
      {
        end: new Date("2026-10-20T18:00:00Z"),
        start: new Date("2026-10-20T17:00:00Z"),
      },
    ];
    const check = (start: string) =>
      isOpenSlot({
        busy,
        now: mondayNoon,
        rules: tuesdayMornings,
        service: hourFlat,
        start: new Date(start),
      });
    expect(
      [
        "2026-10-20T16:00:00.000Z",
        "2026-10-20T16:30:00.000Z",
        // Off the half-hour grid.
        "2026-10-20T18:10:00.000Z",
      ].map(check)
    ).toStrictEqual([true, false, false]);
  });
});

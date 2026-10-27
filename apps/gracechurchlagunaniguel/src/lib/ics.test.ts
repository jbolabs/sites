import { describe, expect, it } from "vitest";

import { scheduleOf } from "./calendar.ts";
import type { ScheduleFields } from "./calendar.ts";
import { calendarFile, escapeText } from "./ics.ts";

const ZONE = "America/Los_Angeles";
const options = {
  name: "Grace Church",
  now: new Date("2026-10-26T17:00:00Z"),
  today: { day: 26, month: 10, year: 2026 },
};

const item = (summary: string, fields: ScheduleFields) => {
  const schedule = scheduleOf(fields, ZONE);
  if (schedule === undefined) {
    throw new Error("no schedule");
  }
  return { schedule, summary, uid: `${summary}@example.org` };
};

const unfold = (text: string) => text.replaceAll("\r\n ", "");

describe(calendarFile, () => {
  it("starts a weekly Sunday service on the coming Sunday and repeats it", () => {
    const file = unfold(
      calendarFile(
        [
          item("Morning worship", {
            end_time: "11:30",
            start_time: "10:00",
            weekday: "Sunday",
          }),
        ],
        options
      )
    );
    expect(file).toContain(
      "DTSTART;TZID=America/Los_Angeles:20261101T100000\r\n"
    );
    expect(file).toContain(
      "DTEND;TZID=America/Los_Angeles:20261101T113000\r\n"
    );
    expect(file).toContain("RRULE:FREQ=WEEKLY;BYDAY=SU\r\n");
    expect(file).toContain("DTSTAMP:20261026T170000Z\r\n");
  });

  it("repeats a first-and-third event monthly on both weeks", () => {
    const file = unfold(
      calendarFile(
        [
          item("Women's study", {
            repeats: "First and third weeks of the month",
            start_time: "09:30",
            weekday: "Thursday",
          }),
        ],
        options
      )
    );
    expect(file).toContain(
      "DTSTART;TZID=America/Los_Angeles:20261105T093000\r\n"
    );
    expect(file).toContain(
      "DTEND;TZID=America/Los_Angeles:20261105T103000\r\n"
    );
    expect(file).toContain("RRULE:FREQ=MONTHLY;BYDAY=1TH,3TH\r\n");
  });

  it("folds long lines at 75 octets", () => {
    const file = calendarFile(
      [item("A".repeat(120), { start_time: "10:00", weekday: "Sunday" })],
      options
    );
    const longest = Math.max(...file.split("\r\n").map((line) => line.length));
    expect(longest).toBe(75);
  });
});

describe(escapeText, () => {
  it("escapes separators and turns line breaks into \\n", () => {
    expect(escapeText("Coffee, prayer; study\r\nRoom 102")).toBe(
      String.raw`Coffee\, prayer\; study\nRoom 102`
    );
  });
});

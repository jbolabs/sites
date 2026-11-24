import { describe, expect, it } from "vitest";

import {
  NotACalendarError,
  busyFromCalendar,
  calendarAddress,
  mergeBusy,
} from "./outside-calendar.ts";

const LA = "America/Los_Angeles";

/** The shape iCloud publishes: a VTIMEZONE, then events in that zone. */
const icloud = (events: string) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Apple Inc.//iCloud//EN",
    "X-WR-CALNAME:Work",
    "BEGIN:VTIMEZONE",
    "TZID:America/Los_Angeles",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:-0800",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "DTSTART:20070311T020000",
    "TZNAME:PDT",
    "TZOFFSETTO:-0700",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:-0700",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "DTSTART:20071104T020000",
    "TZNAME:PST",
    "TZOFFSETTO:-0800",
    "END:STANDARD",
    "END:VTIMEZONE",
    events.trim(),
    "END:VCALENDAR",
  ].join("\r\n");

const window = {
  from: new Date("2026-10-26T00:00:00Z"),
  timeZone: LA,
  to: new Date("2026-11-30T00:00:00Z"),
};

const iso = (blocks: readonly { start: Date; end: Date }[]) =>
  blocks.map((block) => [block.start.toISOString(), block.end.toISOString()]);

const at = (time: string) => new Date(`2026-11-03T${time}:00Z`);

describe("busy time from Ani's work calendar", () => {
  it("blocks a client she booked by text, on her clock across daylight saving", () => {
    const file = icloud(`
BEGIN:VEVENT
UID:one@icloud
DTSTART;TZID=America/Los_Angeles:20261029T100000
DTEND;TZID=America/Los_Angeles:20261029T113000
SUMMARY:Maria color
END:VEVENT
BEGIN:VEVENT
UID:two@icloud
DTSTART;TZID=America/Los_Angeles:20261105T140000
DTEND;TZID=America/Los_Angeles:20261105T150000
SUMMARY:Dana cut
END:VEVENT`);
    // October 29 is PDT (UTC-7), November 5 is PST (UTC-8).
    expect(iso(busyFromCalendar(file, window))).toStrictEqual([
      ["2026-10-29T17:00:00.000Z", "2026-10-29T18:30:00.000Z"],
      ["2026-11-05T22:00:00.000Z", "2026-11-05T23:00:00.000Z"],
    ]);
  });

  it("expands a weekly event, skipping a deleted week and a moved one", () => {
    const file = icloud(`
BEGIN:VEVENT
UID:standing@icloud
DTSTART;TZID=America/Los_Angeles:20261103T090000
DTEND;TZID=America/Los_Angeles:20261103T100000
RRULE:FREQ=WEEKLY;BYDAY=TU
EXDATE;TZID=America/Los_Angeles:20261110T090000
SUMMARY:Standing client
END:VEVENT
BEGIN:VEVENT
UID:standing@icloud
RECURRENCE-ID;TZID=America/Los_Angeles:20261117T090000
DTSTART;TZID=America/Los_Angeles:20261118T150000
DTEND;TZID=America/Los_Angeles:20261118T160000
SUMMARY:Standing client (moved)
END:VEVENT`);
    expect(iso(busyFromCalendar(file, window))).toStrictEqual([
      ["2026-11-03T17:00:00.000Z", "2026-11-03T18:00:00.000Z"],
      ["2026-11-18T23:00:00.000Z", "2026-11-19T00:00:00.000Z"],
      ["2026-11-24T17:00:00.000Z", "2026-11-24T18:00:00.000Z"],
    ]);
  });

  it("blocks whole local days for all-day events and ignores cancelled ones", () => {
    const file = icloud(`
BEGIN:VEVENT
UID:off@icloud
DTSTART;VALUE=DATE:20261127
DTEND;VALUE=DATE:20261129
SUMMARY:Thanksgiving trip
END:VEVENT
BEGIN:VEVENT
UID:gone@icloud
DTSTART;TZID=America/Los_Angeles:20261102T090000
DTEND;TZID=America/Los_Angeles:20261102T100000
STATUS:CANCELLED
SUMMARY:Cancelled
END:VEVENT`);
    expect(iso(busyFromCalendar(file, window))).toStrictEqual([
      ["2026-11-27T08:00:00.000Z", "2026-11-29T08:00:00.000Z"],
    ]);
  });

  it("reads UTC and zone-less times, and keeps only what overlaps the window", () => {
    const file = icloud(`
BEGIN:VEVENT
UID:utc@icloud
DTSTART:20261102T200000Z
DTEND:20261102T210000Z
END:VEVENT
BEGIN:VEVENT
UID:floating@icloud
DTSTART:20261103T120000
DURATION:PT45M
END:VEVENT
BEGIN:VEVENT
UID:old@icloud
DTSTART:20250102T200000Z
DTEND:20250102T210000Z
END:VEVENT`);
    expect(iso(busyFromCalendar(file, window))).toStrictEqual([
      ["2026-11-02T20:00:00.000Z", "2026-11-02T21:00:00.000Z"],
      ["2026-11-03T20:00:00.000Z", "2026-11-03T20:45:00.000Z"],
    ]);
  });

  it("refuses a page that is not a calendar", () => {
    expect(() =>
      busyFromCalendar("<!doctype html><title>Sign in</title>", window)
    ).toThrow(NotACalendarError);
  });

  it("merges overlapping blocks into one", () => {
    expect(
      iso(
        mergeBusy([
          { end: at("18:00"), start: at("17:00") },
          { end: at("17:30"), start: at("16:00") },
          { end: at("20:00"), start: at("19:00") },
        ])
      )
    ).toStrictEqual([
      ["2026-11-03T16:00:00.000Z", "2026-11-03T18:00:00.000Z"],
      ["2026-11-03T19:00:00.000Z", "2026-11-03T20:00:00.000Z"],
    ]);
  });
});

describe("calendar links", () => {
  it("fetches an iPhone webcal link over https", () => {
    expect(
      calendarAddress(
        " webcal://p52-caldav.icloud.com/published/2/MTIzNDU2Nzg5MA "
      )
    ).toBe("https://p52-caldav.icloud.com/published/2/MTIzNDU2Nzg5MA");
  });

  it("refuses text that is not a web address", () => {
    expect(calendarAddress("my work calendar")).toBeUndefined();
    expect(calendarAddress("ftp://example.com/cal.ics")).toBeUndefined();
    expect(calendarAddress("https://example.com/cal.ics")).toBe(
      "https://example.com/cal.ics"
    );
  });
});

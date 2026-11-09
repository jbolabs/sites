import { describe, expect, it } from "vitest";

import { columnText, formatDateTime, formatPhone } from "./list-values.ts";

const LA = "America/Los_Angeles";
const NOW = new Date("2026-11-09T18:00:00Z");

describe(formatPhone, () => {
  it("writes a US number the way it is said", () => {
    expect(formatPhone("9495550142")).toBe("(949) 555-0142");
    expect(formatPhone("+1 949 555 0142")).toBe("(949) 555-0142");
    expect(formatPhone("949.555.0142")).toBe("(949) 555-0142");
  });

  it("leaves anything else as it was typed", () => {
    expect(formatPhone(" +44 20 7946 0958 ")).toBe("+44 20 7946 0958");
    expect(formatPhone("555-0142")).toBe("555-0142");
  });
});

describe(formatDateTime, () => {
  it("shows the weekday, date and time in the salon's zone", () => {
    expect(
      formatDateTime("2026-11-10T18:00:00.000Z", { now: NOW, timeZone: LA })
    ).toBe("Tue, Nov 10, 10:00 AM");
  });

  it("names the year only when it is not this one", () => {
    expect(
      formatDateTime("2027-01-05T21:30:00.000Z", { now: NOW, timeZone: LA })
    ).toBe("Tue, Jan 5, 2027, 1:30 PM");
  });

  it("uses the salon's year, not UTC's, on New Year's Eve", () => {
    expect(
      formatDateTime("2027-01-01T05:00:00.000Z", {
        now: new Date("2026-12-31T20:00:00Z"),
        timeZone: LA,
      })
    ).toBe("Thu, Dec 31, 9:00 PM");
  });

  it("shows a value it cannot read as it is", () => {
    expect(formatDateTime("next Tuesday", { now: NOW, timeZone: LA })).toBe(
      "next Tuesday"
    );
  });
});

describe(columnText, () => {
  const context = { now: NOW, timeZone: LA };

  it("names a stored choice with the site's label", () => {
    const state = { labels: { confirmed: "Booked", no_show: "No show" } };
    expect(columnText(state, "confirmed", context)).toBe("Booked");
    expect(columnText(state, "completed", context)).toBe("Completed");
    expect(columnText(state, "on_hold", context)).toBe("On hold");
  });

  it("shows plain text as stored", () => {
    expect(columnText({}, "Men's cut", context)).toBe("Men's cut");
  });

  it("formats phone and date columns", () => {
    expect(columnText({ format: "phone" }, "9495550142", context)).toBe(
      "(949) 555-0142"
    );
    expect(
      columnText({ format: "datetime" }, "2026-11-09T22:00:00.000Z", context)
    ).toBe("Mon, Nov 9, 2:00 PM");
  });
});

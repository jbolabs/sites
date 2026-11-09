/* oxlint-disable sonarjs/no-undefined-assignment -- `Appointment` keeps "not given" as a required `undefined` field, so the fixture spells each one out. */
import { validateBlockResponse } from "@emdash-cms/blocks/server";
import { describe, expect, it } from "vitest";

import type { Appointment } from "../lib/booking/services.ts";
import {
  appointmentLines,
  byDay,
  CANCEL_ACTION,
  dayLabel,
  schedulePage,
  todayWidget,
} from "./schedule-ui.ts";

const LA = "America/Los_Angeles";

const appointment = (
  id: string,
  start: string,
  extra: Partial<Appointment> = {}
): Appointment => ({
  bufferMinutes: 0,
  clientFor: undefined,
  clientName: `Client ${id}`,
  createdAt: new Date("2026-11-01T00:00:00Z"),
  durationMinutes: 60,
  email: undefined,
  hairHistory: undefined,
  hairPhotos: [],
  id,
  notes: undefined,
  phone: undefined,
  reminderSent: false,
  service: "Women's precision cut",
  serviceSlug: undefined,
  start: new Date(start),
  state: "confirmed",
  tokenHash: undefined,
  ...extra,
});

describe(dayLabel, () => {
  it("names today and tomorrow, then the date", () => {
    expect(dayLabel("2026-11-09", "2026-11-09")).toBe("Today, November 9");
    expect(dayLabel("2026-11-10", "2026-11-09")).toBe("Tomorrow, November 10");
    expect(dayLabel("2026-11-12", "2026-11-09")).toBe("Thursday, November 12");
  });

  it("names the year only when it is not this one", () => {
    expect(dayLabel("2027-01-05", "2026-12-30")).toBe(
      "Tuesday, January 5, 2027"
    );
    expect(dayLabel("2027-01-01", "2026-12-31")).toBe(
      "Tomorrow, January 1, 2027"
    );
  });
});

describe(byDay, () => {
  it("groups by the salon's day, not UTC's", () => {
    const evening = appointment("a", "2026-11-10T01:30:00Z");
    const morning = appointment("b", "2026-11-10T17:00:00Z");
    expect(
      byDay([evening, morning], LA).map(([date, list]) => [
        date,
        list.map(({ id }) => id),
      ])
    ).toStrictEqual([
      ["2026-11-09", ["a"]],
      ["2026-11-10", ["b"]],
    ]);
  });
});

describe(appointmentLines, () => {
  it("puts the time and name first, then the service and phone", () => {
    expect(
      appointmentLines(
        appointment("a", "2026-11-09T22:00:00Z", {
          clientFor: "women",
          clientName: "Maya Chen",
          phone: "9495550142",
        }),
        LA
      )
    ).toStrictEqual({
      details: "Women's precision cut (Women) · (949)\u00A0555\u20110142",
      who: "2:00 PM · Maya Chen",
    });
  });

  it("leaves out a phone the client did not give", () => {
    expect(
      appointmentLines(appointment("a", "2026-11-09T17:30:00Z"), LA)
    ).toStrictEqual({
      details: "Women's precision cut",
      who: "9:30 AM · Client a",
    });
  });
});

describe(todayWidget, () => {
  const now = new Date("2026-11-09T16:00:00Z");

  it("lists the next appointments under their days", () => {
    const { blocks } = todayWidget({
      now,
      timeZone: LA,
      upcoming: [
        appointment("a", "2026-11-09T22:00:00Z"),
        appointment("b", "2026-11-10T18:00:00Z", { phone: "9495550142" }),
      ],
    });
    expect(
      blocks.map((block) => ("text" in block ? block.text : block.type))
    ).toStrictEqual([
      "Today, November 9",
      "2:00 PM · Client a",
      "Women's precision cut",
      "divider",
      "Tomorrow, November 10",
      "10:00 AM · Client b",
      "Women's precision cut · (949)\u00A0555\u20110142",
      "actions",
    ]);
  });

  it("counts the appointments it has no room for", () => {
    const upcoming = Array.from({ length: 8 }, (_, index) =>
      appointment(String(index), `2026-11-10T${String(16 + index)}:00:00Z`)
    );
    const { blocks } = todayWidget({ now, timeZone: LA, upcoming });
    expect(blocks.at(-2)).toStrictEqual({
      text: "2 more booked after these.",
      type: "context",
    });
  });

  it("says so when nothing is booked", () => {
    expect(
      todayWidget({ now, timeZone: LA, upcoming: [] }).blocks[0]
    ).toStrictEqual({
      text: "No upcoming appointments.",
      type: "context",
    });
  });
});

describe(schedulePage, () => {
  const now = new Date("2026-11-09T16:00:00Z");
  const feedUrl = "https://aniwenger.hair/calendar/key.ics";

  it("gives each appointment its lines and Open and Cancel", () => {
    const { blocks } = schedulePage({
      feedUrl,
      now,
      timeZone: LA,
      upcoming: [
        appointment("a", "2026-11-09T22:00:00Z", { clientName: "Maya Chen" }),
      ],
    });
    expect(blocks.slice(2, 7)).toStrictEqual([
      { type: "divider" },
      { text: "Today, November 9", type: "header" },
      { text: "2:00 PM · Maya Chen", type: "section" },
      { text: "Women's precision cut", type: "context" },
      {
        elements: [
          {
            appearance: "secondary",
            label: "Open",
            target: { collection: "appointments", id: "a", kind: "content" },
            type: "link",
          },
          {
            action_id: CANCEL_ACTION,
            confirm: {
              confirm: "Cancel and tell the client",
              deny: "Keep it",
              style: "danger",
              text: "Maya Chen will get an email asking them to choose a new time.",
              title: "Cancel this appointment?",
            },
            label: "Cancel",
            style: "secondary",
            type: "button",
            value: "a",
          },
        ],
        type: "actions",
      },
    ]);
  });

  it("lists the first 30 and counts the rest", () => {
    const upcoming = Array.from({ length: 33 }, (_, index) =>
      appointment(
        String(index),
        new Date(now.getTime() + (index + 1) * 3_600_000).toISOString()
      )
    );
    const { blocks } = schedulePage({ feedUrl, now, timeZone: LA, upcoming });
    expect(blocks.filter((block) => block.type === "actions")).toHaveLength(30);
    expect(
      blocks.find(
        (block) => block.type === "context" && block.text.endsWith("them all.")
      )
    ).toStrictEqual({
      text: "3 more after these. Open Appointments in the menu to see them all.",
      type: "context",
    });
  });

  it("says so when nothing is booked", () => {
    expect(
      schedulePage({ feedUrl, now, timeZone: LA, upcoming: [] }).blocks[2]
    ).toStrictEqual({ text: "No upcoming appointments yet.", type: "context" });
  });

  it("stays inside EmDash's size limits on the busiest page it can draw", () => {
    // A day apart each, so every one gets its own header and divider; the first 8 with notes and 4 photos.
    const busy = {
      clientFor: "women",
      clientName: "Alexandra Montgomery-Whitfield",
      phone: "19495550142",
    } as const;
    const upcoming = Array.from({ length: 60 }, (_, index) => {
      const id = String(index);
      const start = new Date(
        now.getTime() + (index + 1) * 86_400_000
      ).toISOString();
      return index < 8
        ? appointment(id, start, {
            ...busy,
            hairHistory: "home-color",
            hairPhotos: [
              { kind: "now", path: `/hair-photos/${id}-1.jpg` },
              { kind: "now", path: `/hair-photos/${id}-2.jpg` },
              { kind: "goal", path: `/hair-photos/${id}-3.jpg` },
              { kind: "goal", path: `/hair-photos/${id}-4.jpg` },
            ],
          })
        : appointment(id, start, busy);
    });
    const page = {
      ...schedulePage({ feedUrl, now, timeZone: LA, upcoming }),
      toast: {
        message: "Cancelled. The client has been emailed.",
        type: "success",
      },
    };
    const { errors, valid } = validateBlockResponse(page, {
      pluginPagePaths: ["/schedule"],
    });
    expect({ errors: [...errors], valid }).toStrictEqual({
      errors: [],
      valid: true,
    });
  });
});

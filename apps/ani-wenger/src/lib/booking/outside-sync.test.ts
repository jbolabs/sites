import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Layer, Option, Ref, Schema } from "effect";
import { TestClock } from "effect/testing";

import {
  DAYS_AHEAD,
  connectOutsideCalendar,
  disconnectOutsideCalendar,
  outsideBusy,
  refreshOutsideCalendar,
} from "./outside-sync.ts";
import { CalendarUnreadable, OutsideCalendar } from "./services.ts";
import type { OutsideCalendarRead } from "./services.ts";

const LA = "America/Los_Angeles";
/** Monday 2026-11-09, 8:00 AM PST. */
const MONDAY_EIGHT = Date.parse("2026-11-09T16:00:00Z");
const PASTED = "webcal://p52-caldav.icloud.com/published/2/work";
const ADDRESS = "https://p52-caldav.icloud.com/published/2/work";

const calendarWith = (events: string) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", events.trim(), "END:VCALENDAR"].join(
    "\r\n"
  );

/** Tuesday 10:00 to 11:00 PST, a client who texted. */
const TUESDAY_CLIENT = calendarWith(`
BEGIN:VEVENT
UID:client@icloud
DTSTART;TZID=America/Los_Angeles:20261110T100000
DTEND;TZID=America/Los_Angeles:20261110T110000
SUMMARY:Maria Lopez color
END:VEVENT`);

/** An in-memory link and read, and a calendar host that answers `served` (or fails). */
const world = Effect.gen(function* world() {
  const state = yield* Ref.make<{
    link: string | null;
    read: OutsideCalendarRead | null;
  }>({ link: null, read: null });
  const served = yield* Ref.make<string | null>(TUESDAY_CLIENT);
  const layer = Layer.succeed(OutsideCalendar, {
    download: (address) =>
      Ref.get(served).pipe(
        Effect.flatMap((file) =>
          file === null || address !== ADDRESS
            ? Effect.fail(new CalendarUnreadable({ reason: "HTTP 404" }))
            : Effect.succeed(file)
        )
      ),
    lastRead: Ref.get(state).pipe(
      Effect.map((current) => Option.fromNullishOr(current.read))
    ),
    link: Ref.get(state).pipe(
      Effect.map((current) => Option.fromNullishOr(current.link))
    ),
    saveRead: (read) => Ref.update(state, (current) => ({ ...current, read })),
    setLink: (address) =>
      Ref.update(state, (current) =>
        Option.isNone(address)
          ? { link: null, read: null }
          : { ...current, link: address.value }
      ),
  });
  return { layer, served, state };
});

const tuesday = {
  from: new Date("2026-11-10T08:00:00Z"),
  to: new Date("2026-11-11T08:00:00Z"),
};

const iso = (blocks: readonly { start: Date; end: Date }[]) =>
  blocks.map((block) => [block.start.toISOString(), block.end.toISOString()]);

describe(connectOutsideCalendar, () => {
  it.effect("connects a pasted iPhone link and blocks its times", () =>
    Effect.gen(function* connect() {
      yield* TestClock.setTime(MONDAY_EIGHT);
      const { layer, state } = yield* world;
      const read = yield* connectOutsideCalendar(PASTED, LA).pipe(
        Effect.provide(layer)
      );
      expect(read.failed).toBeFalsy();
      expect((yield* Ref.get(state)).link).toBe(ADDRESS);
      const busy = yield* outsideBusy(tuesday.from, tuesday.to).pipe(
        Effect.provide(layer)
      );
      expect(iso(busy)).toStrictEqual([
        ["2026-11-10T18:00:00.000Z", "2026-11-10T19:00:00.000Z"],
      ]);
    })
  );

  it.effect("keeps a working link when the new paste is not a calendar", () =>
    Effect.gen(function* refuse() {
      yield* TestClock.setTime(MONDAY_EIGHT);
      const { layer, state } = yield* world;
      yield* connectOutsideCalendar(PASTED, LA).pipe(Effect.provide(layer));
      const wrong = yield* connectOutsideCalendar(
        "https://www.icloud.com/calendar/",
        LA
      ).pipe(Effect.provide(layer), Effect.exit);
      const typed = yield* connectOutsideCalendar("my work calendar", LA).pipe(
        Effect.provide(layer),
        Effect.exit
      );
      expect(Exit.isFailure(wrong) && wrong.cause.toString()).toContain(
        "CalendarUnreadable"
      );
      expect(Exit.isFailure(typed) && typed.cause.toString()).toContain(
        "InvalidCalendarLink"
      );
      expect((yield* Ref.get(state)).link).toBe(ADDRESS);
    })
  );
});

describe(refreshOutsideCalendar, () => {
  it.effect("picks up what she added since the last read", () =>
    Effect.gen(function* refresh() {
      yield* TestClock.setTime(MONDAY_EIGHT);
      const { layer, served } = yield* world;
      yield* connectOutsideCalendar(PASTED, LA).pipe(Effect.provide(layer));
      yield* Ref.set(
        served,
        calendarWith(`
BEGIN:VEVENT
UID:client@icloud
DTSTART;TZID=America/Los_Angeles:20261110T100000
DTEND;TZID=America/Los_Angeles:20261110T110000
END:VEVENT
BEGIN:VEVENT
UID:new@icloud
DTSTART;TZID=America/Los_Angeles:20261110T140000
DTEND;TZID=America/Los_Angeles:20261110T150000
END:VEVENT`)
      );
      yield* TestClock.adjust("5 minutes");
      yield* refreshOutsideCalendar(LA).pipe(Effect.provide(layer));
      const busy = yield* outsideBusy(tuesday.from, tuesday.to).pipe(
        Effect.provide(layer)
      );
      expect(iso(busy)).toStrictEqual([
        ["2026-11-10T18:00:00.000Z", "2026-11-10T19:00:00.000Z"],
        ["2026-11-10T22:00:00.000Z", "2026-11-10T23:00:00.000Z"],
      ]);
    })
  );

  it.effect("keeps the last good times when iCloud does not answer", () =>
    Effect.gen(function* keepLastGood() {
      yield* TestClock.setTime(MONDAY_EIGHT);
      const { layer, served, state } = yield* world;
      yield* connectOutsideCalendar(PASTED, LA).pipe(Effect.provide(layer));
      yield* Ref.set(served, null);
      yield* TestClock.adjust("5 minutes");
      yield* refreshOutsideCalendar(LA).pipe(Effect.provide(layer));
      const { read } = yield* Ref.get(state);
      expect({
        checkedAt: read?.checkedAt.toISOString(),
        failed: read?.failed,
        readAt: read?.readAt?.toISOString(),
      }).toStrictEqual({
        checkedAt: "2026-11-09T16:05:00.000Z",
        failed: true,
        readAt: "2026-11-09T16:00:00.000Z",
      });
      const busy = yield* outsideBusy(tuesday.from, tuesday.to).pipe(
        Effect.provide(layer)
      );
      expect(iso(busy)).toStrictEqual([
        ["2026-11-10T18:00:00.000Z", "2026-11-10T19:00:00.000Z"],
      ]);
    })
  );

  it.effect("does nothing until a calendar is connected", () =>
    Effect.gen(function* idle() {
      const { layer } = yield* world;
      const read = yield* refreshOutsideCalendar(LA).pipe(
        Effect.provide(layer)
      );
      expect(Option.isNone(read)).toBeTruthy();
      const busy = yield* outsideBusy(tuesday.from, tuesday.to).pipe(
        Effect.provide(layer)
      );
      expect(busy).toHaveLength(0);
    })
  );
});

describe(disconnectOutsideCalendar, () => {
  it.effect("opens her calendar's times again", () =>
    Effect.gen(function* disconnect() {
      yield* TestClock.setTime(MONDAY_EIGHT);
      const { layer } = yield* world;
      yield* connectOutsideCalendar(PASTED, LA).pipe(Effect.provide(layer));
      expect(
        yield* outsideBusy(tuesday.from, tuesday.to).pipe(Effect.provide(layer))
      ).toHaveLength(1);
      yield* disconnectOutsideCalendar().pipe(Effect.provide(layer));
      expect(
        yield* outsideBusy(tuesday.from, tuesday.to).pipe(Effect.provide(layer))
      ).toHaveLength(0);
    })
  );
});

/** The booking horizon field as seed.json defines it for her admin. */
const SeedHorizon = Schema.Struct({
  collections: Schema.Array(
    Schema.Struct({
      fields: Schema.Array(
        Schema.Struct({
          slug: Schema.String,
          validation: Schema.optional(
            Schema.Struct({ max: Schema.optional(Schema.Number) })
          ),
        })
      ),
    })
  ),
});

describe("how far ahead busy times are kept", () => {
  it("covers the furthest day her admin lets clients book", () => {
    const seed = Schema.decodeUnknownSync(SeedHorizon)(
      JSON.parse(
        readFileSync(
          path.join(import.meta.dirname, "../../../seed/seed.json"),
          "utf-8"
        )
      )
    );
    const horizon = seed.collections
      .flatMap((collection) => collection.fields)
      .find((field) => field.slug === "horizon_days");
    expect(horizon?.validation?.max).toBeLessThan(DAYS_AHEAD);
  });
});

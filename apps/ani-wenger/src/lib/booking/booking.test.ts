import { describe, expect, it } from "@effect/vitest";
import { Email, TurnstileAllowAll } from "@jakebodea/cloudflare-kit/server";
import type { EmailMessage } from "@jakebodea/cloudflare-kit/server";
import { Effect, Exit, Layer, Option, Ref } from "effect";
import { TestClock } from "effect/testing";

import {
  bookAppointment,
  canCancel,
  cancelByClient,
  rescheduleByClient,
  rescheduleTimes,
  sendReminders,
} from "./booking.ts";
import type { BookingForm, BookingRequest } from "./booking.ts";
import {
  Appointments,
  BookingLock,
  BookingMail,
  Catalog,
  HairPhotos,
} from "./services.ts";
import type { Appointment, BookableService, SalonPolicy } from "./services.ts";

const at = (iso: string) => new Date(iso);

/** Monday 2026-10-19, noon in Irvine (PDT). */
const MONDAY_NOON = Date.parse("2026-10-19T19:00:00Z");
/** Tuesday 2026-10-27, 10:00 PDT. */
const TUESDAY_TEN = "2026-10-27T17:00:00.000Z";

const form = (overrides: Partial<BookingForm> = {}): BookingForm => ({
  email: "pat@example.com",
  name: "Pat Rivera",
  phone: "949-555-0100",
  services: ["mens-cut"],
  start: TUESDAY_TEN,
  turnstileToken: "token",
  ...overrides,
});

const POLICY: SalonPolicy = {
  bookingNote: "Please cancel 24 hours ahead.",
  cancelCutoffHours: 24,
  location: "James Matthew Salon, Irvine, CA",
  phone: "949-275-6251",
  rules: {
    horizonDays: 60,
    hours: [{ closes: 1080, day: "tuesday", opens: 540 }],
    minNoticeMinutes: 720,
    stepMinutes: 15,
    timeZone: "America/Los_Angeles",
  },
};

const service = (
  slug: string,
  title: string,
  durationMinutes: number,
  extra: Partial<BookableService> = {}
): BookableService => ({
  addOn: false,
  asksForPhotos: false,
  bufferMinutes: 0,
  durationMinutes,
  priceFrom: false,
  slug,
  title,
  ...extra,
});

const MENU: readonly BookableService[] = [
  service("mens-cut", "Men's cut", 45, { price: 70 }),
  service("mens-gray-blending", "Men's gray blending", 30, {
    addOn: true,
    price: 50,
  }),
  service("dimensional-color", "Highlights", 150, {
    asksForPhotos: true,
    bufferMinutes: 15,
    price: 210,
    priceFrom: true,
  }),
];

/** The smallest JPEG header the server accepts, base64-encoded. */
const JPEG = btoa(String.fromCodePoint(0xff, 0xd8, 0xff, 0xe0, 0, 16));

const request: BookingRequest = {
  remoteIp: "203.0.113.9",
  requestId: "ray-1",
};

/** An in-memory appointment book, a fixed menu and salon, and a mail recorder. */
const world = Effect.gen(function* world() {
  const book = yield* Ref.make<Appointment[]>([]);
  const sent = yield* Ref.make<EmailMessage[]>([]);
  const stored = yield* Ref.make<Uint8Array[]>([]);
  const layer = Layer.mergeAll(
    Layer.succeed(Appointments, {
      between: (from, to) =>
        Ref.get(book).pipe(
          Effect.map((all) =>
            all.filter((item) => item.start >= from && item.start < to)
          )
        ),
      create: (appointment) =>
        Ref.modify(book, (all) => {
          const id = `appt-${all.length + 1}`;
          const created: Appointment = {
            ...appointment,
            createdAt: new Date(MONDAY_NOON),
            id,
            reminderSent: false,
            state: "confirmed",
          };
          return [{ id }, [...all, created]];
        }),
      find: (id) =>
        Ref.get(book).pipe(
          Effect.map((all) =>
            Option.fromNullishOr(all.find((item) => item.id === id))
          )
        ),
      markReminded: (id) =>
        Ref.update(book, (all) =>
          all.map((item) =>
            item.id === id ? { ...item, reminderSent: true } : item
          )
        ),
      move: (id, change) =>
        Ref.update(book, (all) =>
          all.map((item) =>
            item.id === id
              ? {
                  ...item,
                  reminderSent: change.reminderSent,
                  start: change.start,
                }
              : item
          )
        ),
      setState: (id, state) =>
        Ref.update(book, (all) =>
          all.map((item) => (item.id === id ? { ...item, state } : item))
        ),
      timeOff: () => Effect.succeed([]),
    }),
    Layer.succeed(Catalog, {
      policy: Effect.succeed(POLICY),
      service: (slug) =>
        Effect.succeed(
          Option.fromNullishOr(MENU.find((item) => item.slug === slug))
        ),
    }),
    Layer.succeed(HairPhotos, {
      put: (jpeg) =>
        Ref.modify(stored, (all) => [
          `/hair-photos/photo-${all.length + 1}.jpg`,
          [...all, jpeg],
        ]),
    }),
    Layer.succeed(BookingLock, { withLock: (effect) => effect }),
    Layer.succeed(BookingMail, {
      from: Option.some({
        email: "sites@mail.jbolabs.com",
        name: "Ani Wenger",
      }),
      replyTo: "aniwenger@gmail.com",
      siteName: "Ani Wenger",
      siteOrigin: "https://aniwenger.example",
      studioInbox: Option.some(["ani@example.com"]),
    }),
    Layer.succeed(Email, {
      send: (message) => Ref.update(sent, (all) => [...all, message]),
    }),
    TurnstileAllowAll
  );
  return { book, layer, sent, stored };
});

describe(bookAppointment, () => {
  it.effect(
    "books an open time, confirms it to the client, and tells Ani",
    () =>
      Effect.gen(function* bookOpenTime() {
        yield* TestClock.setTime(MONDAY_NOON);
        const { book, layer, sent } = yield* world;
        const booked = yield* bookAppointment(form(), request).pipe(
          Effect.provide(layer)
        );

        expect(booked).toMatchObject({
          end: "2026-10-27T17:45:00.000Z",
          id: "appt-1",
          location: "James Matthew Salon, Irvine, CA",
          service: "Men's cut",
          start: TUESDAY_TEN,
        });
        expect(booked.manageUrl).toMatch(
          /^https:\/\/aniwenger\.example\/appointment\/appt-1\?t=[\w-]{32}$/u
        );
        const [saved] = yield* Ref.get(book);
        expect({
          ...saved,
          // Only the hash of the link's token is stored.
          tokenHash: /^[0-9a-f]{64}$/u.test(saved?.tokenHash ?? ""),
        }).toMatchObject({
          clientName: "Pat Rivera",
          durationMinutes: 45,
          phone: "949-555-0100",
          state: "confirmed",
          tokenHash: true,
        });
        const mail = yield* Ref.get(sent);
        expect(
          mail.map((message) => [message.to, message.subject, message.replyTo])
        ).toStrictEqual([
          [
            "pat@example.com",
            "Booked: Men's cut, Tuesday, October 27 at 10:00 AM",
            "aniwenger@gmail.com",
          ],
          [
            ["ani@example.com"],
            "New booking: Pat Rivera, Tuesday, October 27 at 10:00 AM",
            "pat@example.com",
          ],
        ]);
      })
  );

  it.effect("refuses a time that overlaps an existing booking", () =>
    Effect.gen(function* refuseOverlap() {
      yield* TestClock.setTime(MONDAY_NOON);
      const { book, layer } = yield* world;
      yield* bookAppointment(form(), request).pipe(Effect.provide(layer));
      // 10:30 runs into the 10:00 to 10:45 cut.
      const second = yield* bookAppointment(
        form({ name: "Sam Lee", start: "2026-10-27T17:30:00.000Z" }),
        request
      ).pipe(Effect.provide(layer), Effect.exit);

      expect(Exit.isFailure(second) && second.cause.toString()).toContain(
        "SlotUnavailable"
      );
      expect(
        (yield* Ref.get(book)).map((item) => item.clientName)
      ).toStrictEqual(["Pat Rivera"]);
    })
  );

  it.effect(
    "books stacked services as one appointment as long as all of them",
    () =>
      Effect.gen(function* bookStacked() {
        yield* TestClock.setTime(MONDAY_NOON);
        const { book, layer } = yield* world;
        const booked = yield* bookAppointment(
          form({ services: ["mens-gray-blending", "mens-cut"] }),
          request
        ).pipe(Effect.provide(layer));

        expect(booked).toMatchObject({
          end: "2026-10-27T18:15:00.000Z",
          service: "Men's cut + Men's gray blending",
        });
        expect(
          (yield* Ref.get(book)).map((item) => [
            item.serviceSlug,
            item.durationMinutes,
          ])
        ).toStrictEqual([["mens-cut,mens-gray-blending", 75]]);
      })
  );

  it.effect("refuses a visit of only add-ons", () =>
    Effect.gen(function* refuseAddOnOnly() {
      yield* TestClock.setTime(MONDAY_NOON);
      const { book, layer } = yield* world;
      const exit = yield* bookAppointment(
        form({ services: ["mens-gray-blending"] }),
        request
      ).pipe(Effect.provide(layer), Effect.exit);

      expect(Exit.isFailure(exit) && exit.cause.toString()).toContain(
        "InvalidVisit"
      );
      expect(yield* Ref.get(book)).toHaveLength(0);
    })
  );

  it.effect(
    "keeps the client's photos and warns Ani when the color needs correcting",
    () =>
      Effect.gen(function* bookWithPhotos() {
        yield* TestClock.setTime(MONDAY_NOON);
        const { book, layer, sent, stored } = yield* world;
        yield* bookAppointment(
          form({
            hairHistory: "vivid-color",
            photos: [
              { data: JPEG, kind: "now" },
              { data: JPEG, kind: "goal" },
            ],
            services: ["dimensional-color"],
          }),
          request
        ).pipe(Effect.provide(layer));

        expect(yield* Ref.get(stored)).toHaveLength(2);
        const [saved] = yield* Ref.get(book);
        expect([saved?.hairHistory, saved?.hairPhotos]).toStrictEqual([
          "vivid-color",
          [
            { kind: "now", path: "/hair-photos/photo-1.jpg" },
            { kind: "goal", path: "/hair-photos/photo-2.jpg" },
          ],
        ]);
        const toAni = (yield* Ref.get(sent)).find((message) =>
          message.to.includes("ani@example.com")
        );
        expect(toAni?.text).toContain(
          [
            "Color on their hair now: Vivid color, like purple, blue, pink, or red",
            "This may need a color correction. Check the photos and call them if the time or price will change.",
            "Hair photos:",
            "Now: https://aniwenger.example/hair-photos/photo-1.jpg",
            "Goal: https://aniwenger.example/hair-photos/photo-2.jpg",
          ].join("\n")
        );
      })
  );

  it.effect("refuses a photo that is not a JPEG, before saving anything", () =>
    Effect.gen(function* refuseNotJpeg() {
      yield* TestClock.setTime(MONDAY_NOON);
      const { book, layer, stored } = yield* world;
      const exit = yield* bookAppointment(
        form({
          photos: [{ data: btoa("<svg/>"), kind: "now" }],
          services: ["dimensional-color"],
        }),
        request
      ).pipe(Effect.provide(layer), Effect.exit);

      expect(Exit.isFailure(exit) && exit.cause.toString()).toContain(
        "PhotoRejected"
      );
      expect([
        (yield* Ref.get(book)).length,
        (yield* Ref.get(stored)).length,
      ]).toStrictEqual([0, 0]);
    })
  );

  it.effect("stores no photos when the time is already taken", () =>
    Effect.gen(function* noOrphans() {
      yield* TestClock.setTime(MONDAY_NOON);
      const { layer, stored } = yield* world;
      yield* bookAppointment(form(), request).pipe(Effect.provide(layer));
      const exit = yield* bookAppointment(
        form({
          name: "Sam Lee",
          photos: [{ data: JPEG, kind: "now" }],
          services: ["dimensional-color"],
        }),
        request
      ).pipe(Effect.provide(layer), Effect.exit);

      expect([
        Exit.isFailure(exit) &&
          exit.cause.toString().includes("SlotUnavailable"),
        (yield* Ref.get(stored)).length,
      ]).toStrictEqual([true, 0]);
    })
  );

  it.effect("ignores photos sent with a visit that does not ask for them", () =>
    Effect.gen(function* ignoreUnasked() {
      yield* TestClock.setTime(MONDAY_NOON);
      const { book, layer, stored } = yield* world;
      yield* bookAppointment(
        form({
          hairHistory: "vivid-color",
          photos: [{ data: JPEG, kind: "now" }],
        }),
        request
      ).pipe(Effect.provide(layer));

      expect(
        (yield* Ref.get(book)).map((item) => [
          item.service,
          item.hairPhotos.length,
          item.hairHistory ?? "no answer",
        ])
      ).toStrictEqual([["Men's cut", 0, "no answer"]]);
      expect(yield* Ref.get(stored)).toHaveLength(0);
    })
  );

  it.effect("refuses a time outside opening hours", () =>
    Effect.gen(function* refuseClosed() {
      yield* TestClock.setTime(MONDAY_NOON);
      const { layer } = yield* world;
      // Wednesday is not in the hours.
      const exit = yield* bookAppointment(
        form({ start: "2026-10-28T17:00:00.000Z" }),
        request
      ).pipe(Effect.provide(layer), Effect.exit);
      expect(Exit.isFailure(exit) && exit.cause.toString()).toContain(
        "SlotUnavailable"
      );
    })
  );
});

describe(cancelByClient, () => {
  it.effect(
    "cancels with the link's token, not with a guess, and frees the time",
    () =>
      Effect.gen(function* cancelWithToken() {
        yield* TestClock.setTime(MONDAY_NOON);
        const { book, layer, sent } = yield* world;
        const booked = yield* bookAppointment(form(), request).pipe(
          Effect.provide(layer)
        );
        const token = new URL(booked.manageUrl).searchParams.get("t") ?? "";

        const guess = yield* cancelByClient({
          id: booked.id,
          token: "a".repeat(32),
        }).pipe(Effect.provide(layer), Effect.exit);
        expect(Exit.isFailure(guess) && guess.cause.toString()).toContain(
          "AppointmentNotFound"
        );

        const result = yield* cancelByClient({ id: booked.id, token }).pipe(
          Effect.provide(layer)
        );
        expect(result).toStrictEqual({ alreadyCancelled: false });
        expect((yield* Ref.get(book)).map((item) => item.state)).toStrictEqual([
          "cancelled",
        ]);
        expect(
          (yield* Ref.get(sent)).map((message) => message.subject).slice(2)
        ).toStrictEqual([
          "Cancelled: Men's cut, Tuesday, October 27 at 10:00 AM",
          "Cancelled: Pat Rivera, Tuesday, October 27 at 10:00 AM",
        ]);
      })
  );

  it.effect("opens a cancelled time to the next client", () =>
    Effect.gen(function* freeAgain() {
      yield* TestClock.setTime(MONDAY_NOON);
      const { layer } = yield* world;
      const booked = yield* bookAppointment(form(), request).pipe(
        Effect.provide(layer)
      );
      const token = new URL(booked.manageUrl).searchParams.get("t") ?? "";
      yield* cancelByClient({ id: booked.id, token }).pipe(
        Effect.provide(layer)
      );

      const again = yield* bookAppointment(
        form({ name: "Sam Lee" }),
        request
      ).pipe(Effect.provide(layer));
      expect(again).toMatchObject({ id: "appt-2", start: TUESDAY_TEN });
    })
  );

  it.effect(
    "sends the client to the phone inside the cancellation window",
    () =>
      Effect.gen(function* tooLate() {
        yield* TestClock.setTime(MONDAY_NOON);
        const { layer } = yield* world;
        const booked = yield* bookAppointment(form(), request).pipe(
          Effect.provide(layer)
        );
        const token = new URL(booked.manageUrl).searchParams.get("t") ?? "";
        // Monday 2026-10-26 at noon PDT: 22 hours before the appointment.
        yield* TestClock.setTime(Date.parse("2026-10-26T19:00:00Z"));

        const exit = yield* cancelByClient({ id: booked.id, token }).pipe(
          Effect.provide(layer),
          Effect.exit
        );
        expect(Exit.isFailure(exit) && exit.cause.toString()).toContain(
          "TooLateToCancel"
        );
      })
  );
});

/** The token from a booking's manage link. */
const linkToken = (manageUrl: string) =>
  new URL(manageUrl).searchParams.get("t") ?? "";

/** Tuesday 2026-10-27, 2:00 PM PDT. */
const TUESDAY_TWO = "2026-10-27T21:00:00.000Z";

describe(rescheduleByClient, () => {
  it.effect(
    "moves the booking in place, keeps the link, frees the old time, and tells both",
    () =>
      Effect.gen(function* moveBooking() {
        yield* TestClock.setTime(MONDAY_NOON);
        const { book, layer, sent } = yield* world;
        const booked = yield* bookAppointment(form(), request).pipe(
          Effect.provide(layer)
        );
        const token = linkToken(booked.manageUrl);

        const result = yield* rescheduleByClient({
          id: booked.id,
          start: TUESDAY_TWO,
          token,
        }).pipe(Effect.provide(layer));
        expect(result).toStrictEqual({
          end: "2026-10-27T21:45:00.000Z",
          moved: true,
          start: TUESDAY_TWO,
        });
        expect(
          (yield* Ref.get(book)).map((item) => [
            item.id,
            item.start.toISOString(),
            item.state,
          ])
        ).toStrictEqual([["appt-1", TUESDAY_TWO, "confirmed"]]);

        const [toClient, toAni] = (yield* Ref.get(sent)).slice(2);
        expect([
          toClient?.to,
          toClient?.subject,
          toAni?.to,
          toAni?.subject,
        ]).toStrictEqual([
          "pat@example.com",
          "Moved: Men's cut, Tuesday, October 27 at 2:00 PM",
          ["ani@example.com"],
          "Moved: Pat Rivera, now Tuesday, October 27 at 2:00 PM",
        ]);
        // The same link still opens it, and the old time is named so they can delete it.
        expect([
          toClient?.text.includes(
            `Need to change or cancel? https://aniwenger.example/appointment/appt-1?t=${token}`
          ),
          toClient?.text.includes("It was Tuesday, October 27 at 10:00 AM."),
          toAni?.text.includes(
            "Was: Tuesday, October 27 at 10:00 AM. That time is open again on the website."
          ),
        ]).toStrictEqual([true, true, true]);

        const next = yield* bookAppointment(
          form({ name: "Sam Lee" }),
          request
        ).pipe(Effect.provide(layer));
        expect(next).toMatchObject({ id: "appt-2", start: TUESDAY_TEN });
      })
  );

  it.effect("lets a client move into time their own booking holds", () =>
    Effect.gen(function* overlapOwn() {
      yield* TestClock.setTime(MONDAY_NOON);
      const { book, layer } = yield* world;
      const booked = yield* bookAppointment(form(), request).pipe(
        Effect.provide(layer)
      );
      // 10:30 overlaps the 10:00 to 10:45 visit being moved.
      yield* rescheduleByClient({
        id: booked.id,
        start: "2026-10-27T17:30:00.000Z",
        token: linkToken(booked.manageUrl),
      }).pipe(Effect.provide(layer));
      expect(
        (yield* Ref.get(book)).map((item) => item.start.toISOString())
      ).toStrictEqual(["2026-10-27T17:30:00.000Z"]);
    })
  );

  it.effect(
    "refuses a time someone else holds and leaves the booking as it was",
    () =>
      Effect.gen(function* takenTime() {
        yield* TestClock.setTime(MONDAY_NOON);
        const { book, layer, sent } = yield* world;
        const booked = yield* bookAppointment(form(), request).pipe(
          Effect.provide(layer)
        );
        yield* bookAppointment(
          form({ name: "Sam Lee", start: TUESDAY_TWO }),
          request
        ).pipe(Effect.provide(layer));

        const exit = yield* rescheduleByClient({
          id: booked.id,
          start: TUESDAY_TWO,
          token: linkToken(booked.manageUrl),
        }).pipe(Effect.provide(layer), Effect.exit);
        expect(Exit.isFailure(exit) && exit.cause.toString()).toContain(
          "SlotUnavailable"
        );
        expect(
          (yield* Ref.get(book)).map((item) => item.start.toISOString())
        ).toStrictEqual([TUESDAY_TEN, TUESDAY_TWO]);
        expect(yield* Ref.get(sent)).toHaveLength(4);
      })
  );

  it.effect("needs the link's token", () =>
    Effect.gen(function* wrongToken() {
      yield* TestClock.setTime(MONDAY_NOON);
      const { book, layer } = yield* world;
      const booked = yield* bookAppointment(form(), request).pipe(
        Effect.provide(layer)
      );
      const exit = yield* rescheduleByClient({
        id: booked.id,
        start: TUESDAY_TWO,
        token: "a".repeat(32),
      }).pipe(Effect.provide(layer), Effect.exit);
      expect(Exit.isFailure(exit) && exit.cause.toString()).toContain(
        "AppointmentNotFound"
      );
      expect(
        (yield* Ref.get(book)).map((item) => item.start.toISOString())
      ).toStrictEqual([TUESDAY_TEN]);
    })
  );

  it.effect(
    "sends the client to the phone within 24 hours of the appointment",
    () =>
      Effect.gen(function* tooLateToMove() {
        yield* TestClock.setTime(MONDAY_NOON);
        const { book, layer } = yield* world;
        const booked = yield* bookAppointment(form(), request).pipe(
          Effect.provide(layer)
        );
        const token = linkToken(booked.manageUrl);
        // Monday 2026-10-26 at noon PDT: 22 hours before the appointment.
        yield* TestClock.setTime(Date.parse("2026-10-26T19:00:00Z"));

        const move = yield* rescheduleByClient({
          id: booked.id,
          start: "2026-11-03T18:00:00.000Z",
          token,
        }).pipe(Effect.provide(layer), Effect.exit);
        const times = yield* rescheduleTimes({
          days: 14,
          from: "2026-10-26",
          id: booked.id,
          token,
        }).pipe(Effect.provide(layer), Effect.exit);
        expect([
          Exit.isFailure(move) &&
            move.cause.toString().includes("TooLateToReschedule"),
          Exit.isFailure(times) &&
            times.cause.toString().includes("TooLateToReschedule"),
        ]).toStrictEqual([true, true]);
        expect(
          (yield* Ref.get(book)).map((item) => item.start.toISOString())
        ).toStrictEqual([TUESDAY_TEN]);
      })
  );

  it.effect(
    "reminds before a time moved days ahead, but not one moved into the next day",
    () =>
      Effect.gen(function* remindersAfterMove() {
        yield* TestClock.setTime(MONDAY_NOON);
        const { book, layer, sent } = yield* world;
        // Tuesday 2026-10-27 at 5:00 PM PDT.
        const late = yield* bookAppointment(
          form({ start: "2026-10-28T00:00:00.000Z" }),
          request
        ).pipe(Effect.provide(layer));
        const early = yield* bookAppointment(
          form({ name: "Sam Lee" }),
          request
        ).pipe(Effect.provide(layer));

        // Sam moves a week out, to Tuesday 2026-11-03 at 10:00 AM PST.
        yield* rescheduleByClient({
          id: early.id,
          start: "2026-11-03T18:00:00.000Z",
          token: linkToken(early.manageUrl),
        }).pipe(Effect.provide(layer));
        // Monday 2026-10-26 at 4:00 PM PDT, 25 hours before Pat's 5:00 PM
        // visit, Pat moves it to 10:15 AM tomorrow, 18 hours out.
        yield* TestClock.setTime(Date.parse("2026-10-26T23:00:00Z"));
        yield* rescheduleByClient({
          id: late.id,
          start: "2026-10-27T17:15:00.000Z",
          token: linkToken(late.manageUrl),
        }).pipe(Effect.provide(layer));
        expect(
          (yield* Ref.get(book)).map((item) => [
            item.clientName,
            item.reminderSent,
          ])
        ).toStrictEqual([
          ["Pat Rivera", true],
          ["Sam Lee", false],
        ]);

        yield* TestClock.setTime(Date.parse("2026-10-27T00:00:00Z"));
        expect(
          yield* sendReminders().pipe(Effect.provide(layer))
        ).toStrictEqual({
          reminded: 0,
        });
        // Monday 2026-11-02 at 11:00 AM PST: 23 hours before Sam's new time.
        yield* TestClock.setTime(Date.parse("2026-11-02T19:00:00Z"));
        expect(
          yield* sendReminders().pipe(Effect.provide(layer))
        ).toStrictEqual({
          reminded: 1,
        });
        expect((yield* Ref.get(sent)).at(-1)?.text).toContain(
          "A reminder of your Men's cut on Tuesday, November 3 at 10:00 AM."
        );
      })
  );
});

describe(rescheduleTimes, () => {
  it.effect(
    "offers times over the client's own booking but not over someone else's",
    () =>
      Effect.gen(function* timesToMove() {
        yield* TestClock.setTime(MONDAY_NOON);
        const { layer } = yield* world;
        const booked = yield* bookAppointment(form(), request).pipe(
          Effect.provide(layer)
        );
        yield* bookAppointment(
          form({ name: "Sam Lee", start: TUESDAY_TWO }),
          request
        ).pipe(Effect.provide(layer));

        const { days } = yield* rescheduleTimes({
          days: 1,
          from: "2026-10-27",
          id: booked.id,
          token: linkToken(booked.manageUrl),
        }).pipe(Effect.provide(layer));
        const starts = new Set(
          days.flatMap((day) => day.slots.map((slot) => slot.start))
        );
        // 10:00 and 10:15 overlap Pat's own visit; 1:30 and 2:00 overlap Sam's.
        expect([
          starts.has("2026-10-27T17:00:00.000Z"),
          starts.has("2026-10-27T17:15:00.000Z"),
          starts.has("2026-10-27T20:30:00.000Z"),
          starts.has(TUESDAY_TWO),
        ]).toStrictEqual([true, true, false, false]);
      })
  );
});

describe(canCancel, () => {
  it("allows online cancelling only for confirmed visits outside the cutoff", () => {
    const start = new Date(TUESDAY_TEN);
    expect([
      canCancel({ start, state: "confirmed" }, 24, at("2026-10-26T16:00:00Z")),
      canCancel({ start, state: "confirmed" }, 24, at("2026-10-26T18:00:00Z")),
      canCancel({ start, state: "cancelled" }, 24, at("2026-10-20T18:00:00Z")),
    ]).toStrictEqual([true, false, false]);
  });
});

describe(sendReminders, () => {
  it.effect("reminds a client who booked days ahead, once", () =>
    Effect.gen(function* remindOnce() {
      yield* TestClock.setTime(MONDAY_NOON);
      const { book, layer, sent } = yield* world;
      yield* bookAppointment(form(), request).pipe(Effect.provide(layer));
      // Monday 2026-10-26 at 11:00 PDT: the appointment is 23 hours away.
      yield* TestClock.setTime(Date.parse("2026-10-26T18:00:00Z"));

      expect(yield* sendReminders().pipe(Effect.provide(layer))).toStrictEqual({
        reminded: 1,
      });
      expect(yield* sendReminders().pipe(Effect.provide(layer))).toStrictEqual({
        reminded: 0,
      });
      expect((yield* Ref.get(sent)).at(-1)?.subject).toBe(
        "Reminder: Men's cut tomorrow"
      );
      expect(
        (yield* Ref.get(book)).map((item) => item.reminderSent)
      ).toStrictEqual([true]);
    })
  );
});

/**
 * Keeping Ani's work calendar in step with online booking: the minute tick
 * reads her calendar link every few minutes and stores its busy times, and the
 * booking calendar treats them like time off. A read that fails keeps the last
 * good busy times, so a hiccup at iCloud never opens up her day.
 */
import { Clock, Effect, Option, Schema } from "effect";

import type { Busy } from "./availability.ts";
import { busyFromCalendar, calendarAddress } from "./outside-calendar.ts";
import { CalendarUnreadable, OutsideCalendar } from "./services.ts";
import type { OutsideCalendarRead } from "./services.ts";

const MS_PER_DAY = 86_400_000;
/** Busy times are kept from yesterday to this many days ahead, past any booking horizon. */
export const DAYS_AHEAD = 400;
/** More than this and the calendar is not a work calendar; the rest is dropped. */
export const MAX_BUSY = 2000;

/** The pasted text is not a web address. */
export class InvalidCalendarLink extends Schema.TaggedError<InvalidCalendarLink>()(
  "InvalidCalendarLink",
  {}
) {}

const now = Clock.currentTimeMillis.pipe(
  Effect.map((millis) => new Date(millis))
);

/** The busy times from her calendar that overlap [from, to); none until it is connected and read. */
export const outsideBusy = Effect.fn("outsideBusy")(function* outsideBusy(
  from: Date,
  to: Date
) {
  const calendar = yield* OutsideCalendar;
  const [link, read] = yield* Effect.all([calendar.link, calendar.lastRead]);
  const busy: readonly Busy[] =
    Option.isSome(link) &&
    Option.isSome(read) &&
    read.value.address === link.value
      ? read.value.busy
      : [];
  return busy.filter(
    (block) =>
      block.start.getTime() < to.getTime() &&
      block.end.getTime() > from.getTime()
  );
});

/** Downloads and reads one address, without saving anything. */
const readAddress = Effect.fn("readAddress")(function* readAddress(
  address: string,
  timeZone: string,
  at: Date
) {
  const calendar = yield* OutsideCalendar;
  const file = yield* calendar.download(address);
  const busy = yield* Effect.try({
    catch: (cause) =>
      new CalendarUnreadable({
        reason: cause instanceof Error ? cause.message : "Unreadable",
      }),
    try: () =>
      busyFromCalendar(file, {
        from: new Date(at.getTime() - MS_PER_DAY),
        timeZone,
        to: new Date(at.getTime() + DAYS_AHEAD * MS_PER_DAY),
      }),
  });
  return busy.slice(0, MAX_BUSY);
});

/**
 * Reads the connected calendar and stores what it found. When the read fails,
 * the last good busy times stay and the failure is recorded for the Schedule
 * page. Answers the stored read, or none when no calendar is connected.
 */
export const refreshOutsideCalendar = Effect.fn("refreshOutsideCalendar")(
  function* refreshOutsideCalendar(timeZone: string) {
    const calendar = yield* OutsideCalendar;
    const link = yield* calendar.link;
    if (Option.isNone(link)) {
      return Option.none<OutsideCalendarRead>();
    }
    const address = link.value;
    const at = yield* now;
    const read = yield* readAddress(address, timeZone, at).pipe(
      Effect.map((busy): OutsideCalendarRead => ({
        address,
        busy,
        checkedAt: at,
        failed: false,
        readAt: at,
      })),
      Effect.catchTag("CalendarUnreadable", (error) =>
        Effect.gen(function* keepLastGood() {
          yield* Effect.logWarning("work calendar not read").pipe(
            Effect.annotateLogs({ reason: error.reason })
          );
          const last = (yield* calendar.lastRead).pipe(
            Option.filter((previous) => previous.address === address)
          );
          return {
            address,
            busy: Option.match(last, {
              onNone: () => [],
              onSome: (previous) => previous.busy,
            }),
            checkedAt: at,
            failed: true,
            readAt: Option.getOrUndefined(last)?.readAt,
          } satisfies OutsideCalendarRead;
        })
      )
    );
    yield* calendar.saveRead(read);
    return Option.some(read);
  }
);

/**
 * Connects the link Ani pasted, but only once it reads as a calendar, so a
 * wrong paste never replaces a link that works.
 */
export const connectOutsideCalendar = Effect.fn("connectOutsideCalendar")(
  function* connectOutsideCalendar(pasted: string, timeZone: string) {
    const calendar = yield* OutsideCalendar;
    const address = calendarAddress(pasted);
    if (address === undefined) {
      return yield* new InvalidCalendarLink();
    }
    const at = yield* now;
    const busy = yield* readAddress(address, timeZone, at);
    const read: OutsideCalendarRead = {
      address,
      busy,
      checkedAt: at,
      failed: false,
      readAt: at,
    };
    yield* calendar.saveRead(read);
    yield* calendar.setLink(Option.some(address));
    return read;
  }
);

/** Stops reading her calendar; its busy times stop counting at once. */
export const disconnectOutsideCalendar = Effect.fn("disconnectOutsideCalendar")(
  function* disconnectOutsideCalendar() {
    const calendar = yield* OutsideCalendar;
    yield* calendar.setLink(Option.none());
  }
);

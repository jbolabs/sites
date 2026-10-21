/**
 * The booking lock: one row in a site-owned D1 table, next to EmDash's.
 *
 * D1 runs one SQL statement at a time, but EmDash cannot make "check the
 * calendar, then save" a single statement, so the booking runs while holding
 * this row. Taking it is one atomic upsert that succeeds only when the row is
 * free or its holder has expired (a Worker that died mid-booking). The table
 * is created on first use, so every stage (and CI's local Worker) has it with
 * no migration step. See docs/adr/0008-appointment-booking.md.
 */
import { Effect, Layer, Schedule, Schema } from "effect";

import { BookingLock, CalendarBusy, StoreFailed } from "./services.ts";

/**
 * Far longer than a booking takes (a check and one save, well under a second);
 * it only frees the lock when a Worker dies holding it. The save is not
 * fenced by the lease, so the lease must outlast any realistic request.
 */
const LEASE_MS = 60_000;
const RETRIES = 25;

const CREATE = `CREATE TABLE IF NOT EXISTS site_booking_lock (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  holder TEXT NOT NULL,
  expires_at INTEGER NOT NULL
)`;

const ACQUIRE = `INSERT INTO site_booking_lock (id, holder, expires_at) VALUES (1, ?1, ?2)
  ON CONFLICT (id) DO UPDATE SET holder = excluded.holder, expires_at = excluded.expires_at
  WHERE site_booking_lock.expires_at < ?3`;

const RELEASE = "DELETE FROM site_booking_lock WHERE id = 1 AND holder = ?1";

class LockTaken extends Schema.TaggedError<LockTaken>()("LockTaken", {}) {}

export const bookingLockD1 = (db: D1Database) =>
  Layer.succeed(BookingLock, {
    withLock: (effect) => {
      const holder = crypto.randomUUID();
      const acquire = Effect.tryPromise({
        catch: (cause) => new StoreFailed({ cause }),
        try: async () => {
          const now = Date.now();
          const [, taken] = await db.batch([
            db.prepare(CREATE),
            db.prepare(ACQUIRE).bind(holder, now + LEASE_MS, now),
          ]);
          return (taken?.meta.changes ?? 0) === 1;
        },
      }).pipe(
        Effect.flatMap((acquired) =>
          acquired ? Effect.void : Effect.fail(new LockTaken())
        ),
        Effect.retry({
          schedule: Schedule.spaced("120 millis"),
          times: RETRIES,
          while: (error) => error instanceof LockTaken,
        }),
        Effect.catchIf(
          (error): error is LockTaken => error instanceof LockTaken,
          () => Effect.fail(new CalendarBusy())
        )
      );
      const release = Effect.tryPromise(
        async () => await db.prepare(RELEASE).bind(holder).run()
      ).pipe(Effect.ignore);
      return Effect.acquireUseRelease(
        acquire,
        () => effect,
        () => release
      ).pipe(Effect.withSpan("BookingLock.withLock"));
    },
  });

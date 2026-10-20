# 5. Appointment booking: built on EmDash and D1, not a booking vendor

- Status: proposed
- Date: 2026-10-20

## Context

Ani Wenger (`apps/ani-wenger`) is a hairstylist; her site needs a service menu with lengths and prices, a calendar of open times, online booking, cancellation, reminders, and a schedule she can read on her phone. The stack's principle is as few vendors as possible, and the client already edits her site in the EmDash admin.

EmDash 1.1 constraints that shape the design:

- D1 gives EmDash no multi-statement transactions (`emdash/src/database/transaction.ts`), and the field-level `unique` flag is metadata only. "Check the calendar, then save" cannot be one EmDash operation.
- Plugin-storage unique indexes are created by the scheduler tick, which preview stages do not run, so they cannot be relied on as a guard.
- Public requests get no write handlers on `locals`; trusted server code uses `withEmDashRuntime`, which always reads the primary database.
- There is no date-only field type; `datetime` values are normalized to UTC ISO strings.

## Decision

Bookings are EmDash content, guarded by a site-owned D1 lock:

- **Appointments** are a non-routable `appointments` collection (draft status, like leads), so Ani sees, edits, and adds appointments in the admin she already uses. `time_off`, `services`, and the single `studio` entry ("Salon and hours": weekly hours, notice, horizon, cancellation cutoff) are collections too.
- **The lock** is one row in `site_booking_lock` in the same D1 database, taken with a single atomic upsert that succeeds only when the row is free or its 15-second lease expired. The availability re-check and the save run while holding it. The table is created on first use (`CREATE TABLE IF NOT EXISTS` in the same batch), so every stage and CI's local Worker have it without a migration step. The name avoids EmDash's `ec_`, `_emdash_`, and `_plugin_` prefixes.
- **Scheduling rules** are pure functions (`apps/ani-wenger/src/lib/booking/availability.ts`, `calendar.ts`) that take the clock as input. The same function answers the calendar and the final check before saving.
- **Ani's admin** gets a site plugin (`src/plugins/schedule-plugin.ts`, Block Kit): upcoming appointments with Cancel (which emails the client), a dashboard card, and her private calendar-feed address.

No booking vendor (Square, Vagaro, Cal.com) and no payments.

## Design

- `src/lib/booking/services.ts`: Effect services `Appointments`, `Catalog`, `BookingLock`, `BookingMail`. `emdash-store.ts` implements the first two through `withEmDashRuntime` and decodes every row with Effect Schema; `lock.ts` implements the lock on `env.DB`.
- `src/lib/booking/booking.ts`: the pipelines `openTimes`, `bookAppointment` (Turnstile, then lock, re-check, save, then mail), `cancelByClient`, `cancelByStudio`, `sendReminders`. Saving is the point of no return; mail after it only logs on failure.
- Client links: each booking stores the SHA-256 of a random token; `/appointment/<id>?t=<token>` shows, adds to a calendar (`event.ics`), and cancels. A wrong id or token answers the same "not found".
- Ani's calendar: `/calendar/<key>.ics`, where the key is an `Alchemy.Random` per stage (`CALENDAR_FEED_KEY`). Calendar apps cannot sign in, so the URL is the credential.
- Reminders ride EmDash's minute cron every quarter hour (`src/worker.ts`), for appointments within 24 hours that were booked at least 36 hours ahead. Crons run on prod only, so previews send no reminders.
- Mail reuses the contact form's sender and inbox bindings (`LEAD_NOTIFY_FROM`, `LEAD_NOTIFY_TO`); client mail replies to Ani's address.

## Alternatives considered

- **A booking vendor embed** (Square Appointments, Vagaro, GlossGenius, Cal.com): payments and SMS out of the box, but another vendor and account per client, an off-brand widget, and appointments outside the CMS. Revisit if a client needs deposits or already runs one.
- **A site-owned `appointments` table**: real constraints, but Ani would lose EmDash's list, edit, and create screens, and every admin view would be custom Block Kit.
- **Plugin storage with unique indexes**: atomic primitives, but the indexes only appear after a scheduler tick that previews never run.
- **A Durable Object per calendar**: serializes perfectly, but adds a binding, a class export, and a second storage location for one stylist's handful of daily bookings.

## Consequences

- Concurrency is proven by a local race (three simultaneous requests for one time: one booked, two told it was taken) and by unit tests of the pipeline with fakes; the lock serializes all bookings, which is fine at one stylist's volume.
- Editors can change an appointment's time in the admin without the lock. That is Ani's own calendar, and the next availability check sees her change.
- Appointments are drafts in a non-routable collection, so the published-content exporter (ADR 3) and public queries never see client details. Backups include them.
- No payments, deposits, SMS, or two-way Google Calendar sync. The ICS feed is one way, and Google refreshes subscribed calendars every few hours (Apple every 15 minutes).
- Booking mail needs a verified sender, as the contact form does; until then confirmations are logged, not sent.

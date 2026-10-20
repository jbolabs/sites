import type { EmailAddress } from "@jakebodea/cloudflare-kit/server";
/**
 * What the booking pipeline needs from the outside world, as Effect services:
 * the appointment book, the service menu and salon rules, a lock that makes
 * "is this time free? then take it" one step, and mail routing. EmDash/D1
 * implementations live in `emdash-store.ts` and `lock.ts`; tests pass fakes.
 */
import { Config, Context, Effect, Layer, Option, Schema } from "effect";

import type { HairHistory } from "../labels.ts";
import type { BookingRules, Busy } from "./availability.ts";

export const APPOINTMENT_STATES = [
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
] as const;
export type AppointmentState = (typeof APPOINTMENT_STATES)[number];

export interface Appointment {
  readonly id: string;
  readonly clientName: string;
  readonly email: string | undefined;
  readonly phone: string | undefined;
  readonly notes: string | undefined;
  readonly service: string;
  readonly serviceSlug: string | undefined;
  readonly hairHistory: HairHistory | undefined;
  /** Photos the client sent, as `HairPhotoLink`s (see `hair-photos.ts`). */
  readonly hairPhotos: readonly HairPhotoLink[];
  readonly start: Date;
  readonly durationMinutes: number;
  readonly bufferMinutes: number;
  readonly state: AppointmentState;
  readonly reminderSent: boolean;
  readonly tokenHash: string | undefined;
  readonly createdAt: Date;
}

export interface NewAppointment {
  readonly clientName: string;
  readonly email: string;
  readonly phone: string;
  readonly notes: string | undefined;
  readonly service: string;
  /** Every service in the visit, comma-separated. */
  readonly serviceSlug: string;
  readonly hairHistory: HairHistory | undefined;
  readonly hairPhotos: readonly HairPhotoLink[];
  readonly start: Date;
  readonly durationMinutes: number;
  readonly bufferMinutes: number;
  readonly tokenHash: string;
}

/** When an appointment ends, cleanup included: nothing else may start before then. */
export const occupiedUntil = (appointment: {
  readonly start: Date;
  readonly durationMinutes: number;
  readonly bufferMinutes: number;
}): Date =>
  new Date(
    appointment.start.getTime() +
      (appointment.durationMinutes + appointment.bufferMinutes) * 60_000
  );

export const endsAt = (appointment: {
  readonly start: Date;
  readonly durationMinutes: number;
}): Date =>
  new Date(appointment.start.getTime() + appointment.durationMinutes * 60_000);

export class StoreFailed extends Schema.TaggedError<StoreFailed>()(
  "StoreFailed",
  { cause: Schema.Defect() }
) {}

/** Another booking holds the lock longer than we are willing to wait. */
export class CalendarBusy extends Schema.TaggedError<CalendarBusy>()(
  "CalendarBusy",
  {}
) {}

export class Appointments extends Context.Service<
  Appointments,
  {
    /** Appointments (any state) starting in [from, to). */
    readonly between: (
      from: Date,
      to: Date
    ) => Effect.Effect<readonly Appointment[], StoreFailed>;
    /** Time off overlapping [from, to). */
    readonly timeOff: (
      from: Date,
      to: Date
    ) => Effect.Effect<readonly Busy[], StoreFailed>;
    readonly find: (
      id: string
    ) => Effect.Effect<Option.Option<Appointment>, StoreFailed>;
    readonly create: (
      appointment: NewAppointment
    ) => Effect.Effect<{ readonly id: string }, StoreFailed>;
    readonly setState: (
      id: string,
      state: AppointmentState
    ) => Effect.Effect<void, StoreFailed>;
    readonly markReminded: (id: string) => Effect.Effect<void, StoreFailed>;
  }
>()("ani-wenger/Appointments") {}

/** A service as the booking flow sees it. */
export interface BookableService {
  readonly slug: string;
  readonly title: string;
  readonly durationMinutes: number;
  readonly bufferMinutes: number;
  /** Dollars; 0 is complimentary, absent is unlisted. */
  readonly price?: number | undefined;
  readonly priceFrom: boolean;
  /** Only booked together with a main service. */
  readonly addOn: boolean;
  readonly asksForPhotos: boolean;
}

/** Which photo it is: the hair as it is now, or the look the client wants. */
export const PHOTO_KINDS = ["now", "goal"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export interface HairPhotoLink {
  readonly kind: PhotoKind;
  /** Root-relative: `/hair-photos/<name>.jpg`. */
  readonly path: string;
}

/** The private photo store. Names are random, so a photo's address is its key. */
export class HairPhotos extends Context.Service<
  HairPhotos,
  {
    /** Stores a JPEG and returns its root-relative path. */
    readonly put: (jpeg: Uint8Array) => Effect.Effect<string, StoreFailed>;
  }
>()("ani-wenger/HairPhotos") {}

/** The salon rules plus what confirmations need to say. */
export interface SalonPolicy {
  readonly rules: BookingRules;
  readonly cancelCutoffHours: number;
  readonly location: string;
  readonly phone: string;
  readonly bookingNote: string;
}

export class Catalog extends Context.Service<
  Catalog,
  {
    /** A published service clients may book online. */
    readonly service: (
      slug: string
    ) => Effect.Effect<Option.Option<BookableService>, StoreFailed>;
    readonly policy: Effect.Effect<SalonPolicy, StoreFailed>;
  }
>()("ani-wenger/Catalog") {}

/**
 * Serializes bookings: the availability check and the save run while holding
 * it, so two clients choosing the same time cannot both get it.
 */
export class BookingLock extends Context.Service<
  BookingLock,
  {
    readonly withLock: <A, E, R>(
      effect: Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E | CalendarBusy | StoreFailed, R>;
  }
>()("ani-wenger/BookingLock") {}

export interface BookingMailRoutes {
  readonly siteName: string;
  readonly siteOrigin: string;
  /** The verified sender; without one, mail is logged instead of sent. */
  readonly from: Option.Option<EmailAddress>;
  /** Ani's inbox for new bookings and cancellations. */
  readonly studioInbox: Option.Option<string>;
  /** Where client replies go: Ani's own address. */
  readonly replyTo: string;
}

export class BookingMail extends Context.Service<
  BookingMail,
  BookingMailRoutes
>()("ani-wenger/BookingMail") {}

const nonEmpty = (name: string) =>
  Config.String(name).pipe(
    Config.option,
    Config.map(Option.filter((value) => value !== ""))
  );

/** Reads the same sender and inbox bindings as the contact form (`leadMail` in the stack). */
export const bookingMailFromConfig = (options: {
  readonly siteName: string;
  readonly replyTo: string;
}) =>
  Layer.effect(
    BookingMail,
    Effect.gen(function* loadBookingMail() {
      const from = yield* nonEmpty("LEAD_NOTIFY_FROM");
      const studioInbox = yield* nonEmpty("LEAD_NOTIFY_TO");
      const siteOrigin = yield* Config.String("SITE_ORIGIN");
      return {
        from: from.pipe(
          Option.map((email) => ({ email, name: options.siteName }))
        ),
        replyTo: options.replyTo,
        siteName: options.siteName,
        siteOrigin,
        studioInbox,
      };
    })
  );

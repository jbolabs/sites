/**
 * The booking pipelines: open times for the calendar, booking a time,
 * cancelling (by the client or by Ani), and day-before reminders.
 *
 * Saving the appointment is the point of no return. Everything before it can
 * fail and the client simply tries again; mail after it only logs on failure,
 * because the appointment is safe in the CMS and the client saw it confirmed.
 */
import {
  Email,
  Turnstile,
  isEmailAddress,
} from "@jakebodea/cloudflare-kit/server";
import type { EmailMessage } from "@jakebodea/cloudflare-kit/server";
import { Clock, Effect, Option, Schema } from "effect";

import { HAIR_HISTORY_ORDER } from "../labels.ts";
import { availableDays, isOpenSlot } from "./availability.ts";
import type { Busy, Day } from "./availability.ts";
import { addDays, fromLocal, isLocalDate } from "./calendar.ts";
import { PhotoUpload, decodePhoto, photosText } from "./hair-photos.ts";
import { googleCalendarUrl } from "./ics.ts";
import type { CalendarEvent } from "./ics.ts";
import {
  clientCancelledMail,
  confirmationMail,
  reminderMail,
  studioCancelledForClientMail,
  studioCancelledMail,
  studioNewBookingMail,
} from "./mail.ts";
import type { MailAppointment, MailContext } from "./mail.ts";
import { MAX_PHOTOS, MAX_PHOTOS_PER_KIND } from "./photo-limits.ts";
import {
  Appointments,
  BookingLock,
  BookingMail,
  Catalog,
  HairPhotos,
  PHOTO_KINDS,
  endsAt,
  occupiedUntil,
} from "./services.ts";
import type { Appointment, HairPhotoLink, SalonPolicy } from "./services.ts";
import { hashToken, newToken, tokenMatches } from "./token.ts";
import { MAX_VISIT_SERVICES, combineVisit, isVisit } from "./visit.ts";
import type { Visit } from "./visit.ts";

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
/** The booking calendar asks for at most this many days at once. */
export const MAX_CALENDAR_DAYS = 42;

/** The service is unknown, unpublished, or not bookable online. */
export class ServiceUnavailable extends Schema.TaggedError<ServiceUnavailable>()(
  "ServiceUnavailable",
  { slug: Schema.String }
) {}

/** The services cannot be booked together (only add-ons, or too many). */
export class InvalidVisit extends Schema.TaggedError<InvalidVisit>()(
  "InvalidVisit",
  { reason: Schema.String }
) {}

/** Someone else took the time, or it is no longer within the booking rules. */
export class SlotUnavailable extends Schema.TaggedError<SlotUnavailable>()(
  "SlotUnavailable",
  {}
) {}

/** No appointment matches the link (wrong id or token; the two are not told apart). */
export class AppointmentNotFound extends Schema.TaggedError<AppointmentNotFound>()(
  "AppointmentNotFound",
  {}
) {}

/** Inside the cancellation window: the client has to call. */
export class TooLateToCancel extends Schema.TaggedError<TooLateToCancel>()(
  "TooLateToCancel",
  { cutoffHours: Schema.Number }
) {}

/** No control characters: names and phones end up in emails and calendar lines. */
const hasControlCharacter = (value: string) => {
  for (let index = 0; index < value.length; index += 1) {
    if ((value.codePointAt(index) ?? 0) < 32) {
      return true;
    }
  }
  return false;
};

const printable = Schema.makeFilter((value: string) =>
  hasControlCharacter(value) ? "Remove special characters" : undefined
);

const trimmed = (min: number, max: number) =>
  Schema.Trim.check(
    Schema.isMinLength(min),
    Schema.isMaxLength(max),
    printable
  );

const Slug = Schema.String.check(Schema.isPattern(/^[a-z0-9-]{1,80}$/u));
const Slugs = Schema.Array(Slug).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(MAX_VISIT_SERVICES)
);

export const AvailabilityRequest = Schema.Struct({
  days: Schema.Number.check(
    Schema.isInt(),
    Schema.isBetween({ maximum: MAX_CALENDAR_DAYS, minimum: 1 })
  ),
  from: Schema.String.check(
    Schema.makeFilter((value: string) =>
      isLocalDate(value) ? undefined : "Expected a YYYY-MM-DD date"
    )
  ),
  services: Slugs,
});
export type AvailabilityRequest = typeof AvailabilityRequest.Type;

/** What the booking form sends. Field limits double as spam guards. */
export const BookingForm = Schema.Struct({
  email: Schema.Trim.check(
    Schema.isMaxLength(254),
    Schema.makeFilter((value: string) =>
      isEmailAddress(value) ? undefined : "Enter a valid email address"
    )
  ),
  /** "What is on your hair now?", asked when the visit includes color. */
  hairHistory: Schema.optional(Schema.Literals(HAIR_HISTORY_ORDER)),
  name: trimmed(2, 120),
  notes: Schema.optional(Schema.Trim.check(Schema.isMaxLength(1000))),
  phone: trimmed(7, 40),
  photos: Schema.optional(
    Schema.Array(PhotoUpload).check(
      Schema.isMaxLength(MAX_PHOTOS),
      Schema.makeFilter((photos: readonly PhotoUpload[]) =>
        PHOTO_KINDS.every(
          (kind) =>
            photos.filter((photo) => photo.kind === kind).length <=
            MAX_PHOTOS_PER_KIND
        )
          ? undefined
          : `At most ${MAX_PHOTOS_PER_KIND} photos of each kind`
      )
    )
  ),
  services: Slugs,
  /** The chosen start, exactly as the calendar offered it (ISO 8601, UTC). */
  start: Schema.String.check(
    Schema.makeFilter((value: string) =>
      Number.isNaN(Date.parse(value))
        ? "Expected an ISO date and time"
        : undefined
    )
  ),
  turnstileToken: Schema.String,
});
export type BookingForm = typeof BookingForm.Type;

export const CancelRequest = Schema.Struct({
  id: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(80)),
  token: Schema.String.check(Schema.isMinLength(16), Schema.isMaxLength(80)),
});
export type CancelRequest = typeof CancelRequest.Type;

export interface BookingRequest {
  readonly remoteIp: string | undefined;
  readonly requestId: string;
}

/** What the confirmation screen shows. */
export interface BookingConfirmation {
  readonly id: string;
  readonly service: string;
  readonly start: string;
  readonly end: string;
  readonly location: string;
  readonly manageUrl: string;
  readonly calendarUrl: string;
  readonly googleCalendarUrl: string;
}

const now = Clock.currentTimeMillis.pipe(
  Effect.map((millis) => new Date(millis))
);

/** Everything that blocks time in [from, to): live appointments (with cleanup) and time off. */
const busyBetween = Effect.fn("busyBetween")(function* busyBetween(
  from: Date,
  to: Date
) {
  const appointments = yield* Appointments;
  // An appointment that starts before the window can still run into it.
  const [booked, away] = yield* Effect.all([
    appointments.between(new Date(from.getTime() - MS_PER_DAY), to),
    appointments.timeOff(from, to),
  ]);
  const taken = booked.flatMap((appointment): Busy[] =>
    appointment.state === "confirmed"
      ? [{ end: occupiedUntil(appointment), start: appointment.start }]
      : []
  );
  return [...taken, ...away];
});

const bookableService = Effect.fn("bookableService")(function* bookableService(
  slug: string
) {
  const catalog = yield* Catalog;
  const service = yield* catalog.service(slug);
  return yield* Option.match(service, {
    onNone: () => Effect.fail(new ServiceUnavailable({ slug })),
    onSome: Effect.succeed,
  });
});

/** The chosen services as one visit: every one bookable, at least one a main service. */
export const visitFor = Effect.fn("visitFor")(function* visitFor(
  slugs: readonly string[]
) {
  const services = yield* Effect.all(
    slugs.map((slug) => bookableService(slug))
  );
  const visit = combineVisit(services);
  return isVisit(visit)
    ? visit
    : yield* new InvalidVisit({ reason: visit.reason });
});

/** Open start times for a visit over a run of days. */
export const openTimes = Effect.fn("openTimes")(function* openTimes(
  request: AvailabilityRequest
) {
  const catalog = yield* Catalog;
  const service: Visit = yield* visitFor(request.services);
  const policy = yield* catalog.policy;
  const { timeZone } = policy.rules;
  const busy = yield* busyBetween(
    fromLocal(request.from, 0, timeZone),
    fromLocal(addDays(request.from, request.days), 0, timeZone)
  );
  const days: Day[] = availableDays({
    busy,
    days: request.days,
    from: request.from,
    now: yield* now,
    rules: policy.rules,
    service: {
      bufferMinutes: service.bufferMinutes,
      durationMinutes: service.durationMinutes,
    },
  });
  return { days, visit: service };
});

const mailContext = (policy: SalonPolicy, siteName: string): MailContext => ({
  location: policy.location,
  phone: policy.phone,
  siteName,
  timeZone: policy.rules.timeZone,
});

const manageUrl = (origin: string, id: string, token: string) =>
  `${origin}/appointment/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`;

const calendarFileUrl = (origin: string, id: string, token: string) =>
  `${origin}/appointment/${encodeURIComponent(id)}/event.ics?t=${encodeURIComponent(token)}`;

export const calendarEvent = (
  appointment: Pick<
    Appointment,
    "id" | "service" | "start" | "durationMinutes"
  > & {
    readonly state?: Appointment["state"];
  },
  policy: Pick<SalonPolicy, "location" | "phone">,
  options: {
    readonly summary: string;
    readonly description: string;
    readonly updated: Date;
  }
): CalendarEvent => ({
  cancelled: appointment.state === "cancelled",
  description: options.description,
  end: endsAt(appointment),
  location: policy.location,
  start: appointment.start,
  summary: options.summary,
  uid: `${appointment.id}@aniwenger`,
  updated: options.updated,
});

/** Sends mail when a sender is configured; a failure is logged, never surfaced. */
const sendQuietly = Effect.fn("sendQuietly")(function* sendQuietly(
  to: EmailMessage["to"] | undefined,
  message: Omit<EmailMessage, "from" | "to">,
  context: Record<string, string>
) {
  const mail = yield* BookingMail;
  const email = yield* Email;
  if (to === undefined || to.length === 0) {
    return;
  }
  yield* Option.match(mail.from, {
    onNone: () =>
      Effect.logInfo("booking mail not sent: no verified sender").pipe(
        Effect.annotateLogs({ subject: message.subject })
      ),
    onSome: (from) =>
      email
        .send({ ...message, from, to })
        .pipe(
          Effect.catchCause(() =>
            Effect.logError("booking mail failed").pipe(
              Effect.annotateLogs({ ...context, subject: message.subject })
            )
          )
        ),
  });
});

const asMail = (appointment: Appointment): MailAppointment => ({
  clientName: appointment.clientName,
  durationMinutes: appointment.durationMinutes,
  email: appointment.email,
  hairHistory: appointment.hairHistory,
  notes: appointment.notes,
  phone: appointment.phone,
  service: appointment.service,
  start: appointment.start,
});

/** Whether a visit of this length can start at `start`, against the live calendar. */
const slotIsOpen = Effect.fn("slotIsOpen")(function* slotIsOpen(
  start: Date,
  length: { readonly durationMinutes: number; readonly bufferMinutes: number },
  policy: SalonPolicy
) {
  const busy = yield* busyBetween(
    new Date(start.getTime() - MS_PER_DAY),
    new Date(start.getTime() + MS_PER_DAY)
  );
  return isOpenSlot({
    busy,
    now: yield* now,
    rules: policy.rules,
    service: length,
    start,
  });
});

/** Books a time: verify the visitor, then check and save while holding the lock. */
export const bookAppointment = Effect.fn("bookAppointment")(
  function* bookAppointment(form: BookingForm, request: BookingRequest) {
    const turnstile = yield* Turnstile;
    const catalog = yield* Catalog;
    const appointments = yield* Appointments;
    const lock = yield* BookingLock;
    const mail = yield* BookingMail;
    const photoStore = yield* HairPhotos;

    yield* turnstile.verify({
      remoteIp: request.remoteIp,
      token: form.turnstileToken,
    });
    const service = yield* visitFor(form.services);
    // Photos and the color answer only belong to visits that ask for them.
    const hairHistory = service.asksForPhotos ? form.hairHistory : undefined;
    const photos = service.asksForPhotos
      ? yield* Effect.all(
          (form.photos ?? []).map((photo) => decodePhoto(photo))
        )
      : [];
    const policy = yield* catalog.policy;
    const start = new Date(form.start);
    const length = {
      bufferMinutes: service.bufferMinutes,
      durationMinutes: service.durationMinutes,
    };
    const token = newToken();
    const tokenHash = yield* Effect.promise(async () => await hashToken(token));
    // A time that is already gone fails here, before any photo is stored.
    if (!(yield* slotIsOpen(start, length, policy))) {
      return yield* new SlotUnavailable();
    }
    // Stored before the lock, which re-checks the time: if someone takes it in
    // between, the photos are orphans the bucket's lifecycle rule deletes, and
    // the lock stays short.
    const hairPhotos: HairPhotoLink[] = yield* Effect.forEach(
      photos,
      (photo) =>
        photoStore
          .put(photo.bytes)
          .pipe(Effect.map((path) => ({ kind: photo.kind, path }))),
      { concurrency: MAX_PHOTOS }
    );

    const { id } = yield* lock.withLock(
      Effect.gen(function* checkAndSave() {
        if (!(yield* slotIsOpen(start, length, policy))) {
          return yield* new SlotUnavailable();
        }
        return yield* appointments.create({
          ...length,
          clientName: form.name,
          email: form.email,
          hairHistory,
          hairPhotos,
          notes: form.notes === "" ? undefined : form.notes,
          phone: form.phone,
          service: service.title,
          serviceSlug: service.services.map((part) => part.slug).join(","),
          start,
          tokenHash,
        });
      })
    );
    yield* Effect.annotateCurrentSpan("appointment.id", id);

    const appointment: MailAppointment = {
      clientName: form.name,
      durationMinutes: service.durationMinutes,
      email: form.email,
      hairHistory,
      notes: form.notes,
      phone: form.phone,
      service: service.title,
      start,
    };
    const context = mailContext(policy, mail.siteName);
    const links = {
      calendarUrl: calendarFileUrl(mail.siteOrigin, id, token),
      manageUrl: manageUrl(mail.siteOrigin, id, token),
    };
    const event = calendarEvent(
      {
        durationMinutes: service.durationMinutes,
        id,
        service: service.title,
        start,
      },
      policy,
      {
        description: `${service.title} with ${mail.siteName}. Change or cancel: ${links.manageUrl}`,
        summary: `${service.title} with ${mail.siteName}`,
        updated: yield* now,
      }
    );
    const logContext = { appointmentId: id, requestId: request.requestId };
    yield* sendQuietly(
      form.email,
      {
        replyTo: mail.replyTo,
        ...confirmationMail(appointment, {
          ...context,
          ...links,
          bookingNote: policy.bookingNote,
        }),
      },
      logContext
    );
    yield* sendQuietly(
      Option.getOrUndefined(mail.studioInbox),
      {
        replyTo: form.email,
        ...studioNewBookingMail(appointment, {
          ...context,
          adminUrl: `${mail.siteOrigin}/_admin`,
          photos: photosText(hairPhotos, mail.siteOrigin),
        }),
      },
      logContext
    );

    return {
      ...links,
      end: endsAt({
        durationMinutes: service.durationMinutes,
        start,
      }).toISOString(),
      googleCalendarUrl: googleCalendarUrl(event),
      id,
      location: policy.location,
      service: service.title,
      start: start.toISOString(),
    } satisfies BookingConfirmation;
  }
);

/** The appointment a manage link points at, or `AppointmentNotFound`. */
export const appointmentForLink = Effect.fn("appointmentForLink")(
  function* appointmentForLink(request: CancelRequest) {
    const appointments = yield* Appointments;
    const found = yield* appointments.find(request.id);
    if (Option.isNone(found)) {
      return yield* new AppointmentNotFound();
    }
    const matches = yield* Effect.promise(
      async () => await tokenMatches(request.token, found.value.tokenHash)
    );
    if (!matches) {
      return yield* new AppointmentNotFound();
    }
    return found.value;
  }
);

/** Whether the client may still cancel online (outside the cutoff, and still confirmed). */
export const canCancel = (
  appointment: Pick<Appointment, "start" | "state">,
  cutoffHours: number,
  at: Date
): boolean =>
  appointment.state === "confirmed" &&
  appointment.start.getTime() - at.getTime() >= cutoffHours * MS_PER_HOUR;

/** The client cancels from the link in their confirmation. Cancelling twice is not an error. */
export const cancelByClient = Effect.fn("cancelByClient")(
  function* cancelByClient(request: CancelRequest) {
    const appointments = yield* Appointments;
    const catalog = yield* Catalog;
    const mail = yield* BookingMail;
    const appointment = yield* appointmentForLink(request);
    if (appointment.state === "cancelled") {
      return { alreadyCancelled: true };
    }
    const policy = yield* catalog.policy;
    if (!canCancel(appointment, policy.cancelCutoffHours, yield* now)) {
      return yield* new TooLateToCancel({
        cutoffHours: policy.cancelCutoffHours,
      });
    }
    yield* appointments.setState(appointment.id, "cancelled");
    const context = mailContext(policy, mail.siteName);
    const logContext = { appointmentId: appointment.id };
    yield* sendQuietly(
      appointment.email,
      {
        replyTo: mail.replyTo,
        ...clientCancelledMail(asMail(appointment), {
          ...context,
          bookUrl: `${mail.siteOrigin}/book`,
        }),
      },
      logContext
    );
    yield* sendQuietly(
      Option.getOrUndefined(mail.studioInbox),
      studioCancelledMail(asMail(appointment), context),
      logContext
    );
    return { alreadyCancelled: false };
  }
);

/** Ani cancels from her schedule; the client is told and invited to rebook. */
export const cancelByStudio = Effect.fn("cancelByStudio")(
  function* cancelByStudio(id: string) {
    const appointments = yield* Appointments;
    const catalog = yield* Catalog;
    const mail = yield* BookingMail;
    const found = yield* appointments.find(id);
    if (Option.isNone(found)) {
      return yield* new AppointmentNotFound();
    }
    const appointment = found.value;
    if (appointment.state === "cancelled") {
      return { notified: false };
    }
    yield* appointments.setState(id, "cancelled");
    const policy = yield* catalog.policy;
    yield* sendQuietly(
      appointment.email,
      {
        replyTo: mail.replyTo,
        ...studioCancelledForClientMail(asMail(appointment), {
          ...mailContext(policy, mail.siteName),
          bookUrl: `${mail.siteOrigin}/book`,
        }),
      },
      { appointmentId: id }
    );
    return { notified: appointment.email !== undefined };
  }
);

/**
 * Day-before reminders for confirmed appointments starting within 24 hours.
 * Appointments booked less than a day and a half ahead skip the reminder (the
 * confirmation is still fresh) but are marked, so each is considered once.
 */
export const sendReminders = Effect.fn("sendReminders")(
  function* sendReminders() {
    const appointments = yield* Appointments;
    const catalog = yield* Catalog;
    const mail = yield* BookingMail;
    const at = yield* now;
    const due = (yield* appointments.between(
      at,
      new Date(at.getTime() + MS_PER_DAY)
    )).filter(
      (appointment) =>
        appointment.state === "confirmed" && !appointment.reminderSent
    );
    if (due.length === 0) {
      return { reminded: 0 };
    }
    const policy = yield* catalog.policy;
    const context = mailContext(policy, mail.siteName);
    let reminded = 0;
    for (const appointment of due) {
      // Marked first: if marking failed after a send, the next tick would send again.
      yield* appointments.markReminded(appointment.id);
      const bookedAhead =
        appointment.start.getTime() - appointment.createdAt.getTime();
      if (bookedAhead >= 36 * MS_PER_HOUR && appointment.email !== undefined) {
        yield* sendQuietly(
          appointment.email,
          {
            replyTo: mail.replyTo,
            ...reminderMail(asMail(appointment), context),
          },
          { appointmentId: appointment.id }
        );
        reminded += 1;
      }
    }
    return { reminded };
  }
);

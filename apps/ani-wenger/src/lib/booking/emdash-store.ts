/**
 * Appointments, time off, services, and salon rules, read and written through
 * EmDash: Ani sees and edits every appointment in the admin she already uses.
 *
 * `withEmDashRuntime` is EmDash's trusted server-side entry point (public
 * requests get no write handlers on `locals`, and the cron has no request at
 * all); it always uses the primary database, so a booking sees the latest
 * appointments. Rows come back as untyped JSON and are decoded here; a row an
 * editor left unreadable is logged and skipped rather than failing the calendar.
 */
import { Effect, Layer, Option, Schema } from "effect";
import { withEmDashRuntime } from "emdash/middleware";

import { HAIR_HISTORY_ORDER } from "../labels.ts";
import { addressLine } from "../studio.ts";
import type { Busy } from "./availability.ts";
import { parsePhotosText, photosText } from "./hair-photos.ts";
import { bookingRules } from "./rules.ts";
import {
  APPOINTMENT_STATES,
  Appointments,
  Catalog,
  StoreFailed,
} from "./services.ts";
import type { Appointment, SalonPolicy } from "./services.ts";

type Runtime = Parameters<Parameters<typeof withEmDashRuntime>[0]>[0];

/** EmDash answers `{ success, data | error }`; a failure becomes `StoreFailed`. */
interface ApiResult<A> {
  readonly success: boolean;
  readonly data?: A;
  readonly error?: { readonly code: string; readonly message: string };
}

const unwrap = <A>(result: ApiResult<A>): A => {
  if (!result.success || result.data === undefined) {
    throw new Error(
      `${result.error?.code ?? "UNKNOWN"}: ${result.error?.message ?? "no data"}`
    );
  }
  return result.data;
};

const withRuntime = <A>(name: string, run: (runtime: Runtime) => Promise<A>) =>
  Effect.tryPromise({
    catch: (cause) => new StoreFailed({ cause }),
    try: async () => await withEmDashRuntime(run),
  }).pipe(Effect.withSpan(name));

interface Item {
  readonly id: string;
  readonly slug: string | null;
  readonly status: string;
  /** Field values as EmDash stored them; decoded with a Schema before use. */
  readonly data: unknown;
  readonly liveData?: unknown;
  readonly createdAt: string;
}

const PAGE = 100;

/** Every item matching the filters, following cursors (EmDash pages at 100). */
const listAll = async (
  runtime: Runtime,
  collection: string,
  params: Omit<Parameters<Runtime["handleContentList"]>[1], "cursor" | "limit">
): Promise<Item[]> => {
  const items: Item[] = [];
  const first = { ...params, limit: PAGE };
  let query: typeof first & { cursor?: string } = first;
  for (;;) {
    // oxlint-disable-next-line no-await-in-loop -- each page needs the previous page's cursor, so they cannot run in parallel.
    const page = unwrap(await runtime.handleContentList(collection, query));
    items.push(...page.items);
    if (page.nextCursor === undefined) {
      return items;
    }
    query = { ...first, cursor: page.nextCursor };
  }
};

const OptionalText = Schema.optional(Schema.NullOr(Schema.String));
const OptionalCount = Schema.optional(Schema.NullOr(Schema.Number));

const AppointmentData = Schema.Struct({
  buffer_minutes: OptionalCount,
  duration_minutes: Schema.Number,
  email: OptionalText,
  // An unknown answer (an editor's typo) reads as no answer rather than hiding the appointment.
  hair_history: Schema.optional(Schema.NullOr(Schema.String)),
  hair_photos: OptionalText,
  manage_token_hash: OptionalText,
  notes: OptionalText,
  phone: OptionalText,
  // SQLite may hand booleans back as 0/1.
  reminder_sent: Schema.optional(
    Schema.NullOr(Schema.Union([Schema.Boolean, Schema.Number]))
  ),
  service: Schema.String,
  service_slug: OptionalText,
  starts_at: Schema.String,
  state: Schema.Literals(APPOINTMENT_STATES),
  title: Schema.String,
});

const text = (value: string | null | undefined) =>
  value === null || value === undefined || value.trim() === ""
    ? undefined
    : value;

const toAppointment = (item: Item): Option.Option<Appointment> =>
  Schema.decodeUnknownOption(AppointmentData)(item.data).pipe(
    Option.map((data): Appointment => ({
      bufferMinutes: data.buffer_minutes ?? 0,
      clientName: data.title,
      createdAt: new Date(item.createdAt),
      durationMinutes: data.duration_minutes,
      email: text(data.email),
      hairHistory: HAIR_HISTORY_ORDER.find(
        (answer) => answer === data.hair_history
      ),
      hairPhotos: parsePhotosText(data.hair_photos),
      id: item.id,
      notes: text(data.notes),
      phone: text(data.phone),
      reminderSent: data.reminder_sent === true || data.reminder_sent === 1,
      service: data.service,
      serviceSlug: text(data.service_slug),
      start: new Date(data.starts_at),
      state: data.state,
      tokenHash: text(data.manage_token_hash),
    })),
    Option.filter((appointment) => !Number.isNaN(appointment.start.getTime()))
  );

const decodeAll = (items: readonly Item[]) =>
  Effect.gen(function* decodeAppointments() {
    const appointments: Appointment[] = [];
    for (const item of items) {
      const decoded = toAppointment(item);
      if (Option.isSome(decoded)) {
        appointments.push(decoded.value);
      } else {
        yield* Effect.logWarning("appointment skipped: unreadable fields").pipe(
          Effect.annotateLogs({ appointmentId: item.id })
        );
      }
    }
    return appointments;
  });

const TimeOffData = Schema.Struct({
  ends_at: Schema.String,
  starts_at: Schema.String,
});

/** A time-off entry as busy time; an unreadable one blocks nothing. */
const toBusy = (item: Item): Busy[] =>
  Option.match(Schema.decodeUnknownOption(TimeOffData)(item.data), {
    onNone: () => [],
    onSome: (away) => [
      { end: new Date(away.ends_at), start: new Date(away.starts_at) },
    ],
  });

/** The appointment book; `origin` makes the stored photo links complete URLs. */
export const appointmentsEmDash = (origin: string) =>
  Layer.succeed(Appointments, {
    between: (from, to) =>
      withRuntime(
        "Appointments.between",
        async (runtime) =>
          await listAll(runtime, "appointments", {
            fieldFilters: {
              starts_at: { gte: from.toISOString(), lt: to.toISOString() },
            },
            order: "asc",
            orderBy: "starts_at",
          })
      ).pipe(Effect.flatMap(decodeAll)),

    create: (appointment) =>
      withRuntime("Appointments.create", async (runtime) => {
        const result = unwrap(
          await runtime.handleContentCreate("appointments", {
            data: {
              buffer_minutes: appointment.bufferMinutes,
              duration_minutes: appointment.durationMinutes,
              email: appointment.email,
              hair_history: appointment.hairHistory ?? null,
              hair_photos:
                appointment.hairPhotos.length === 0
                  ? null
                  : photosText(appointment.hairPhotos, origin),
              manage_token_hash: appointment.tokenHash,
              notes: appointment.notes ?? null,
              phone: appointment.phone,
              reminder_sent: false,
              service: appointment.service,
              service_slug: appointment.serviceSlug,
              source: "website",
              starts_at: appointment.start.toISOString(),
              state: "confirmed",
              title: appointment.clientName,
            },
            // Not public content: drafts never reach a page, sitemap, or export.
            status: "draft",
          })
        );
        return { id: result.item.id };
      }),

    find: (id) =>
      withRuntime("Appointments.find", async (runtime) => {
        const result = await runtime.handleContentGet("appointments", id);
        return result.success && result.data !== undefined
          ? Option.some(result.data.item)
          : Option.none<Item>();
      }).pipe(Effect.map(Option.flatMap(toAppointment))),

    markReminded: (id) =>
      withRuntime("Appointments.markReminded", async (runtime) => {
        unwrap(
          await runtime.handleContentUpdate("appointments", id, {
            data: { reminder_sent: true },
          })
        );
      }),

    setState: (id, state) =>
      withRuntime("Appointments.setState", async (runtime) => {
        unwrap(
          await runtime.handleContentUpdate("appointments", id, {
            data: { state },
          })
        );
      }),

    timeOff: (from, to) =>
      withRuntime(
        "Appointments.timeOff",
        async (runtime) =>
          await listAll(runtime, "time_off", {
            fieldFilters: {
              ends_at: { gt: from.toISOString() },
              starts_at: { lt: to.toISOString() },
            },
          })
      ).pipe(Effect.map((items) => items.flatMap(toBusy))),
  });

const ServiceData = Schema.Struct({
  add_on: Schema.optional(
    Schema.NullOr(Schema.Union([Schema.Boolean, Schema.Number]))
  ),
  ask_photos: Schema.optional(
    Schema.NullOr(Schema.Union([Schema.Boolean, Schema.Number]))
  ),
  bookable: Schema.optional(
    Schema.NullOr(Schema.Union([Schema.Boolean, Schema.Number]))
  ),
  buffer_minutes: OptionalCount,
  duration_minutes: Schema.Number,
  price: OptionalCount,
  price_from: Schema.optional(
    Schema.NullOr(Schema.Union([Schema.Boolean, Schema.Number]))
  ),
  title: Schema.String,
});

const StudioData = Schema.Struct({
  booking_note: Schema.String,
  cancel_cutoff_hours: Schema.Number,
  city: Schema.String,
  horizon_days: Schema.Number,
  hours: Schema.Array(
    Schema.Struct({
      closes: Schema.String,
      day: Schema.String,
      opens: Schema.String,
    })
  ),
  min_notice_hours: Schema.Number,
  phone: Schema.String,
  postal_code: OptionalText,
  region: OptionalText,
  salon_name: Schema.String,
  step_minutes: Schema.Number,
  street: OptionalText,
});

/** Published values: when an editor has an unpublished draft, `liveData` holds what is live. */
const published = (item: Item) =>
  item.status === "published"
    ? Option.some(item.liveData ?? item.data)
    : Option.none();

/** A boolean field as stored: SQLite may hand it back as 0/1, or it may be unset. */
const StoredFlag = Schema.optional(
  Schema.NullOr(Schema.Union([Schema.Boolean, Schema.Number]))
);

/** Reads a stored flag; an unset field takes the default. */
const flag = (value: typeof StoredFlag.Type, fallback: boolean) =>
  value === null || value === undefined
    ? fallback
    : value === true || value === 1;

export const catalogEmDash = (timeZone: string) =>
  Layer.succeed(Catalog, {
    policy: withRuntime("Catalog.policy", async (runtime) => {
      const [item] = await listAll(runtime, "studio", { status: "published" });
      if (item === undefined) {
        throw new Error("The Salon and hours entry is missing or unpublished");
      }
      return Option.getOrThrow(published(item));
    }).pipe(
      Effect.flatMap((data) =>
        Schema.decodeUnknownEffect(StudioData)(data).pipe(
          Effect.mapError((cause) => new StoreFailed({ cause }))
        )
      ),
      Effect.map((studio): SalonPolicy => ({
        bookingNote: studio.booking_note,
        cancelCutoffHours: studio.cancel_cutoff_hours,
        location: addressLine({
          city: studio.city,
          postal_code: text(studio.postal_code),
          region: text(studio.region),
          salon_name: studio.salon_name,
          street: text(studio.street),
        }),
        phone: studio.phone,
        rules: bookingRules(studio, timeZone),
      }))
    ),

    service: (slug) =>
      withRuntime("Catalog.service", async (runtime) => {
        const result = await runtime.handleContentGet("services", slug);
        return result.success && result.data !== undefined
          ? published(result.data.item)
          : Option.none();
      }).pipe(
        Effect.map((data) =>
          data.pipe(
            Option.flatMap(Schema.decodeUnknownOption(ServiceData)),
            Option.filter((service) => flag(service.bookable, true)),
            Option.map((service) => ({
              addOn: flag(service.add_on, false),
              asksForPhotos: flag(service.ask_photos, false),
              bufferMinutes: service.buffer_minutes ?? 0,
              durationMinutes: service.duration_minutes,
              price: service.price ?? undefined,
              priceFrom: flag(service.price_from, false),
              slug,
              title: service.title,
            }))
          )
        )
      ),
  });

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
import { BlockTypeRegistry, OptionsRepository } from "emdash";
import { withEmDashRuntime } from "emdash/middleware";

import { CLIENT_FOR, HAIR_HISTORY_ORDER } from "../labels.ts";
import { ensureLaterSections } from "../later-sections.ts";
import { addressLine } from "../studio.ts";
import {
  CLIENT_FOR_FIELD,
  ensureAppointmentFields,
} from "./appointment-fields.ts";
import type { Busy } from "./availability.ts";
import { parsePhotosText, photosText } from "./hair-photos.ts";
import { bookingRules } from "./rules.ts";
import {
  APPOINTMENT_STATES,
  Appointments,
  CalendarUnreadable,
  Catalog,
  OutsideCalendar,
  StoreFailed,
} from "./services.ts";
import type {
  Appointment,
  OutsideCalendarRead,
  SalonPolicy,
} from "./services.ts";

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
  client_for: OptionalText,
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
      clientFor: CLIENT_FOR.find((answer) => answer === data.client_for),
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

/**
 * The Appointments fields, after adding any that came after launch (usually
 * the minute tick already has). If that fails, the booking still goes
 * through, just without the newer answers.
 */
const appointmentFields = withRuntime(
  "Appointments.fields",
  async (runtime) => {
    const fields = await ensureAppointmentFields(runtime.schemaRegistry);
    return fields.present;
  }
).pipe(
  Effect.catchCause((cause) =>
    Effect.logWarning("appointment fields: could not add").pipe(
      Effect.annotateLogs({ cause: String(cause) }),
      Effect.as(new Set<string>())
    )
  )
);

/**
 * Adds the Appointments fields that came after launch to a live site; the
 * worker runs it on the minute tick, so a deploy has them within a minute.
 */
export const addLaterAppointmentFields = withRuntime(
  "Appointments.addLaterFields",
  async (runtime) => {
    const fields = await ensureAppointmentFields(runtime.schemaRegistry);
    return fields.added;
  }
).pipe(
  Effect.tap((added) =>
    added.length === 0
      ? Effect.void
      : Effect.logInfo("appointment fields added").pipe(
          Effect.annotateLogs({ fields: added.join(", ") })
        )
  )
);

/**
 * Adds the section types that came after launch (Videos) to a live site's
 * page editor; the worker runs it on the minute tick next to the fields above.
 */
export const addLaterSections = withRuntime(
  "Pages.addLaterSections",
  async (runtime) => {
    const blockTypes = new BlockTypeRegistry(runtime.db);
    const schema = runtime.schemaRegistry;
    const result = await ensureLaterSections({
      applySeedBlockType: async (input, onConflict) =>
        await blockTypes.applySeedBlockType(input, onConflict),
      getCollectionWithFields: async (slug) =>
        await schema.getCollectionWithFields(slug),
      updateField: async (collection, field, input) => {
        await schema.updateField(collection, field, input);
      },
    });
    return result.allowed;
  }
).pipe(
  Effect.tap((allowed) =>
    allowed.length === 0
      ? Effect.void
      : Effect.logInfo("later sections allowed").pipe(
          Effect.annotateLogs({ collections: allowed.join(", ") })
        )
  )
);

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
      Effect.gen(function* createAppointment() {
        const fields =
          appointment.clientFor === undefined
            ? new Set<string>()
            : yield* appointmentFields;
        return yield* withRuntime("Appointments.create", async (runtime) => {
          const clientFor =
            appointment.clientFor !== undefined &&
            fields.has(CLIENT_FOR_FIELD.slug)
              ? { client_for: appointment.clientFor }
              : {};
          const result = unwrap(
            await runtime.handleContentCreate("appointments", {
              data: {
                ...clientFor,
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
        });
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

/**
 * Ani's work calendar link and its last read, kept in EmDash's options table
 * under the Schedule plugin's names (no content type, so nothing to migrate
 * and nothing public). The read holds start and end times only.
 */
const LINK_OPTION = "plugin:schedule:outside-calendar:link";
const READ_OPTION = "plugin:schedule:outside-calendar:read";

const StoredRead = Schema.Struct({
  address: Schema.String,
  busy: Schema.Array(Schema.Tuple([Schema.String, Schema.String])),
  checkedAt: Schema.String,
  failed: Schema.Boolean,
  readAt: Schema.NullOr(Schema.String),
});

const fromStoredRead = (
  stored: typeof StoredRead.Type
): OutsideCalendarRead => ({
  address: stored.address,
  busy: stored.busy.map(([start, end]) => ({
    end: new Date(end),
    start: new Date(start),
  })),
  checkedAt: new Date(stored.checkedAt),
  failed: stored.failed,
  readAt: stored.readAt === null ? undefined : new Date(stored.readAt),
});

const toStoredRead = (read: OutsideCalendarRead): typeof StoredRead.Type => ({
  address: read.address,
  busy: read.busy.map((block) => [
    block.start.toISOString(),
    block.end.toISOString(),
  ]),
  checkedAt: read.checkedAt.toISOString(),
  failed: read.failed,
  readAt: read.readAt === undefined ? null : read.readAt.toISOString(),
});

/** iCloud answers in well under a second; past this it is down, and the next tick tries again. */
const DOWNLOAD_TIMEOUT_MS = 15_000;
/** A year of a busy stylist's calendar is a few hundred kilobytes. */
const MAX_CALENDAR_BYTES = 5_000_000;

const downloadCalendar = (address: string) =>
  Effect.tryPromise({
    catch: (cause) =>
      new CalendarUnreadable({
        reason: cause instanceof Error ? cause.message : String(cause),
      }),
    try: async () => {
      const response = await fetch(address, {
        headers: { accept: "text/calendar" },
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const length = Number(response.headers.get("content-length") ?? 0);
      if (length > MAX_CALENDAR_BYTES) {
        throw new Error("Calendar file too large");
      }
      const file = await response.text();
      if (file.length > MAX_CALENDAR_BYTES) {
        throw new Error("Calendar file too large");
      }
      return file;
    },
  }).pipe(Effect.withSpan("OutsideCalendar.download"));

export const outsideCalendarEmDash = Layer.succeed(OutsideCalendar, {
  download: downloadCalendar,

  lastRead: withRuntime("OutsideCalendar.lastRead", async (runtime) =>
    Option.fromNullishOr(
      await new OptionsRepository(runtime.db).get(READ_OPTION)
    )
  ).pipe(
    Effect.map((stored) =>
      stored.pipe(
        Option.flatMap(Schema.decodeUnknownOption(StoredRead)),
        Option.map(fromStoredRead)
      )
    )
  ),

  link: withRuntime("OutsideCalendar.link", async (runtime) => {
    const link = await new OptionsRepository(runtime.db).get(LINK_OPTION);
    return Schema.decodeUnknownOption(Schema.NonEmptyString)(link);
  }),

  saveRead: (read) =>
    withRuntime("OutsideCalendar.saveRead", async (runtime) => {
      await new OptionsRepository(runtime.db).set(
        READ_OPTION,
        toStoredRead(read)
      );
    }),

  setLink: (address) =>
    withRuntime("OutsideCalendar.setLink", async (runtime) => {
      const options = new OptionsRepository(runtime.db);
      await Option.match(address, {
        onNone: async () => {
          await options.deleteMany([LINK_OPTION, READ_OPTION]);
        },
        onSome: async (link) => {
          await options.set(LINK_OPTION, link);
        },
      });
    }),
});

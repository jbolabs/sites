import {
  ContactForm,
  runRequest,
  submitContact,
} from "@jakebodea/cloudflare-kit/server";
import { ActionError, defineAction } from "astro:actions";
import { Cause, Effect, Exit, Option, Schema } from "effect";

import {
  AvailabilityRequest,
  BookingForm,
  CancelRequest,
  RescheduleRequest,
  RescheduleTimesRequest,
  bookAppointment,
  cancelByClient,
  openTimes,
  rescheduleByClient,
  rescheduleTimes,
} from "@/lib/booking/booking";
import { bookingLayer, contactLayer, waitUntil } from "@/lib/server";

const header = (request: Request, name: string) =>
  request.headers.get(name) ?? undefined;

/** The first typed failure's tag, or `Defect` for anything unexpected. */
const failureTag = <E extends { readonly _tag: string }>(
  cause: Cause.Cause<E>
): string => {
  const error = Cause.findErrorOption(cause);
  return Option.isSome(error) ? error.value._tag : "Defect";
};

const ADD_ON_MESSAGE =
  "Add-ons book together with a cut, color, or other service. Please choose one too.";

const TOO_LATE_TO_MOVE_MESSAGE =
  "It is too close to your appointment to change it online. Please call.";

const BUSY_MESSAGE =
  "Booking is busy for a moment. Please try again in a few seconds.";

export const server = {
  /** Open times for the booking calendar. */
  availability: defineAction({
    accept: "json",
    // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Astro hands over the raw JSON body; it is decoded with Effect Schema on the next line.
    handler: async (input: unknown) => {
      const program = Schema.decodeUnknownEffect(AvailabilityRequest)(
        input
      ).pipe(
        Effect.flatMap(openTimes),
        Effect.map(({ days }) => ({ days })),
        Effect.withSpan("action.availability")
      );
      const exit = await runRequest(program, bookingLayer(), waitUntil);
      if (Exit.isSuccess(exit)) {
        return exit.value;
      }
      const tag = failureTag(exit.cause);
      if (tag === "SchemaError") {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "That date range is not valid.",
        });
      }
      if (tag === "ServiceUnavailable") {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "That service cannot be booked online. Please call.",
        });
      }
      if (tag === "InvalidVisit") {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: ADD_ON_MESSAGE,
        });
      }
      await Effect.runPromise(Effect.logError("availability failed", { tag }));
      throw new ActionError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Open times could not load. Please try again, or call to book.",
      });
    },
  }),

  /** Books an appointment. Validation lives in `BookingForm` (Effect Schema), not here. */
  book: defineAction({
    accept: "json",
    // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Astro hands over the raw JSON body; it is decoded with Effect Schema on the next line.
    handler: async (input: unknown, context) => {
      const { request } = context;
      const program = Schema.decodeUnknownEffect(BookingForm)(input).pipe(
        Effect.flatMap((form) =>
          bookAppointment(form, {
            remoteIp: header(request, "cf-connecting-ip"),
            requestId: header(request, "cf-ray") ?? crypto.randomUUID(),
          })
        ),
        Effect.withSpan("action.book")
      );
      const exit = await runRequest(program, bookingLayer(), waitUntil);
      if (Exit.isSuccess(exit)) {
        return exit.value;
      }
      const tag = failureTag(exit.cause);
      switch (tag) {
        case "SchemaError": {
          throw new ActionError({
            code: "BAD_REQUEST",
            message: "Please check the highlighted fields.",
          });
        }
        case "TurnstileRejected": {
          throw new ActionError({
            code: "FORBIDDEN",
            message: "Please complete the verification and try again.",
          });
        }
        case "SlotUnavailable": {
          throw new ActionError({
            code: "CONFLICT",
            message: "That time was just taken. Please choose another.",
          });
        }
        case "ServiceUnavailable": {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "That service cannot be booked online. Please call.",
          });
        }
        case "InvalidVisit": {
          throw new ActionError({
            code: "BAD_REQUEST",
            message: ADD_ON_MESSAGE,
          });
        }
        case "PhotoRejected": {
          throw new ActionError({
            code: "BAD_REQUEST",
            message:
              "One of the photos could not be read. Please remove it and add it again.",
          });
        }
        case "CalendarBusy": {
          throw new ActionError({
            code: "TOO_MANY_REQUESTS",
            message: BUSY_MESSAGE,
          });
        }
        default: {
          await Effect.runPromise(Effect.logError("booking failed", { tag }));
          throw new ActionError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "We could not book that time. Please try again in a few minutes, or call.",
          });
        }
      }
    },
  }),

  /** A client cancels from the link in their confirmation email. */
  cancelAppointment: defineAction({
    accept: "json",
    // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Astro hands over the raw JSON body; it is decoded with Effect Schema on the next line.
    handler: async (input: unknown) => {
      const program = Schema.decodeUnknownEffect(CancelRequest)(input).pipe(
        Effect.flatMap(cancelByClient),
        Effect.withSpan("action.cancelAppointment")
      );
      const exit = await runRequest(program, bookingLayer(), waitUntil);
      if (Exit.isSuccess(exit)) {
        return exit.value;
      }
      const tag = failureTag(exit.cause);
      if (tag === "SchemaError" || tag === "AppointmentNotFound") {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "We could not find that appointment. Please call to cancel.",
        });
      }
      if (tag === "TooLateToCancel") {
        throw new ActionError({
          code: "FORBIDDEN",
          message:
            "It is too close to your appointment to cancel online. Please call.",
        });
      }
      await Effect.runPromise(Effect.logError("cancel failed", { tag }));
      throw new ActionError({
        code: "INTERNAL_SERVER_ERROR",
        message: "We could not cancel just now. Please try again, or call.",
      });
    },
  }),

  /** The contact form. Validation lives in `ContactForm` (Effect Schema), not here. */
  contact: defineAction({
    accept: "json",
    // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Astro hands over the raw JSON body; it is decoded with Effect Schema on the next line.
    handler: async (input: unknown, context) => {
      const { request } = context;
      const program = Schema.decodeUnknownEffect(ContactForm)(input).pipe(
        Effect.flatMap((form) =>
          submitContact(form, {
            remoteIp: header(request, "cf-connecting-ip"),
            requestId: header(request, "cf-ray") ?? crypto.randomUUID(),
            sourcePath: new URL(request.headers.get("referer") ?? context.url)
              .pathname,
          })
        ),
        Effect.withSpan("action.contact")
      );
      const exit = await runRequest(program, contactLayer(), waitUntil);
      if (Exit.isSuccess(exit)) {
        return { ok: true as const };
      }
      const tag = failureTag(exit.cause);
      if (tag === "SchemaError") {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Please check the highlighted fields.",
        });
      }
      if (tag === "TurnstileRejected") {
        throw new ActionError({
          code: "FORBIDDEN",
          message: "Please complete the verification and try again.",
        });
      }
      throw new ActionError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "We could not send your message. Please try again in a few minutes.",
      });
    },
  }),

  /** A client moves their appointment from the link in their confirmation email. */
  rescheduleAppointment: defineAction({
    accept: "json",
    // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Astro hands over the raw JSON body; it is decoded with Effect Schema on the next line.
    handler: async (input: unknown) => {
      const program = Schema.decodeUnknownEffect(RescheduleRequest)(input).pipe(
        Effect.flatMap(rescheduleByClient),
        Effect.withSpan("action.rescheduleAppointment")
      );
      const exit = await runRequest(program, bookingLayer(), waitUntil);
      if (Exit.isSuccess(exit)) {
        return exit.value;
      }
      const tag = failureTag(exit.cause);
      switch (tag) {
        case "SchemaError":
        case "AppointmentNotFound": {
          throw new ActionError({
            code: "NOT_FOUND",
            message:
              "We could not find that appointment. Please call to change it.",
          });
        }
        case "TooLateToReschedule": {
          throw new ActionError({
            code: "FORBIDDEN",
            message: TOO_LATE_TO_MOVE_MESSAGE,
          });
        }
        case "SlotUnavailable": {
          throw new ActionError({
            code: "CONFLICT",
            message:
              "That time was just taken. Your appointment has not changed. Please choose another.",
          });
        }
        case "CalendarBusy": {
          throw new ActionError({
            code: "TOO_MANY_REQUESTS",
            message: BUSY_MESSAGE,
          });
        }
        default: {
          await Effect.runPromise(
            Effect.logError("reschedule failed", { tag })
          );
          throw new ActionError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "We could not move your appointment just now. It has not changed. Please try again, or call.",
          });
        }
      }
    },
  }),

  /** Open times for moving an appointment, from the manage link. */
  rescheduleTimes: defineAction({
    accept: "json",
    // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Astro hands over the raw JSON body; it is decoded with Effect Schema on the next line.
    handler: async (input: unknown) => {
      const program = Schema.decodeUnknownEffect(RescheduleTimesRequest)(
        input
      ).pipe(
        Effect.flatMap(rescheduleTimes),
        Effect.withSpan("action.rescheduleTimes")
      );
      const exit = await runRequest(program, bookingLayer(), waitUntil);
      if (Exit.isSuccess(exit)) {
        return exit.value;
      }
      const tag = failureTag(exit.cause);
      if (tag === "SchemaError" || tag === "AppointmentNotFound") {
        throw new ActionError({
          code: "NOT_FOUND",
          message:
            "We could not find that appointment. Please call to change it.",
        });
      }
      if (tag === "TooLateToReschedule") {
        throw new ActionError({
          code: "FORBIDDEN",
          message: TOO_LATE_TO_MOVE_MESSAGE,
        });
      }
      await Effect.runPromise(
        Effect.logError("reschedule times failed", { tag })
      );
      throw new ActionError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Open times could not load. Please try again, or call to change it.",
      });
    },
  }),
};

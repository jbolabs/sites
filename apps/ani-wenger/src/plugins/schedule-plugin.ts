/**
 * The `schedule` EmDash plugin: a Schedule page and a dashboard card for Ani,
 * served as Block Kit from the plugin's `admin` route. Appointments are read
 * through the same Effect services as the public booking flow, so a cancel
 * here frees the time and emails the client the same way. The page also
 * connects Ani's work calendar, whose events block online booking.
 */
import type { BlockResponse } from "@emdash-cms/blocks";
import { env } from "cloudflare:workers";
import { Effect, Option, Schema } from "effect";
import type { RouteContext } from "emdash";
import { definePlugin } from "emdash";

import { site } from "../../site.config.ts";
import { cancelByStudio } from "../lib/booking/booking.ts";
import {
  connectOutsideCalendar,
  disconnectOutsideCalendar,
  refreshOutsideCalendar,
} from "../lib/booking/outside-sync.ts";
import { runSchedule } from "../lib/booking/run.ts";
import { Appointments, OutsideCalendar } from "../lib/booking/services.ts";
import {
  CALENDAR_LINK_FIELD,
  CANCEL_ACTION,
  CHECK_CALENDAR_ACTION,
  CONNECT_CALENDAR_ACTION,
  DISCONNECT_CALENDAR_ACTION,
  schedulePage,
  todayWidget,
} from "./schedule-ui.ts";
import type { OutsideCalendarView } from "./schedule-ui.ts";
import { SCHEDULE_PLUGIN_ID } from "./schedule.ts";

const VERSION = "1.0.0";
const AHEAD_DAYS = 90;
const HOUR_MS = 3_600_000;

/** A Cancel button press: its value is the appointment id. */
const CancelPress = Schema.Struct({
  action_id: Schema.Literal(CANCEL_ACTION),
  page: Schema.optional(Schema.String),
  type: Schema.Literal("block_action"),
  value: Schema.String,
});
/** Connect pressed under the calendar link field. */
const ConnectCalendar = Schema.Struct({
  action_id: Schema.Literal(CONNECT_CALENDAR_ACTION),
  page: Schema.optional(Schema.String),
  type: Schema.Literal("form_submit"),
  values: Schema.Struct({
    [CALENDAR_LINK_FIELD]: Schema.optional(Schema.NullOr(Schema.String)),
  }),
});
/** Check now or Disconnect on the work calendar. */
const CalendarPress = Schema.Struct({
  action_id: Schema.Literals([
    CHECK_CALENDAR_ACTION,
    DISCONNECT_CALENDAR_ACTION,
  ]),
  page: Schema.optional(Schema.String),
  type: Schema.Literal("block_action"),
});
/** Anything else only needs to know which screen to draw. */
const ScreenEvent = Schema.Struct({ page: Schema.optional(Schema.String) });

type Toast = NonNullable<BlockResponse["toast"]>;

const upcoming = (now: Date) =>
  Effect.gen(function* loadUpcoming() {
    const appointments = yield* Appointments;
    const list = yield* appointments.between(
      // Appointments in progress still show until they end.
      new Date(now.getTime() - 4 * HOUR_MS),
      new Date(now.getTime() + AHEAD_DAYS * 24 * HOUR_MS)
    );
    return list.filter((appointment) => appointment.state === "confirmed");
  });

const outsideView = Effect.gen(function* loadOutsideView() {
  const calendar = yield* OutsideCalendar;
  const [link, read] = yield* Effect.all([calendar.link, calendar.lastRead]);
  return {
    connected: Option.isSome(link),
    read: read.pipe(
      Option.filter(
        (last) => Option.isSome(link) && last.address === link.value
      ),
      Option.getOrUndefined
    ),
  } satisfies OutsideCalendarView;
});

const render = async (
  page: string | undefined,
  origin: string,
  toast?: Toast
): Promise<BlockResponse> => {
  const now = new Date();
  const outcome = await runSchedule(
    Effect.all({ outside: outsideView, upcoming: upcoming(now) })
  );
  if (!outcome.ok) {
    return {
      blocks: [
        {
          text: "The schedule could not load. Refresh to try again.",
          type: "context",
        },
      ],
    };
  }
  const view =
    page === "widget:today"
      ? todayWidget({
          now,
          timeZone: site.timeZone,
          upcoming: outcome.value.upcoming,
        })
      : schedulePage({
          feedUrl: `${origin}/calendar/${env.CALENDAR_FEED_KEY}.ics`,
          now,
          outside: outcome.value.outside,
          timeZone: site.timeZone,
          upcoming: outcome.value.upcoming,
        });
  return toast === undefined ? view : { ...view, toast };
};

const cancelled = (notified: boolean): Toast => ({
  message: notified ? "Cancelled. The client has been emailed." : "Cancelled.",
  type: "success",
});

/** What to tell Ani when a pasted link does not connect. */
const connectFailed = (tag: string): string => {
  if (tag === "CalendarUnreadable") {
    return "That link didn't open a calendar. Copy it again from Share Link and paste it here.";
  }
  if (tag === "InvalidCalendarLink") {
    return "That isn't a calendar link. Copy it from Share Link and paste it here.";
  }
  return "The calendar could not be connected. Try again.";
};

/** Anything pressed in the work calendar section. */
const CalendarEvent = Schema.Union([ConnectCalendar, CalendarPress]);
type CalendarEvent = typeof CalendarEvent.Type;

/** Connect, Check now, or Disconnect on the work calendar. */
const calendarToast = async (event: CalendarEvent): Promise<Toast> => {
  if (event.type === "form_submit") {
    const outcome = await runSchedule(
      connectOutsideCalendar(
        event.values[CALENDAR_LINK_FIELD] ?? "",
        site.timeZone
      )
    );
    return outcome.ok
      ? {
          message: "Connected. Your work calendar now blocks those times.",
          type: "success",
        }
      : { message: connectFailed(outcome.tag), type: "error" };
  }
  if (event.action_id === DISCONNECT_CALENDAR_ACTION) {
    const outcome = await runSchedule(disconnectOutsideCalendar());
    return outcome.ok
      ? { message: "Disconnected.", type: "success" }
      : { message: "Could not disconnect. Try again.", type: "error" };
  }
  const outcome = await runSchedule(refreshOutsideCalendar(site.timeZone));
  return outcome.ok &&
    Option.isSome(outcome.value) &&
    !outcome.value.value.failed
    ? { message: "Checked.", type: "success" }
    : { message: "Your work calendar could not be read.", type: "error" };
};

const admin = async (ctx: RouteContext): Promise<BlockResponse> => {
  const { origin } = new URL(ctx.request.url);
  const calendar = Schema.decodeUnknownOption(CalendarEvent)(ctx.input);
  if (Option.isSome(calendar)) {
    return await render(
      calendar.value.page,
      origin,
      await calendarToast(calendar.value)
    );
  }
  const press = Schema.decodeUnknownOption(CancelPress)(ctx.input);
  if (Option.isSome(press)) {
    const outcome = await runSchedule(cancelByStudio(press.value.value));
    return await render(
      press.value.page,
      origin,
      outcome.ok
        ? cancelled(outcome.value.notified)
        : {
            message: "That appointment could not be cancelled. Try again.",
            type: "error",
          }
    );
  }
  const screen = Schema.decodeUnknownOption(ScreenEvent)(ctx.input);
  return await render(
    Option.getOrUndefined(
      screen.pipe(Option.flatMapNullishOr((event) => event.page))
    ),
    origin
  );
};

export const createPlugin = () =>
  definePlugin({
    admin: {
      pages: [{ icon: "calendar", label: "Schedule", path: "/schedule" }],
      widgets: [{ id: "today", size: "half", title: "Coming up" }],
    },
    id: SCHEDULE_PLUGIN_ID,
    // Client names and phone numbers: editors (Ani) and admins only.
    routes: { admin: { handler: admin, permission: "content:edit_any" } },
    version: VERSION,
  });

export default createPlugin;

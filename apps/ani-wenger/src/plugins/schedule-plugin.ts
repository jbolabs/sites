/**
 * The `schedule` EmDash plugin: a Schedule page and a dashboard card for Ani,
 * served as Block Kit from the plugin's `admin` route. Appointments are read
 * through the same Effect services as the public booking flow, so a cancel
 * here frees the time and emails the client the same way.
 */
import type { BlockResponse } from "@emdash-cms/blocks";
import { env } from "cloudflare:workers";
import { Effect, Option, Schema } from "effect";
import type { RouteContext } from "emdash";
import { definePlugin } from "emdash";

import { site } from "../../site.config.ts";
import { cancelByStudio } from "../lib/booking/booking.ts";
import { runSchedule } from "../lib/booking/run.ts";
import { Appointments } from "../lib/booking/services.ts";
import { CANCEL_ACTION, schedulePage, todayWidget } from "./schedule-ui.ts";
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

const render = async (
  page: string | undefined,
  origin: string,
  toast?: Toast
): Promise<BlockResponse> => {
  const now = new Date();
  const outcome = await runSchedule(upcoming(now));
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
      ? todayWidget({ now, timeZone: site.timeZone, upcoming: outcome.value })
      : schedulePage({
          feedUrl: `${origin}/calendar/${env.CALENDAR_FEED_KEY}.ics`,
          now,
          timeZone: site.timeZone,
          upcoming: outcome.value,
        });
  return toast === undefined ? view : { ...view, toast };
};

const cancelled = (notified: boolean): Toast => ({
  message: notified ? "Cancelled. The client has been emailed." : "Cancelled.",
  type: "success",
});

const admin = async (ctx: RouteContext): Promise<BlockResponse> => {
  const { origin } = new URL(ctx.request.url);
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

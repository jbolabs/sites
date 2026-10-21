import type { APIRoute } from "astro";
/**
 * Ani's appointments as a calendar feed she subscribes to on her phone
 * (Apple Calendar, Google Calendar). Calendar apps cannot sign in, so the
 * random key in the URL is the credential; the Schedule page in the admin
 * shows the address. Covers the last 30 days and everything ahead.
 */
import { env } from "cloudflare:workers";
import { Effect } from "effect";

import { calendarEvent } from "@/lib/booking/booking";
import { calendarFile } from "@/lib/booking/ics";
import { runSchedule } from "@/lib/booking/run";
import { Appointments, Catalog } from "@/lib/booking/services";
import { sameSecret } from "@/lib/booking/token";

const DAY_MS = 86_400_000;

const calendarFeed: APIRoute = async ({ params }) => {
  if (!sameSecret(params.key ?? "", env.CALENDAR_FEED_KEY)) {
    return new Response("Not found", { status: 404 });
  }
  const now = Date.now();
  const outcome = await runSchedule(
    Effect.gen(function* feed() {
      const appointments = yield* Appointments;
      const policy = yield* (yield* Catalog).policy;
      const list = yield* appointments.between(
        new Date(now - 30 * DAY_MS),
        new Date(now + 400 * DAY_MS)
      );
      return list.flatMap((appointment) =>
        appointment.state === "cancelled"
          ? []
          : [
              calendarEvent(appointment, policy, {
                description: [
                  appointment.service,
                  appointment.phone === undefined
                    ? undefined
                    : `Phone: ${appointment.phone}`,
                  appointment.email === undefined
                    ? undefined
                    : `Email: ${appointment.email}`,
                  appointment.notes === undefined
                    ? undefined
                    : `Notes: ${appointment.notes}`,
                ]
                  .filter((line) => line !== undefined)
                  .join("\n"),
                summary: `${appointment.clientName}: ${appointment.service}`,
                updated: appointment.createdAt,
              }),
            ]
      );
    })
  );
  if (!outcome.ok) {
    return new Response("Calendar unavailable", { status: 503 });
  }
  return new Response(calendarFile(outcome.value, "Ani Wenger appointments"), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "text/calendar; charset=utf-8",
    },
  });
};

export const GET = calendarFeed;

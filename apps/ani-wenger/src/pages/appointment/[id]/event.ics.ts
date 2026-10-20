/** The client's appointment as an .ics file ("Add to calendar"), behind the same token as the manage page. */
import type { APIRoute } from "astro";
import { Effect } from "effect";

import { appointmentForLink, calendarEvent } from "@/lib/booking/booking";
import { calendarFile } from "@/lib/booking/ics";
import { runSchedule } from "@/lib/booking/run";
import { Catalog } from "@/lib/booking/services";

import { site } from "../../../../site.config";

const appointmentCalendarFile: APIRoute = async ({ params, url }) => {
  const token = url.searchParams.get("t") ?? "";
  const outcome =
    token.length < 16
      ? { ok: false as const, tag: "AppointmentNotFound" }
      : await runSchedule(
          Effect.gen(function* load() {
            const appointment = yield* appointmentForLink({
              id: params.id ?? "",
              token,
            });
            const policy = yield* (yield* Catalog).policy;
            return calendarEvent(appointment, policy, {
              description: `${appointment.service} with ${site.name}. Questions: ${policy.phone}`,
              summary: `${appointment.service} with ${site.name}`,
              updated: new Date(),
            });
          })
        );
  if (!outcome.ok) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(calendarFile([outcome.value], site.name), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="appointment.ics"',
      "Content-Type": "text/calendar; charset=utf-8",
    },
  });
};

export const GET = appointmentCalendarFile;

/** Every church event as a calendar feed; members subscribe once (`webcal:`) and it stays current. */
import type { APIRoute } from "astro";

import { getEvents } from "@/lib/content";
import { calendarResponse } from "@/lib/event-calendar";

import { site } from "../../../site.config";

const churchCalendar: APIRoute = async ({ cache, site: origin, url }) => {
  const events = await getEvents();
  if (cache?.enabled) {
    cache.set(events.cacheHint);
  }
  return calendarResponse(events.entries, {
    filename: "grace-church.ics",
    name: site.name,
    origin: (origin ?? url).origin,
  });
};

export const GET = churchCalendar;

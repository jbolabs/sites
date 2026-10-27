/** One event as a calendar file ("Add to my calendar"), repeating when the event repeats. */
import type { APIRoute } from "astro";
import { decodeSlug } from "emdash";

import { getEvent } from "@/lib/content";
import { calendarResponse } from "@/lib/event-calendar";

import { site } from "../../../../site.config";

const eventCalendar: APIRoute = async ({
  cache,
  params,
  site: origin,
  url,
}) => {
  const slug = decodeSlug(params.slug);
  if (slug === undefined || slug === "") {
    return new Response("Not found", { status: 404 });
  }
  const { cacheHint, entry } = await getEvent(slug);
  if (entry === null || entry === undefined) {
    return new Response("Not found", { status: 404 });
  }
  if (cache?.enabled) {
    cache.set(cacheHint);
  }
  return calendarResponse([entry], {
    filename: `${slug}.ics`,
    name: `${entry.data.title}, ${site.name}`,
    origin: (origin ?? url).origin,
  });
};

export const GET = eventCalendar;

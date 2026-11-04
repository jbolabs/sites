/** Church events as iCalendar responses: the whole calendar feed and one event's file. */
import type { Entry, Event } from "./content.ts";
import { churchToday, scheduled } from "./content.ts";
import { calendarFile } from "./ics.ts";
import type { CalendarItem } from "./ics.ts";

const items = (
  entries: readonly Entry<Event>[],
  origin: string
): CalendarItem[] =>
  scheduled(entries).map(({ item, schedule }) => ({
    description: item.data.summary,
    location: item.data.location ?? undefined,
    schedule,
    summary: item.data.title,
    // The entry's internal id survives slug changes, so subscribers never see a duplicate.
    uid: `${item.data.id}@${new URL(origin).hostname}`,
    url: `${origin}/events/${item.id}`,
  }));

export const calendarResponse = (
  entries: readonly Entry<Event>[],
  options: {
    readonly origin: string;
    readonly name: string;
    readonly filename: string;
  }
): Response => {
  const now = new Date();
  return new Response(
    calendarFile(items(entries, options.origin), {
      name: options.name,
      now,
      today: churchToday(now),
    }),
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Disposition": `inline; filename="${options.filename.replaceAll(/[^\w.-]/gu, "-")}"`,
        "Content-Type": "text/calendar; charset=utf-8",
      },
    }
  );
};

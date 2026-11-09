/**
 * Ani's schedule in the admin, as Block Kit: the next appointments day by day
 * on the dashboard, the next weeks with Open and Cancel on each, and the
 * address that puts them on her phone's calendar. Each appointment is two
 * short lines (time and name; service and phone) so it reads on a phone, where
 * a wide table scrolled its names and buttons off screen.
 */
import type { Block, BlockResponse } from "@emdash-cms/blocks";
import { formatPhone } from "@jakebodea/cloudflare-kit/emdash/admin/format";

import {
  addDays,
  formatDate,
  formatTime,
  toLocal,
} from "../lib/booking/calendar.ts";
import type { Appointment } from "../lib/booking/services.ts";
import { HAIR_HISTORY, serviceFor } from "../lib/labels.ts";

export const CANCEL_ACTION = "cancel";

const when = (start: Date, timeZone: string, today: string) => {
  const local = toLocal(start, timeZone);
  const day = local.date === today ? "Today" : formatDate(local.date);
  return `${day}, ${formatTime(local.minutes)}`;
};

/** "Today, November 9", "Tomorrow, November 10", or "Thursday, November 12"; the year only when it differs. */
export const dayLabel = (date: string, today: string): string => {
  const year = Number(today.slice(0, 4));
  const long = formatDate(date, year);
  // "Tuesday, November 10" without the weekday, short enough for one line in a card.
  const short = long.slice(long.indexOf(", ") + 2);
  if (date === today) {
    return `Today, ${short}`;
  }
  if (date === addDays(today, 1)) {
    return `Tomorrow, ${short}`;
  }
  return long;
};

/** Appointments by their local day, in the order they come. */
export const byDay = (
  appointments: readonly Appointment[],
  timeZone: string
): readonly (readonly [string, readonly Appointment[]])[] => {
  const days = new Map<string, Appointment[]>();
  for (const appointment of appointments) {
    const { date } = toLocal(appointment.start, timeZone);
    days.set(date, [...(days.get(date) ?? []), appointment]);
  }
  return [...days];
};

const NO_BREAK_SPACE = String.fromCodePoint(0xa0);
const NO_BREAK_HYPHEN = String.fromCodePoint(0x20_11);

/** A phone number kept on one line: no break at its space or hyphen. */
const unbroken = (text: string) =>
  text.replaceAll(" ", NO_BREAK_SPACE).replaceAll("-", NO_BREAK_HYPHEN);

/** The time and who, then what and how to reach them: the two lines Ani reads first. */
export const appointmentLines = (
  appointment: Appointment,
  timeZone: string
) => ({
  details: [
    serviceFor(appointment.service, appointment.clientFor),
    appointment.phone === undefined
      ? undefined
      : unbroken(formatPhone(appointment.phone)),
  ]
    .filter((part) => part !== undefined && part !== "")
    .join(" · "),
  who: `${formatTime(toLocal(appointment.start, timeZone).minutes)} · ${appointment.clientName}`,
});

const openLink = (appointment: Appointment) =>
  ({
    appearance: "secondary",
    label: "Open",
    target: { collection: "appointments", id: appointment.id, kind: "content" },
    type: "link",
  }) as const;

const cancelButton = (appointment: Appointment) =>
  ({
    action_id: CANCEL_ACTION,
    confirm: {
      confirm: "Cancel and tell the client",
      deny: "Keep it",
      style: "danger",
      text: `${appointment.clientName} will get an email asking them to choose a new time.`,
      title: "Cancel this appointment?",
    },
    label: "Cancel",
    style: "secondary",
    type: "button",
    value: appointment.id,
  }) as const;

/** Each day under its name, the days set apart by a line, the way a phone calendar lists them. */
const days = (
  appointments: readonly Appointment[],
  timeZone: string,
  today: string,
  entry: (appointment: Appointment) => Block[]
): Block[] =>
  byDay(appointments, timeZone).flatMap(([date, list], index): Block[] => [
    ...(index === 0 ? [] : [{ type: "divider" } as const]),
    { text: dayLabel(date, today), type: "header" },
    ...list.flatMap(entry),
  ]);

/** The Schedule page lists this many appointments, the rest are under Appointments; a full page of them stays well inside EmDash's 2000-node limit (see the test). */
const PAGE_SHOWN = 30;
/** The dashboard card lists this many. */
const WIDGET_SHOWN = 6;

/** At most this many appointments' photos on the page; the rest wait their turn. */
const HAIR_NOTES_SHOWN = 8;

const photoColumn = (
  appointment: Appointment,
  kind: "now" | "goal",
  label: string
): Block[] => {
  const photos = appointment.hairPhotos.filter((photo) => photo.kind === kind);
  return [
    { text: label, type: "context" },
    ...(photos.length === 0
      ? [{ text: "No photo", type: "context" } as const]
      : photos.map((photo, index): Block => ({
          alt: `${appointment.clientName}, ${label.toLowerCase()} ${index + 1}`,
          type: "image",
          url: photo.path,
        }))),
  ];
};

/** What clients told Ani about their hair, with their photos, before they arrive. */
const hairNotes = (
  upcoming: readonly Appointment[],
  timeZone: string,
  today: string
): Block[] => {
  const withNotes = upcoming
    .filter(
      (appointment) =>
        appointment.hairPhotos.length > 0 ||
        appointment.hairHistory !== undefined
    )
    .slice(0, HAIR_NOTES_SHOWN);
  if (withNotes.length === 0) {
    return [];
  }
  return [
    { type: "divider" },
    { text: "Before they arrive", type: "header" },
    {
      text: "What clients said about their hair, and the photos they sent.",
      type: "context",
    },
    ...withNotes.flatMap((appointment): Block[] => {
      const history =
        appointment.hairHistory === undefined
          ? undefined
          : HAIR_HISTORY[appointment.hairHistory];
      return [
        {
          text: `${appointment.clientName}: ${serviceFor(appointment.service, appointment.clientFor)}, ${when(appointment.start, timeZone, today)}`,
          type: "section",
        },
        ...(history === undefined
          ? []
          : [
              {
                text: `Color on their hair now: ${history.label}.${history.needsCorrection ? " This may need a color correction; call them if the time or price will change." : ""}`,
                type: "context",
              } as const,
            ]),
        ...(appointment.hairPhotos.length === 0
          ? []
          : [
              {
                columns: [
                  photoColumn(appointment, "now", "Hair now"),
                  photoColumn(appointment, "goal", "The look they want"),
                ],
                type: "columns",
              } satisfies Block,
            ]),
      ];
    }),
  ];
};

export const schedulePage = ({
  feedUrl,
  timeZone,
  upcoming,
  now,
}: {
  readonly upcoming: readonly Appointment[];
  readonly timeZone: string;
  readonly feedUrl: string;
  readonly now: Date;
}): BlockResponse => {
  const today = toLocal(now, timeZone).date;
  const todays = upcoming.filter(
    (appointment) => toLocal(appointment.start, timeZone).date === today
  );
  const week = upcoming.filter(
    (appointment) =>
      appointment.start.getTime() - now.getTime() < 7 * 86_400_000
  );
  const blocks: Block[] = [
    { text: "Schedule", type: "header" },
    {
      items: [
        { label: "Today", value: todays.length },
        { label: "Next 7 days", value: week.length },
        { label: "Booked ahead", value: upcoming.length },
      ],
      type: "stats",
    },
    ...(upcoming.length === 0
      ? [{ text: "No upcoming appointments yet.", type: "context" } as const]
      : [
          { type: "divider" } as const,
          ...days(
            upcoming.slice(0, PAGE_SHOWN),
            timeZone,
            today,
            (appointment): Block[] => {
              const { details, who } = appointmentLines(appointment, timeZone);
              return [
                { text: who, type: "section" },
                ...(details === ""
                  ? []
                  : [{ text: details, type: "context" } as const]),
                {
                  elements: [openLink(appointment), cancelButton(appointment)],
                  type: "actions",
                },
              ];
            }
          ),
        ]),
    ...(upcoming.length > PAGE_SHOWN
      ? [
          {
            text: `${upcoming.length - PAGE_SHOWN} more after these. Open Appointments in the menu to see them all.`,
            type: "context",
          } as const,
        ]
      : []),
    {
      text: "Open an appointment to change its time or notes. To block time off, use Time off in the menu.",
      type: "context",
    },
    ...hairNotes(upcoming, timeZone, today),
    { type: "divider" },
    { text: "Your appointments on your phone", type: "header" },
    {
      text: "Subscribe to this address once, and new bookings appear in your phone's calendar by themselves. Keep it private: anyone with it can see your appointments.",
      type: "section",
    },
    { code: feedUrl, language: "bash", type: "code" },
    {
      blocks: [
        {
          text: "iPhone: open Settings, then Calendar, Calendar Accounts, Add Account, Other, Add Subscribed Calendar. Paste the address and select Next, then Save.",
          type: "section",
        },
        {
          text: "Google Calendar on a computer: next to Other calendars select the plus, then From URL. Paste the address and select Add calendar. Google refreshes it every few hours.",
          type: "section",
        },
      ],
      label: "How to add it",
      type: "accordion",
    },
  ];
  return { blocks };
};

export const todayWidget = ({
  timeZone,
  upcoming,
  now,
}: {
  readonly upcoming: readonly Appointment[];
  readonly timeZone: string;
  readonly now: Date;
}): BlockResponse => {
  const today = toLocal(now, timeZone).date;
  const rest = upcoming.length - WIDGET_SHOWN;
  return {
    blocks: [
      ...(upcoming.length === 0
        ? [{ text: "No upcoming appointments.", type: "context" } as const]
        : days(
            upcoming.slice(0, WIDGET_SHOWN),
            timeZone,
            today,
            (appointment): Block[] => {
              const { details, who } = appointmentLines(appointment, timeZone);
              return [
                { text: who, type: "section" },
                ...(details === ""
                  ? []
                  : [{ text: details, type: "context" } as const]),
              ];
            }
          )),
      ...(rest > 0
        ? [
            {
              text: `${rest} more booked after these.`,
              type: "context",
            } as const,
          ]
        : []),
      {
        elements: [
          {
            appearance: "primary",
            label: "Open schedule",
            target: { kind: "plugin-page", path: "/schedule" },
            type: "link",
          },
        ],
        type: "actions",
      },
    ],
  };
};

/**
 * Ani's schedule in the admin, as Block Kit: today at a glance, the next
 * weeks of appointments with a Cancel button each, and the address that puts
 * them on her phone's calendar.
 */
import type { Block, BlockResponse } from "@emdash-cms/blocks";

import { formatDate, formatTime, toLocal } from "../lib/booking/calendar.ts";
import type { Appointment } from "../lib/booking/services.ts";

export const CANCEL_ACTION = "cancel";
export const PAGE_ACTION = "page";

const when = (start: Date, timeZone: string, today: string) => {
  const local = toLocal(start, timeZone);
  const day = local.date === today ? "Today" : formatDate(local.date);
  return `${day}, ${formatTime(local.minutes)}`;
};

const row = (appointment: Appointment, timeZone: string, today: string) => ({
  action: {
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
  },
  client: {
    appearance: "inline",
    label: appointment.clientName,
    target: { collection: "appointments", id: appointment.id, kind: "content" },
    type: "link",
  },
  phone: appointment.phone ?? "",
  service: appointment.service,
  when: when(appointment.start, timeZone, today),
});

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
    {
      columns: [
        { key: "when", label: "When" },
        { format: "element", key: "client", label: "Client" },
        { key: "service", label: "Service" },
        { key: "phone", label: "Phone" },
        { format: "element", key: "action", label: "" },
      ],
      empty_text: "No upcoming appointments yet.",
      page_action_id: PAGE_ACTION,
      rows: upcoming.map((appointment) => row(appointment, timeZone, today)),
      type: "table",
    },
    {
      text: "Open an appointment to change its time or notes. To block time off, use Time off in the sidebar.",
      type: "context",
    },
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
  const next = upcoming.slice(0, 5);
  return {
    blocks: [
      next.length === 0
        ? { text: "No upcoming appointments.", type: "context" }
        : {
            fields: next.map((appointment) => ({
              label: when(appointment.start, timeZone, today),
              value: `${appointment.clientName}, ${appointment.service}`,
            })),
            type: "fields",
          },
      {
        elements: [
          {
            appearance: "secondary",
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

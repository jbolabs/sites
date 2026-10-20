import { CalendarPlusIcon, CheckIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatTime, toLocal } from "@/lib/booking/calendar";

import type { Confirmation as Booked } from "./types";

interface ConfirmationProps {
  readonly booking: Booked;
  readonly email: string;
  readonly timeZone: string;
}

export const Confirmation = ({
  booking,
  email,
  timeZone,
}: ConfirmationProps) => {
  const start = toLocal(new Date(booking.start), timeZone);
  const end = toLocal(new Date(booking.end), timeZone);
  return (
    <output className="block max-w-2xl">
      <span className="bg-espresso text-ivory flex size-12 items-center justify-center rounded-full">
        <CheckIcon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-display-sm mt-6">You are booked.</h2>
      <p className="text-foreground/75 mt-4 text-lg">
        A confirmation is on its way to{" "}
        <span className="text-espresso-deep font-medium break-all">
          {email}
        </span>
        .
      </p>
      <dl className="bg-card border-border divide-border mt-8 divide-y rounded-2xl border">
        <div className="p-5 sm:px-7">
          <dt className="text-muted-foreground text-sm">Service</dt>
          <dd className="font-display text-espresso-deep mt-1 text-xl">
            {booking.service}
          </dd>
        </div>
        <div className="p-5 sm:px-7">
          <dt className="text-muted-foreground text-sm">When</dt>
          <dd className="font-display text-espresso-deep mt-1 text-xl">
            {formatDate(start.date)}, {formatTime(start.minutes)} to{" "}
            {formatTime(end.minutes)}
          </dd>
        </div>
        <div className="p-5 sm:px-7">
          <dt className="text-muted-foreground text-sm">Where</dt>
          <dd className="text-espresso-deep mt-1 text-lg">
            {booking.location}
          </dd>
        </div>
      </dl>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <a
          href={booking.calendarUrl}
          className={buttonVariants({ size: "hero" })}
        >
          <CalendarPlusIcon aria-hidden="true" />
          Add to calendar
        </a>
        <a
          href={booking.googleCalendarUrl}
          target="_blank"
          rel="noopener"
          className={buttonVariants({ size: "hero", variant: "outline" })}
        >
          Add to Google Calendar
        </a>
      </div>
      <p className="text-muted-foreground text-ui mt-8">
        Need to change something?{" "}
        <a
          href={booking.manageUrl}
          className="text-espresso-deep underline underline-offset-4"
        >
          Manage your appointment
        </a>
        .
      </p>
    </output>
  );
};

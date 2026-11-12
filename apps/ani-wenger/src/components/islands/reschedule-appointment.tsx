import { actions } from "astro:actions";
import { LoaderCircleIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { formatDate, formatTime, toLocal } from "@/lib/booking/calendar";

import { TimeStep } from "./booking/time-step";
import type { FetchDays } from "./booking/time-step";
import type { Slot } from "./booking/types";

interface RescheduleAppointmentProps {
  readonly id: string;
  readonly token: string;
  /** The current start (ISO), shown in the calendar but not offered. */
  readonly current: string;
  /** Today in the salon's time zone, `YYYY-MM-DD`. */
  readonly today: string;
  readonly timeZone: string;
  readonly phone: string;
}

type Status =
  | { readonly state: "idle" }
  | { readonly state: "picking" }
  | { readonly state: "sending" }
  | { readonly state: "error"; readonly message: string };

/**
 * Pick a new time, then confirm it. The move is one step on the server, so
 * the current time stays booked until the new one is taken.
 */
const RescheduleAppointment = ({
  current,
  id,
  phone,
  timeZone,
  today,
  token,
}: RescheduleAppointmentProps) => {
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [slot, setSlot] = useState<Slot | undefined>();
  // Bumped after a failed move, so the calendar reloads what is open now.
  const [calendar, setCalendar] = useState(0);

  if (status.state === "idle") {
    return (
      <div className="mt-4 space-y-4">
        <p className="text-foreground/80 text-lg">
          Choose a new time. Your current time stays yours until the new one is
          confirmed.
        </p>
        <Button
          variant="outline"
          size="cta"
          onClick={() => {
            setStatus({ state: "picking" });
          }}
        >
          Choose a new time
        </Button>
      </div>
    );
  }

  const fetchDays: FetchDays = async ({ days, from }) => {
    const { data, error } = await actions.rescheduleTimes({
      days,
      from,
      id,
      token,
    });
    return error === undefined
      ? { days: data.days }
      : { message: error.message };
  };

  const move = async (chosen: Slot) => {
    setStatus({ state: "sending" });
    const { error } = await actions.rescheduleAppointment({
      id,
      start: chosen.start,
      token,
    });
    if (error === undefined) {
      // Reload the page so every detail on it (and its calendar links) shows the new time.
      window.location.assign(
        `/appointment/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}&moved=1`
      );
      return;
    }
    setSlot(undefined);
    setCalendar((count) => count + 1);
    setStatus({ message: error.message, state: "error" });
  };

  const chosen =
    slot === undefined
      ? undefined
      : `${formatDate(toLocal(new Date(slot.start), timeZone).date)} at ${formatTime(slot.minutes)}`;

  return (
    <div className="mt-6 space-y-8">
      <TimeStep
        key={calendar}
        fetchDays={fetchDays}
        today={today}
        current={current}
        selected={slot}
        phone={phone}
        onSelect={(picked) => {
          setSlot(picked);
          if (status.state === "error") {
            setStatus({ state: "picking" });
          }
        }}
      />
      {status.state === "error" && <FieldError>{status.message}</FieldError>}
      <div className="border-border flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center">
        <Button
          size="cta"
          disabled={slot === undefined || status.state === "sending"}
          onClick={() => {
            if (slot !== undefined) {
              void move(slot);
            }
          }}
        >
          {status.state === "sending" && (
            <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
          )}
          {chosen === undefined ? "Pick a time above" : `Move to ${chosen}`}
        </Button>
        <Button
          variant="ghost"
          size="cta"
          disabled={status.state === "sending"}
          onClick={() => {
            setSlot(undefined);
            setStatus({ state: "idle" });
          }}
        >
          Keep my current time
        </Button>
      </div>
    </div>
  );
};

export default RescheduleAppointment;

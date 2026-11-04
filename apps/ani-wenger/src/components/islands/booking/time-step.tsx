import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  addDays,
  daysBetween,
  formatDate,
  formatTime,
  WEEKDAYS,
  weekday,
} from "@/lib/booking/calendar";

import {
  daysInMonth,
  monthLabel,
  monthStart,
  monthsAhead,
  nextMonth,
  previousMonth,
} from "./month";
import type { Day, Slot } from "./types";

/** Open times for `days` local dates from `from`, or a message to show. */
export type FetchDays = (request: {
  readonly from: string;
  readonly days: number;
}) => Promise<
  | { readonly days: readonly Day[]; readonly message?: undefined }
  | { readonly message: string }
>;

interface TimeStepProps {
  /**
   * Where open times come from (a new visit, or moving one). Read once per
   * month shown: remount (`key`) when what it answers for changes, such as
   * the visit's services.
   */
  readonly fetchDays: FetchDays;
  /** Today in the salon's time zone, `YYYY-MM-DD`. */
  readonly today: string;
  readonly selected: Slot | undefined;
  readonly onSelect: (slot: Slot) => void;
  readonly phone: string;
  /** The client's current start (ISO), shown but not offered when moving a visit. */
  readonly current?: string | undefined;
}

type Load =
  | { readonly state: "ready"; readonly days: readonly Day[] }
  | { readonly state: "error"; readonly message: string };

const WEEK_HEADINGS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** How far the calendar lets people page ahead; the server's horizon decides what is open. */
const MAX_MONTHS_AHEAD = 6;
/** Months with nothing open are skipped automatically, at most this many times. */
const AUTO_ADVANCE = 3;

const PERIODS = [
  { from: 0, label: "Morning", to: 720 },
  { from: 720, label: "Afternoon", to: 1020 },
  { from: 1020, label: "Evening", to: 1440 },
] as const;

const openCount = (count: number) => {
  if (count === 0) {
    return "no open times";
  }
  return count === 1 ? "1 open time" : `${count} open times`;
};

const loadMonth = async (
  fetchDays: FetchDays,
  month: string,
  today: string
): Promise<Load> => {
  const from = month < today ? today : month;
  const result = await fetchDays({
    days: daysBetween(from, nextMonth(month)),
    from,
  });
  return result.message === undefined
    ? { days: result.days, state: "ready" }
    : { message: result.message, state: "error" };
};

/**
 * On a phone the times sit below the calendar: after a day is tapped, bring
 * them up if they are mostly off screen. Wide layouts show both side by side.
 */
const revealTimes = (element: HTMLElement | null) => {
  if (element === null) {
    return;
  }
  const { top } = element.getBoundingClientRect();
  if (top > window.innerHeight * 0.6) {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    element.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  }
};

const isEmpty = (load: Load) =>
  load.state === "ready" &&
  load.days.every((candidate) => candidate.slots.length === 0);

/** A month calendar of open days, then the open times of the chosen day. */
export const TimeStep = ({
  current,
  fetchDays,
  onSelect,
  phone,
  selected,
  today,
}: TimeStepProps) => {
  const [month, setMonth] = useState(() => monthStart(today));
  const [loads, setLoads] = useState<ReadonlyMap<string, Load>>(
    () => new Map()
  );
  const [chosenDay, setChosenDay] = useState<string | undefined>();
  // Until someone pages by hand, an empty month moves on to the next one.
  const autoAdvance = useRef(AUTO_ADVANCE);
  const times = useRef<HTMLDivElement>(null);

  const load = loads.get(month);
  // Kept in a ref: a parent re-render hands over a new function that answers the same.
  const source = useRef(fetchDays);
  useEffect(() => {
    let cancelled = false;
    const fetchMonth = async () => {
      const result = await loadMonth(source.current, month, today);
      if (cancelled) {
        return;
      }
      setLoads((previous) => new Map(previous).set(month, result));
      if (isEmpty(result) && autoAdvance.current > 0) {
        autoAdvance.current -= 1;
        setMonth(nextMonth(month));
      }
    };
    if (load === undefined) {
      void fetchMonth();
    }
    return () => {
      cancelled = true;
    };
  }, [load, month, today]);

  const pageTo = (target: string) => {
    autoAdvance.current = 0;
    setMonth(target);
  };

  const days = load?.state === "ready" ? load.days : [];
  const open = new Map(
    days.map((candidate) => [candidate.date, candidate.slots])
  );
  const firstOpen = days.find((candidate) => candidate.slots.length > 0)?.date;
  const day =
    chosenDay !== undefined && (open.get(chosenDay)?.length ?? 0) > 0
      ? chosenDay
      : firstOpen;
  const slots = day === undefined ? [] : (open.get(day) ?? []);
  // Sunday-first grid: blanks before the 1st.
  const offset = WEEKDAYS.indexOf(weekday(month));
  const cells = Array.from({ length: daysInMonth(month) }, (_, index) =>
    addDays(month, index)
  );
  const year = Number(today.slice(0, 4));
  const firstMonth = monthStart(today);

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-2xl" aria-live="polite">
            {monthLabel(month)}
          </h3>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-round"
              aria-label="Previous month"
              disabled={month <= firstMonth}
              onClick={() => {
                pageTo(previousMonth(month));
              }}
            >
              <ChevronLeftIcon aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon-round"
              aria-label="Next month"
              disabled={month >= monthsAhead(firstMonth, MAX_MONTHS_AHEAD)}
              onClick={() => {
                pageTo(nextMonth(month));
              }}
            >
              <ChevronRightIcon aria-hidden="true" />
            </Button>
          </div>
        </div>
        <fieldset className="grid grid-cols-7 gap-1.5 text-center">
          <legend className="sr-only">Days in {monthLabel(month)}</legend>
          {WEEK_HEADINGS.map((heading) => (
            <span
              key={heading}
              className="text-muted-foreground pb-2 text-xs font-medium"
              aria-hidden="true"
            >
              {heading}
            </span>
          ))}
          {Array.from({ length: offset }, (_, index) => (
            <span key={`blank-${index}`} aria-hidden="true" />
          ))}
          {cells.map((date) => {
            const count = open.get(date)?.length ?? 0;
            return (
              <Button
                key={date}
                variant="choice"
                size="day"
                disabled={count === 0}
                aria-pressed={day === date}
                aria-label={`${formatDate(date, year)}, ${openCount(count)}`}
                onClick={() => {
                  setChosenDay(date);
                  requestAnimationFrame(() => {
                    revealTimes(times.current);
                  });
                }}
              >
                {Number(date.slice(8))}
              </Button>
            );
          })}
        </fieldset>
        {load === undefined && (
          <output className="text-muted-foreground mt-4 flex items-center gap-2 text-sm">
            <LoaderCircleIcon
              className="size-4 animate-spin"
              aria-hidden="true"
            />
            Finding open times
          </output>
        )}
        {load?.state === "error" && (
          <p className="text-destructive mt-4 text-sm" role="alert">
            {load.message}
          </p>
        )}
      </div>
      <div ref={times} aria-live="polite" className="scroll-mt-24">
        {day === undefined && load?.state === "ready" && (
          <p className="text-muted-foreground bg-sand/60 rounded-2xl p-6 leading-relaxed">
            No open times this month. Try the next month, or call{" "}
            <a
              href={`tel:${phone}`}
              className="text-espresso-deep underline underline-offset-4"
            >
              {phone}
            </a>{" "}
            and I will find you a time.
          </p>
        )}
        {day !== undefined && (
          <>
            <h3 className="text-2xl">{formatDate(day, year)}</h3>
            <div className="mt-5 space-y-6">
              {PERIODS.map((period) => {
                const inPeriod = slots.filter(
                  (slot) =>
                    slot.minutes >= period.from && slot.minutes < period.to
                );
                if (inPeriod.length === 0) {
                  return null;
                }
                return (
                  <section key={period.label} aria-label={period.label}>
                    <h4 className="text-muted-foreground mb-2.5 text-sm font-medium">
                      {period.label}
                    </h4>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {inPeriod.map((slot) => (
                        <Button
                          key={slot.start}
                          variant="choice"
                          size="slot"
                          disabled={slot.start === current}
                          aria-label={
                            slot.start === current
                              ? `${formatTime(slot.minutes)}, your current time`
                              : undefined
                          }
                          aria-pressed={selected?.start === slot.start}
                          onClick={() => {
                            onSelect(slot);
                          }}
                        >
                          {formatTime(slot.minutes)}
                        </Button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

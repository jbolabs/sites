import { actions, isInputError } from "astro:actions";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatDate, formatTime, toLocal } from "@/lib/booking/calendar";

import { Confirmation } from "./booking/confirmation";
import { DetailsStep } from "./booking/details-step";
import type { Details } from "./booking/details-step";
import { ServiceStep } from "./booking/service-step";
import { TimeStep } from "./booking/time-step";
import type {
  Confirmation as Booked,
  ServiceOption,
  Slot,
} from "./booking/types";
import { useTurnstile } from "./booking/use-turnstile";

interface BookingFlowProps {
  readonly services: readonly ServiceOption[];
  readonly initialService: string | undefined;
  readonly turnstileSiteKey: string;
  readonly timeZone: string;
  readonly bookingNote: string;
  readonly phone: string;
  /** Today in the salon's time zone, from the server, so every visitor's calendar agrees. */
  readonly today: string;
}

type Submission =
  | { readonly state: "idle" }
  | { readonly state: "sending" }
  | { readonly state: "error"; readonly message: string }
  | {
      readonly state: "booked";
      readonly booking: Booked;
      readonly email: string;
    };

type Editing = "service" | "time" | undefined;

/** 1: choose a service, 2: pick a time, 3: your details. */
const currentStep = (
  chosen: ServiceOption | undefined,
  slot: Slot | undefined,
  editing: Editing
): 1 | 2 | 3 => {
  if (chosen === undefined || editing === "service") {
    return 1;
  }
  return slot === undefined || editing === "time" ? 2 : 3;
};

const serviceSummary = (service: ServiceOption) =>
  [service.title, service.duration, service.price]
    .filter((part) => part !== undefined)
    .join(" · ");

const slotSummary = (slot: Slot, timeZone: string) => {
  const local = toLocal(new Date(slot.start), timeZone);
  return `${formatDate(local.date)} at ${formatTime(local.minutes)}`;
};

const StepHeading = ({
  done,
  number,
  onChange,
  title,
}: {
  readonly number: number;
  readonly title: string;
  readonly done?: string | undefined;
  readonly onChange?: (() => void) | undefined;
}) => (
  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
    <h2 className="text-step flex items-baseline gap-3">
      <span className="text-clay font-sans text-base font-medium tabular-nums">
        {number}
      </span>
      {title}
    </h2>
    {done !== undefined && onChange !== undefined && (
      <p className="text-ui flex flex-wrap items-baseline gap-x-3">
        <span className="text-foreground/75">{done}</span>
        <Button variant="text-link" size="inline" onClick={onChange}>
          Change
        </Button>
      </p>
    )}
  </div>
);

/** On a phone the next step starts below the fold: bring it into view when it opens. */
const useScrollToStep = (step: number) => {
  const sections = useRef<(HTMLElement | null)[]>([]);
  const previous = useRef(step);
  useEffect(() => {
    if (step === previous.current) {
      return;
    }
    previous.current = step;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    sections.current[step - 1]?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  }, [step]);
  return (index: number) => (element: HTMLElement | null) => {
    sections.current[index] = element;
  };
};

/** Keeps `?service=` in the address bar, so a shared link opens on the same service. */
const useServiceInUrl = (service: string | undefined) => {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (service === undefined) {
      url.searchParams.delete("service");
    } else {
      url.searchParams.set("service", service);
    }
    window.history.replaceState(null, "", url);
  }, [service]);
};

/**
 * The booking flow: choose a service, a day and time, then your details. Each
 * step stays on one page, so a client can change an earlier answer without
 * losing the rest. Open times come from the server; the island holds no rules.
 */
const BookingFlow = ({
  bookingNote,
  initialService,
  phone,
  services,
  timeZone,
  today,
  turnstileSiteKey,
}: BookingFlowProps) => {
  const known = services.some((option) => option.slug === initialService);
  const [service, setService] = useState(known ? initialService : undefined);
  const [slot, setSlot] = useState<Slot | undefined>();
  const [editing, setEditing] = useState<Editing>(
    known ? undefined : "service"
  );
  const [submission, setSubmission] = useState<Submission>({ state: "idle" });
  const turnstile = useTurnstile(turnstileSiteKey);
  const chosen = services.find((option) => option.slug === service);
  const step = currentStep(chosen, slot, editing);
  const sectionRef = useScrollToStep(step);
  const confirmation = useRef<HTMLDivElement>(null);
  const booked = submission.state === "booked";
  // Bring the confirmation (not the page header above it) into view.
  useEffect(() => {
    if (booked) {
      confirmation.current?.scrollIntoView({ block: "start" });
    }
  }, [booked]);
  useServiceInUrl(service);

  if (submission.state === "booked") {
    return (
      <div ref={confirmation} className="scroll-mt-28">
        <Confirmation
          booking={submission.booking}
          email={submission.email}
          timeZone={timeZone}
        />
      </div>
    );
  }

  const book = async (details: Details) => {
    if (chosen === undefined || slot === undefined) {
      return;
    }
    setSubmission({ state: "sending" });
    const { data, error } = await actions.book({
      email: details.email,
      name: details.name,
      notes: details.notes.trim() === "" ? undefined : details.notes,
      phone: details.phone,
      service: chosen.slug,
      start: slot.start,
      turnstileToken: turnstile.token,
    });
    if (error === undefined) {
      setSubmission({
        booking: data,
        email: details.email.trim(),
        state: "booked",
      });

      return;
    }
    turnstile.reset();
    if (error.code === "CONFLICT") {
      setSlot(undefined);
      setEditing("time");
    }
    setSubmission({
      message: isInputError(error)
        ? "Please check your details and try again."
        : error.message,
      state: "error",
    });
  };

  const submissionError =
    submission.state === "error" ? submission.message : undefined;
  const turnstileError = turnstile.failed
    ? "The spam check could not load. Please refresh the page."
    : undefined;

  return (
    <div className="space-y-14">
      <section ref={sectionRef(0)} className="scroll-mt-28 space-y-7">
        <StepHeading
          number={1}
          title="Choose a service"
          done={
            step > 1 && chosen !== undefined
              ? serviceSummary(chosen)
              : undefined
          }
          onChange={() => {
            setEditing("service");
          }}
        />
        {step === 1 && (
          <ServiceStep
            services={services}
            selected={service}
            onSelect={(slug) => {
              setService(slug);
              setSlot(undefined);
              setEditing(undefined);
            }}
          />
        )}
      </section>
      {step >= 2 && chosen !== undefined && (
        <section
          ref={sectionRef(1)}
          className="border-border scroll-mt-28 space-y-7 border-t pt-12"
        >
          <StepHeading
            number={2}
            title="Pick a day and time"
            done={
              step > 2 && slot !== undefined
                ? slotSummary(slot, timeZone)
                : undefined
            }
            onChange={() => {
              setEditing("time");
            }}
          />
          {step === 2 && (
            <TimeStep
              key={chosen.slug}
              service={chosen.slug}
              today={today}
              selected={slot}
              phone={phone}
              onSelect={(picked) => {
                setSlot(picked);
                setEditing(undefined);
                setSubmission({ state: "idle" });
              }}
            />
          )}
          {step === 2 && submissionError !== undefined && (
            <p className="text-destructive text-ui" role="alert">
              {submissionError}
            </p>
          )}
        </section>
      )}
      {step === 3 && (
        <section
          ref={sectionRef(2)}
          className="border-border scroll-mt-28 space-y-7 border-t pt-12"
        >
          <StepHeading number={3} title="Your details" />
          <DetailsStep
            bookingNote={bookingNote}
            sending={submission.state === "sending"}
            error={submissionError ?? turnstileError}
            turnstileRef={turnstile.ref}
            verified={turnstile.token !== ""}
            onSubmit={(details) => {
              void book(details);
            }}
          />
        </section>
      )}
    </div>
  );
};

export default BookingFlow;

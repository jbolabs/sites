import { actions, isInputError } from "astro:actions";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatDate, formatTime, toLocal } from "@/lib/booking/calendar";
import { combineVisit, isVisit } from "@/lib/booking/visit";
import { HAIR_HISTORY } from "@/lib/labels";
import type { HairHistory } from "@/lib/labels";

import { Confirmation } from "./booking/confirmation";
import { DetailsStep } from "./booking/details-step";
import type { Details } from "./booking/details-step";
import { HairStep } from "./booking/hair-step";
import { TimeStep } from "./booking/time-step";
import type {
  Audience,
  Confirmation as Booked,
  HairPhoto,
  ServiceOption,
  Slot,
} from "./booking/types";
import { useHairPhotos } from "./booking/use-hair-photos";
import { useTurnstile } from "./booking/use-turnstile";
import { VisitStep, servicesFor } from "./booking/visit-step";

interface BookingFlowProps {
  readonly services: readonly ServiceOption[];
  /** `?service=` from the address: one slug, or several comma-separated. */
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

type StepId = "visit" | "hair" | "time" | "details";

const STEP_TITLES: Record<StepId, string> = {
  details: "Your details",
  hair: "Your hair",
  time: "Pick a day and time",
  visit: "Build your visit",
};

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
const useScrollToStep = (step: StepId) => {
  const sections = useRef<Partial<Record<StepId, HTMLElement | null>>>({});
  const previous = useRef(step);
  useEffect(() => {
    if (step === previous.current) {
      return;
    }
    previous.current = step;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    sections.current[step]?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  }, [step]);
  return (id: StepId) => (element: HTMLElement | null) => {
    sections.current[id] = element;
  };
};

/** Keeps `?service=` in the address bar, so a shared link opens on the same visit. */
const useServicesInUrl = (slugs: readonly string[]) => {
  const value = slugs.join(",");
  useEffect(() => {
    const url = new URL(window.location.href);
    if (value === "") {
      url.searchParams.delete("service");
    } else {
      url.searchParams.set("service", value);
    }
    window.history.replaceState(null, "", url);
  }, [value]);
};

/** Men's services open the men's menu; everything else opens the women's. */
const audienceOf = (service: ServiceOption): Audience =>
  service.audience === "men" ? "men" : "women";

/** The visit a link asked for, and who it is for. */
const fromLink = (
  services: readonly ServiceOption[],
  initial: string | undefined
) => {
  const slugs = (initial ?? "")
    .split(",")
    .filter((slug) => services.some((service) => service.slug === slug));
  const first = services.find((service) => service.slug === slugs[0]);
  return {
    audience: first === undefined ? undefined : audienceOf(first),
    slugs,
  };
};

/** The visit includes color, so what is on the hair now matters. */
const asksHistory = (visit: readonly ServiceOption[]) =>
  visit.some(
    (service) =>
      service.category === "color" ||
      service.colorCorrection ||
      (service.category === "consultations" && service.asksForPhotos)
  );

/**
 * The color correction service to offer instead, when the answer about the
 * hair means old color has to come out and the visit books plain color.
 */
const correctionFor = (
  services: readonly ServiceOption[],
  visit: readonly ServiceOption[],
  history: HairHistory | undefined
): ServiceOption | undefined => {
  if (history === undefined || !HAIR_HISTORY[history].needsCorrection) {
    return undefined;
  }
  const color = visit.some((service) => service.category === "color");
  const corrected = visit.some((service) => service.colorCorrection);
  return color && !corrected
    ? services.find((service) => service.colorCorrection)
    : undefined;
};

/** "2 photos", the answer about color, or "No photos". */
const hairSummary = (
  photos: readonly HairPhoto[],
  history: HairHistory | undefined
) => {
  if (photos.length > 0) {
    return `${photos.length} ${photos.length === 1 ? "photo" : "photos"}`;
  }
  return history === undefined ? "No photos" : HAIR_HISTORY[history].label;
};

/**
 * The booking flow: build the visit, show your hair (for color and other
 * services where it changes the plan), pick a time, then your details. Each
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
  // Only the first render's value seeds the state below.
  const initial = fromLink(services, initialService);
  const [audience, setAudience] = useState(initial.audience);
  const [selected, setSelected] = useState<readonly string[]>(initial.slugs);
  // Which steps the client finished with Continue (time and details finish themselves).
  const [confirmed, setConfirmed] = useState({ hair: false, visit: false });
  const [history, setHistory] = useState<HairHistory | undefined>();
  const hairPhotos = useHairPhotos();
  const { photos } = hairPhotos;
  const [slot, setSlot] = useState<Slot | undefined>();
  const [editing, setEditing] = useState<StepId | undefined>();
  const [submission, setSubmission] = useState<Submission>({ state: "idle" });
  const turnstile = useTurnstile(turnstileSiteKey);

  const picked = new Set(selected);
  const chosen = services.filter((service) => picked.has(service.slug));
  const visit = combineVisit(chosen);
  const ready = isVisit(visit);
  const steps: StepId[] = [
    "visit",
    ...(ready && visit.asksForPhotos ? (["hair"] as const) : []),
    "time",
    "details",
  ];
  const done: Record<StepId, boolean> = {
    details: false,
    hair: confirmed.hair,
    time: slot !== undefined,
    visit: confirmed.visit && ready,
  };
  const step: StepId =
    editing !== undefined && steps.includes(editing)
      ? editing
      : (steps.find((id) => !done[id]) ?? "details");
  const stepIndex = steps.indexOf(step);
  const sectionRef = useScrollToStep(step);
  const confirmation = useRef<HTMLDivElement>(null);
  const booked = submission.state === "booked";
  // Bring the confirmation (not the page header above it) into view.
  useEffect(() => {
    if (booked) {
      confirmation.current?.scrollIntoView({ block: "start" });
    }
  }, [booked]);
  useServicesInUrl(selected);

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

  const changeVisit = (next: readonly string[]) => {
    setSelected(next);
    // A new visit may ask new questions (the color one), so the hair step opens again.
    setConfirmed({ hair: false, visit: false });
    setSlot(undefined);
    setEditing("visit");
  };

  const chooseAudience = (next: Audience) => {
    setAudience(next);
    const allowed = new Set(
      servicesFor(services, next).map((service) => service.slug)
    );
    changeVisit(selected.filter((slug) => allowed.has(slug)));
  };

  const toggle = (slug: string) => {
    changeVisit(
      selected.includes(slug)
        ? selected.filter((item) => item !== slug)
        : [...selected, slug]
    );
  };

  const correctionService = ready
    ? correctionFor(services, visit.services, history)
    : undefined;

  const book = async (details: Details) => {
    if (!ready || slot === undefined) {
      return;
    }
    setSubmission({ state: "sending" });
    const withHair = steps.includes("hair");
    const { data, error } = await actions.book({
      email: details.email,
      hairHistory:
        withHair && asksHistory(visit.services) ? history : undefined,
      name: details.name,
      notes: details.notes.trim() === "" ? undefined : details.notes,
      phone: details.phone,
      photos: withHair
        ? photos.map((photo) => ({ data: photo.data, kind: photo.kind }))
        : undefined,
      services: visit.services.map((service) => service.slug),
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

  const switchToCorrection = () => {
    if (correctionService !== undefined) {
      setSelected([correctionService.slug]);
      setSlot(undefined);
      setEditing("hair");
    }
  };

  const pickSlot = (time: Slot) => {
    setSlot(time);
    setEditing(undefined);
    setSubmission({ state: "idle" });
  };

  const visitStep = (
    <VisitStep
      services={services}
      audience={audience}
      onAudience={chooseAudience}
      selected={selected}
      onToggle={toggle}
      onContinue={() => {
        setConfirmed((current) => ({ ...current, visit: true }));
        setEditing(undefined);
      }}
    />
  );

  const summary: Partial<Record<StepId, string>> = {
    hair: hairSummary(photos, history),
    time: slot === undefined ? undefined : slotSummary(slot, timeZone),
    visit: ready
      ? [visit.title, visit.priceLabel].filter(Boolean).join(" · ")
      : undefined,
  };

  const body = (id: StepId) => {
    if (!ready) {
      return id === "visit" ? visitStep : null;
    }
    switch (id) {
      case "visit": {
        return visitStep;
      }
      case "hair": {
        return (
          <HairStep
            askHistory={asksHistory(visit.services)}
            history={history}
            onHistory={setHistory}
            correction={correctionService}
            onSwitchToCorrection={switchToCorrection}
            photos={photos}
            adding={hairPhotos.adding}
            photoError={hairPhotos.error}
            onAddPhotos={(kind, files) => {
              void hairPhotos.add(kind, files);
            }}
            onRemovePhoto={(photoId) => {
              hairPhotos.remove(photoId);
            }}
            onContinue={() => {
              setConfirmed((current) => ({ ...current, hair: true }));
              setEditing(undefined);
            }}
          />
        );
      }
      case "time": {
        return (
          <>
            <TimeStep
              key={selected.join(",")}
              services={visit.services.map((service) => service.slug)}
              today={today}
              selected={slot}
              phone={phone}
              onSelect={pickSlot}
            />
            {submissionError !== undefined && (
              <p className="text-destructive text-ui" role="alert">
                {submissionError}
              </p>
            )}
          </>
        );
      }
      case "details": {
        return (
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
        );
      }
      default: {
        return null;
      }
    }
  };

  return (
    <div className="space-y-14">
      {steps.map((id, index) => {
        if (index > stepIndex) {
          return null;
        }
        const finished = index < stepIndex;
        return (
          <section
            key={id}
            ref={sectionRef(id)}
            className={
              index === 0
                ? "scroll-mt-28 space-y-7"
                : "border-border scroll-mt-28 space-y-7 border-t pt-12"
            }
          >
            <StepHeading
              number={index + 1}
              title={STEP_TITLES[id]}
              done={finished ? summary[id] : undefined}
              onChange={() => {
                setEditing(id);
              }}
            />
            {!finished && body(id)}
          </section>
        );
      })}
    </div>
  );
};

export default BookingFlow;

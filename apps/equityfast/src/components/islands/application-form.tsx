import { pushDataLayerEvent } from "@jakebodea/cloudflare-kit/data-layer";
import {
  useAutoAdvance,
  useSelector,
  useTurnstile,
} from "@jakebodea/site-ui/form";
import { actions, isInputError } from "astro:actions";
import { LoaderCircleIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import type { UiStrings } from "@/i18n/ui";
import { STEP_KEYS, shownStep, stepsFor } from "@/lib/application-rules";
import type { ApplicationAnswers, StepKey } from "@/lib/application-rules";
import { cn } from "@/lib/utils";

import { clearDraft, readDraft, writeDraft } from "./application/draft";
import StepFields from "./application/step-fields";
import ApplicationSuccess from "./application/success";
import {
  APPLY_FORM_ID,
  useApplicationForm,
} from "./application/use-application-form";

export interface ApplicationFormProps {
  readonly locale: "en" | "es";
  readonly strings: UiStrings;
  readonly turnstileSiteKey: string;
  /** Amount carried over from an estimate, e.g. `$250,000`. */
  readonly initialAmount?: string | undefined;
  /** Renders the step question; the dialog wraps it in its accessible title. */
  readonly renderTitle?: (title: string) => ReactNode;
  /** Called by the success screen's button; without it the button links home. */
  readonly onDone?: () => void;
  readonly homeHref: string;
}

type Status =
  | { readonly state: "editing" }
  | { readonly state: "sending" }
  | { readonly state: "sent"; readonly firstName: string }
  | { readonly state: "error"; readonly message: string };

/** The step that carries the security check: the first one asking for contact details. */
const VERIFY_STEP: StepKey = "contact";

const defaultTitle = (title: string) => (
  <h2 className="text-ink text-question font-medium tracking-tight">{title}</h2>
);

const address = (
  answers: ApplicationAnswers,
  prefix: "property" | "primary"
): Address => ({
  city: answers[`${prefix}City`],
  state: answers[`${prefix}State`].toUpperCase(),
  street: answers[`${prefix}Street`],
  zip: answers[`${prefix}Zip`],
});

interface Address {
  readonly city: string;
  readonly state: string;
  readonly street: string;
  readonly zip: string;
}

/** What the `apply` action decodes (`ApplicationForm` in lib/application.ts). */
interface ApplyInput {
  readonly amount: string;
  readonly birthDate: string;
  readonly consent: boolean;
  readonly email: string;
  readonly firstName: string;
  readonly forSale: string;
  readonly income: string;
  readonly incomeSource: string;
  readonly lastName: string;
  readonly locale: "en" | "es";
  readonly middleName: string;
  readonly mortgageBalance: string;
  readonly occupancy: string;
  readonly otherIncome: string;
  readonly ownership: string;
  readonly phone: string;
  primaryAddress?: Address;
  readonly propertyAddress: Address;
  readonly turnstileToken: string;
}

const submitApplication = async (
  answers: ApplicationAnswers,
  locale: "en" | "es",
  turnstileToken: string
) => {
  const input: ApplyInput = {
    amount: answers.amount,
    birthDate: answers.birthDate,
    consent: answers.consent,
    email: answers.email,
    firstName: answers.firstName,
    forSale: answers.forSale,
    income: answers.income,
    incomeSource: answers.incomeSource,
    lastName: answers.lastName,
    locale,
    middleName: answers.middleName,
    mortgageBalance: answers.mortgageBalance,
    occupancy: answers.occupancy,
    otherIncome: answers.otherIncome,
    ownership: answers.ownership,
    phone: answers.phone,
    propertyAddress: address(answers, "property"),
    turnstileToken,
  };
  // The primary residence is asked (and sent) only when it isn't the property.
  if (answers.occupancy !== "Primary residence") {
    input.primaryAddress = address(answers, "primary");
  }
  return await actions.apply(input);
};

const submitLabel = (last: boolean, sending: boolean, t: UiStrings["form"]) => {
  if (!last) {
    return t.continue;
  }
  return sending ? t.sending : t.submit;
};

/**
 * The EquityFast application, one question per step. Used inside the dialog
 * on every page and on its own at `/apply`. Answers are checked with the same
 * rules the server applies (TanStack Form via `@jakebodea/site-ui/form`):
 * Continue is always enabled and flags what to fix, then each edit re-checks.
 * Turnstile is solved on the contact step and stays mounted (hidden) after
 * it, renewing its token, so the one sent at the end is still valid; the
 * server verifies it with the application. Rendered only in the browser (it
 * reads the saved draft on first render).
 */
const ApplicationForm = ({
  homeHref,
  initialAmount,
  locale,
  onDone,
  renderTitle = defaultTitle,
  strings,
  turnstileSiteKey,
}: ApplicationFormProps) => {
  const t = strings.form;
  // Read once: the form's starting answers must not change under it.
  const initial = useMemo(() => {
    const saved = readDraft();
    return {
      answers: {
        ...saved.answers,
        amount: initialAmount ?? saved.answers.amount,
      },
      step: initialAmount === undefined ? saved.step : ("amount" as const),
    };
  }, [initialAmount]);
  const [stepKey, setStepKey] = useState<StepKey>(initial.step);
  const [status, setStatus] = useState<Status>({ state: "editing" });
  // Which way the last step change went, so the next question slides in from that side.
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const heading = useRef<HTMLDivElement>(null);
  // From the contact step on (it comes before every step that can be skipped).
  const {
    failed: turnstileFailed,
    mount: turnstileMount,
    reset: resetTurnstile,
    token,
  } = useTurnstile({
    active: STEP_KEYS.indexOf(stepKey) >= STEP_KEYS.indexOf(VERIFY_STEP),
    locale,
    siteKey: turnstileSiteKey,
  });

  /** Shows `next`; the caller restarts the form so the new step starts quiet. */
  const move = (next: StepKey, values: ApplicationAnswers) => {
    const order = stepsFor(values);
    const from = order.indexOf(shownStep(stepKey, values));
    setDirection(order.indexOf(next) < from ? "back" : "forward");
    setStepKey(next);
    setStatus({ state: "editing" });
    // Move focus to the new question so screen readers announce it.
    requestAnimationFrame(() => heading.current?.focus());
  };

  const send = async (values: ApplicationAnswers) => {
    setStatus({ state: "sending" });
    const { error } = await submitApplication(values, locale, token);
    if (error === undefined) {
      clearDraft();
      // The agency's ad conversions (Tag Manager, prod only).
      pushDataLayerEvent("application_submitted");
      setStatus({ firstName: values.firstName.trim(), state: "sent" });
      return;
    }
    // Tokens are single use: a retry needs a new one.
    resetTurnstile();
    setStatus({
      message: isInputError(error) ? t.errorInvalid : error.message,
      state: "error",
    });
  };

  const form = useApplicationForm({
    errors: t.errors,
    initial: initial.answers,
    onStepDone: async (values, { restart }) => {
      const order = stepsFor(values);
      const position = order.indexOf(shownStep(stepKey, values));
      if (position >= order.indexOf(VERIFY_STEP) && token === "") {
        setStatus({ message: t.verifyFirst, state: "error" });
        return;
      }
      const next = order[position + 1];
      if (next === undefined) {
        await send(values);
        return;
      }
      move(next, values);
      restart();
    },
    step: stepKey,
  });
  const answers = useSelector(form.store, (state) => state.values);

  const steps = stepsFor(answers);
  const step = shownStep(stepKey, answers);
  const index = steps.indexOf(step);
  const last = index === steps.length - 1;

  useEffect(() => {
    writeDraft({ answers, step });
  }, [answers, step]);

  const autoAdvance = useAutoAdvance(() => {
    void form.handleSubmit();
  });

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status.state !== "sending") {
      void form.handleSubmit();
    }
  };

  if (status.state === "sent") {
    return (
      <ApplicationSuccess
        firstName={status.firstName}
        homeHref={homeHref}
        onDone={onDone}
        renderTitle={renderTitle}
        strings={t}
      />
    );
  }

  const copy = t.steps[step];
  const sending = status.state === "sending";
  const previous = steps[index - 1];
  // Shown where it is solved, and again at the end if it needs the visitor once more.
  const showTurnstile = step === VERIFY_STEP || (last && token === "");
  // A quick slide (200ms) keeps step changes from teleporting; the key replays it per question.
  const enter = cn(
    "animate-in fade-in ease-out-strong duration-200",
    direction === "forward" ? "slide-in-from-right-3" : "slide-in-from-left-3"
  );

  return (
    <form id={APPLY_FORM_ID} onSubmit={onSubmit} noValidate>
      {/*
       * In the phone sheet the question stays pinned while the fields scroll
       * under it, as in an iOS sheet. With the keyboard up the sheet is
       * shorter than the step, and the drawer centers the focused field,
       * which would otherwise push the question off the top. The negative
       * margins reach into the padding so the cover runs edge to edge without
       * moving anything. Drawer only: the dialog scrolls inside its padding,
       * where a pinned header would sit on the first field.
       */}
      <div className="z-10 -mx-5 -mt-5 bg-white px-5 pt-5 pb-1 in-data-[slot=drawer-content]:sticky in-data-[slot=drawer-content]:top-0">
        <div ref={heading} tabIndex={-1} className="outline-none">
          <div key={step} className={enter}>
            {renderTitle(copy.title)}
            <p className="text-graphite mt-2 text-base leading-relaxed">
              {"sub" in copy ? copy.sub : t.saves}
            </p>
          </div>
        </div>
        <div className="mt-5 flex gap-1" aria-hidden="true">
          {steps.map((key, position) => (
            <span
              key={key}
              className={cn(
                "h-1 flex-1 rounded-full",
                position <= index ? "bg-ink" : "bg-line"
              )}
            />
          ))}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {index + 1} / {steps.length}
      </p>

      <div key={step} className={cn("mt-5", enter)}>
        <StepFields
          form={form}
          step={step}
          title={copy.title}
          strings={strings}
          onChoice={autoAdvance}
        />
      </div>

      {/* One widget from the contact step on, so its token keeps renewing; hidden off its step. */}
      <div className={cn("mt-6", !showTurnstile && "hidden")}>
        <div ref={turnstileMount} className="min-h-16" />
        <p className="text-graphite mt-2 text-center text-xs">{t.security}</p>
      </div>

      {status.state === "error" && (
        <div className="animate-in fade-in slide-in-from-top-1 ease-out-strong mt-4 duration-200">
          <FieldError variant="banner">{status.message}</FieldError>
        </div>
      )}
      {turnstileFailed && (
        <div className="animate-in fade-in slide-in-from-top-1 ease-out-strong mt-4 duration-200">
          <FieldError variant="banner">{t.turnstileFailed}</FieldError>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        {previous !== undefined && (
          <Button
            type="button"
            variant="outline-ink"
            size="cta"
            onClick={() => {
              move(previous, answers);
              form.reset(answers, { keepDefaultValues: true });
            }}
          >
            {t.back}
          </Button>
        )}
        <Button type="submit" size="cta" className="ml-auto" disabled={sending}>
          {sending && (
            <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
          )}
          {submitLabel(last, sending, t)}
        </Button>
      </div>
      <p className="text-graphite mt-5 text-center text-xs">{t.disclaimer}</p>
    </form>
  );
};

export default ApplicationForm;

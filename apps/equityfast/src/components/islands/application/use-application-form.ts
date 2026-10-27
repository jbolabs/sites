import { useSiteForm } from "@jakebodea/site-ui/form";
import type { SiteFormOptions } from "@jakebodea/site-ui/form";

import type { UiStrings } from "@/i18n/ui";
import { shownStep } from "@/lib/application-rules";
import type { ApplicationAnswers, StepKey } from "@/lib/application-rules";

import { stepMessages } from "./messages";

/** The `<form id>`; a failed Continue focuses the first invalid field in it. */
export const APPLY_FORM_ID = "apply-form";

/**
 * The application's TanStack form. It holds every answer across steps but
 * checks only the step on screen, so Continue flags just the fields the
 * visitor can see.
 */
export const useApplicationForm = ({
  errors,
  initial,
  onStepDone,
  step,
}: {
  readonly errors: UiStrings["form"]["errors"];
  readonly initial: ApplicationAnswers;
  readonly onStepDone: SiteFormOptions<ApplicationAnswers>["onSubmit"];
  readonly step: StepKey;
}) =>
  useSiteForm({
    defaultValues: initial,
    formId: APPLY_FORM_ID,
    onSubmit: onStepDone,
    validate: (answers) =>
      stepMessages(shownStep(step, answers), answers, errors),
  });

export type ApplicationFormApi = ReturnType<typeof useApplicationForm>;

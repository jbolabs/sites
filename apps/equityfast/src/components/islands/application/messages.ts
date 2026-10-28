/**
 * The message under each field that fails a step's rules (the same rules the
 * server applies, from `lib/application-rules`), in the visitor's language.
 */
import type { FieldMessages } from "@jakebodea/site-ui/form";

import type { UiStrings } from "@/i18n/ui";
import { stepProblems } from "@/lib/application-rules";
import type { ApplicationAnswers, StepKey } from "@/lib/application-rules";

type Errors = UiStrings["form"]["errors"];
type Field = keyof ApplicationAnswers;

/** Fields with a message of their own; the rest share one by kind (name, street, ...). */
const OWN_MESSAGE: Partial<Record<Field, keyof Errors>> = {
  amount: "amount",
  birthDate: "birthDate",
  consent: "consent",
  email: "email",
  forSale: "choice",
  income: "income",
  incomeSource: "incomeSource",
  mortgageBalance: "mortgageBalance",
  occupancy: "choice",
  otherIncome: "otherIncome",
  ownership: "choice",
  phone: "phone",
  propertyValue: "propertyValue",
};

const KIND_MESSAGE: readonly (readonly [
  suffix: string,
  message: keyof Errors,
])[] = [
  ["Name", "name"],
  ["Street", "street"],
  ["City", "city"],
  ["State", "state"],
  ["Zip", "zip"],
];

/** The message under an invalid field; blank required fields say so plainly. */
export const errorFor = (
  field: Field,
  answers: ApplicationAnswers,
  errors: Errors
): string => {
  const own = OWN_MESSAGE[field];
  if (own !== undefined) {
    return errors[own];
  }
  const value = String(answers[field]);
  if (value.trim() === "" && field !== "middleName") {
    return field.endsWith("State") ? errors.state : errors.required;
  }
  const kind = KIND_MESSAGE.find(([suffix]) => field.endsWith(suffix));
  return errors[kind?.[1] ?? "required"];
};

/** Every failing field on `step`, with its message. */
export const stepMessages = (
  step: StepKey,
  answers: ApplicationAnswers,
  errors: Errors
): FieldMessages<ApplicationAnswers> =>
  Object.fromEntries(
    stepProblems(step, answers).map((field) => [
      field,
      errorFor(field, answers, errors),
    ])
  );

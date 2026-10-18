/**
 * The contact form and the prayer request form as the server receives them,
 * and how each becomes a lead in the shared contact pipeline
 * (`submitContact`: Turnstile -> CMS -> email). The contact form keeps the
 * fields of the church's previous Google Form; the prayer form keeps the old
 * prayer page's name, email, and request.
 */
import type { ContactForm, LeadAnswer } from "@jakebodea/cloudflare-kit/server";
import { Schema } from "effect";

const text = (min: number, max: number) =>
  Schema.Trim.check(Schema.isMinLength(min), Schema.isMaxLength(max));

const optionalText = (max: number) =>
  Schema.optional(Schema.Trim.check(Schema.isMaxLength(max)));

/** One `@`, a non-empty local part, and a dotted domain. Deliverability is the reply's job. */
export const isEmailAddress = (value: string): boolean => {
  const at = value.indexOf("@");
  const domain = value.slice(at + 1);
  const hasSingleAt = at > 0 && !domain.includes("@");
  const dottedDomain =
    domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".");
  return hasSingleAt && dottedDomain && !/\s/u.test(value);
};

const Email = Schema.Trim.check(
  Schema.isMaxLength(254),
  Schema.makeFilter((value: string) =>
    isEmailAddress(value) ? undefined : "Enter a valid email address"
  )
);

/** How the visitor prefers to hear back (the old form's checkboxes). */
export const CONTACT_METHODS = ["Email", "Cell phone"] as const;

const Shared = {
  email: Email,
  locale: Schema.Literals(["en", "ro"]),
  message: text(10, 5000),
  name: text(2, 120),
  turnstileToken: Schema.String,
};

export const ContactRequestForm = Schema.Struct({
  ...Shared,
  address: optionalText(160),
  city: text(1, 80),
  contactBy: Schema.optional(
    Schema.Array(Schema.Literals(CONTACT_METHODS)).check(Schema.isMaxLength(2))
  ),
  kind: Schema.Literal("contact"),
  phone: optionalText(40),
});

export const PrayerRequestForm = Schema.Struct({
  ...Shared,
  kind: Schema.Literal("prayer"),
});

/** What the form island sends: either form, told apart by `kind`. */
export const ChurchForm = Schema.Union([ContactRequestForm, PrayerRequestForm]);
export type ChurchForm = typeof ChurchForm.Type;

/** Lead labels in the CMS entry and the email (English, for the church office). */
export const KIND_QUESTION = "Request type";
export const KIND_LABEL = {
  contact: "Contact",
  prayer: "Prayer request",
} as const;
const LANGUAGE_NAME = { en: "English", ro: "Romanian" } as const;

export const toContactForm = (form: ChurchForm): ContactForm => {
  const answers: LeadAnswer[] = [
    { answer: KIND_LABEL[form.kind], question: KIND_QUESTION },
  ];
  let phone: string | undefined;
  if (form.kind === "contact") {
    if (form.address !== undefined && form.address !== "") {
      answers.push({ answer: form.address, question: "Home address" });
    }
    answers.push({ answer: form.city, question: "City" });
    if (form.contactBy !== undefined && form.contactBy.length > 0) {
      answers.push({
        answer: form.contactBy.join(", "),
        question: "Prefers contact by",
      });
    }
    phone = form.phone === "" ? undefined : form.phone;
  }
  answers.push({ answer: LANGUAGE_NAME[form.locale], question: "Language" });
  const lead: ContactForm = {
    answers,
    email: form.email,
    message: form.message,
    name: form.name,
    turnstileToken: form.turnstileToken,
  };
  return phone === undefined ? lead : { ...lead, phone };
};

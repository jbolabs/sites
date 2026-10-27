/**
 * The application as the server receives it, and how it becomes a lead in the
 * shared contact pipeline (`submitContact`: Turnstile -> CMS -> email). The
 * rules are the same plain functions the browser form uses.
 */
import type { ContactForm, LeadAnswer } from "@jakebodea/cloudflare-kit/server";
import { Schema } from "effect";

import {
  FOR_SALE,
  INCOME_SOURCES,
  OCCUPANCY,
  OWNERSHIP,
  formatAddress,
  formatDollars,
  isAmount,
  isBirthDate,
  isCity,
  isEmail,
  isIncome,
  isName,
  isPhone,
  isState,
  isStreet,
  isZip,
} from "./application-rules.ts";

const rule = (test: (value: string) => boolean, message: string) =>
  Schema.Trim.check(
    Schema.isMaxLength(254),
    Schema.makeFilter((value: string) => (test(value) ? undefined : message))
  );

const personName = rule(isName, "Enter a name using letters only");

const Address = Schema.Struct({
  city: rule(isCity, "Enter the city name"),
  state: rule(isState, "Choose a US state"),
  street: rule(isStreet, "Enter a house number and street"),
  zip: rule(isZip, "Enter a 5-digit ZIP code or ZIP+4"),
});

const income = rule(isIncome, "Enter an annual amount in dollars, or 0");

/** What the application island sends. Field limits double as spam guards. */
export const ApplicationForm = Schema.Struct({
  amount: rule(isAmount, "Enter an amount from $5,000 to $1,000,000"),
  /** `MM/DD/YYYY`, checked against today's date when the request arrives. */
  birthDate: rule(
    (value) => isBirthDate(value, new Date()),
    "Enter a date of birth as MM/DD/YYYY (18 or older)"
  ),
  /** Must be true: the visitor agreed to be contacted (TCPA). */
  consent: Schema.Literal(true),
  email: rule(isEmail, "Enter a valid email address"),
  firstName: personName,
  forSale: Schema.Literals(FOR_SALE),
  /** Pre-tax annual income, whole dollars as typed (`$140,000`). */
  income,
  incomeSource: Schema.Literals(INCOME_SOURCES),
  lastName: personName,
  locale: Schema.Literals(["en", "es"]),
  /** The island sends `""` when it is left blank. */
  middleName: Schema.optional(
    rule(
      (value) => value === "" || isName(value),
      "Enter a name using letters only"
    )
  ),
  occupancy: Schema.Literals(OCCUPANCY),
  /** Other annual income; `0` when there is none. */
  otherIncome: income,
  ownership: Schema.Literals(OWNERSHIP),
  phone: rule(isPhone, "Enter a 10-digit US phone number"),
  /** Omitted when the property is the primary residence. */
  primaryAddress: Schema.optional(Address),
  propertyAddress: Address,
  turnstileToken: Schema.String,
});
export type ApplicationForm = typeof ApplicationForm.Type;

const LANGUAGE_NAME = { en: "English", es: "Spanish" } as const;

/**
 * Question labels in the lead email and CMS entry (always English, for the
 * team reading them). The email groups its sections by these.
 */
export const QUESTION = {
  amount: "Amount seeking",
  birthDate: "Date of birth",
  consent: "Contact consent",
  forSale: "Listed for sale",
  income: "Pre-tax annual income",
  incomeSource: "Income source",
  language: "Language",
  occupancy: "Occupancy",
  otherIncome: "Other income",
  ownership: "Ownership",
  primaryAddress: "Primary residence",
  propertyAddress: "Property address",
} as const;
export const AMOUNT_QUESTION = QUESTION.amount;

/** The primary-residence answer when the visitor lives at the property. */
export const SAME_AS_PROPERTY = "Same as property";

const address = (value: typeof Address.Type) =>
  formatAddress(value.street, value.city, value.state, value.zip);

/** The application as a lead: legal name, contact, and its answers in E Mortgage Capital's order. */
export const toContactForm = (form: ApplicationForm): ContactForm => {
  const amount = formatDollars(form.amount);
  const name = [form.firstName, form.middleName, form.lastName]
    .filter((part) => part !== undefined && part !== "")
    .join(" ");
  const primary =
    form.occupancy === "Primary residence" || form.primaryAddress === undefined
      ? SAME_AS_PROPERTY
      : address(form.primaryAddress);
  const answers: LeadAnswer[] = [
    { answer: form.birthDate, question: QUESTION.birthDate },
    { answer: amount, question: QUESTION.amount },
    {
      answer: address(form.propertyAddress),
      question: QUESTION.propertyAddress,
    },
    { answer: form.occupancy, question: QUESTION.occupancy },
    { answer: form.ownership, question: QUESTION.ownership },
    { answer: primary, question: QUESTION.primaryAddress },
    { answer: formatDollars(form.income), question: QUESTION.income },
    { answer: formatDollars(form.otherIncome), question: QUESTION.otherIncome },
    { answer: form.incomeSource, question: QUESTION.incomeSource },
    { answer: form.forSale, question: QUESTION.forSale },
    { answer: "Yes (calls, texts, and email)", question: QUESTION.consent },
    { answer: LANGUAGE_NAME[form.locale], question: QUESTION.language },
  ];
  return {
    answers,
    email: form.email,
    message: `HELOC application for ${amount}.`,
    name,
    phone: form.phone,
    turnstileToken: form.turnstileToken,
  };
};

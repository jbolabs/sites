import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { ApplicationForm, toContactForm } from "./application.ts";

const primaryResidenceForm = {
  amount: "$75,000",
  birthDate: "05/20/1989",
  consent: true,
  email: "jordan@example.com",
  firstName: "Jordan",
  forSale: "No",
  income: "$140,000",
  incomeSource: "Employment",
  lastName: "Reyes",
  locale: "es",
  middleName: "A.",
  occupancy: "Investment property",
  otherIncome: "0",
  ownership: "LLC",
  phone: "(714) 555-0123",
  propertyAddress: {
    city: "Santa Ana",
    state: "ca",
    street: "3750 S Susan Street",
    zip: "92704",
  },
  turnstileToken: "token",
};

const submitted = {
  ...primaryResidenceForm,
  primaryAddress: {
    city: "Irvine",
    state: "CA",
    street: "1 Main St",
    zip: "92618",
  },
};

const decode = Schema.decodeUnknownSync(ApplicationForm);

describe(toContactForm, () => {
  it("turns an application into a lead with its answers in form order", () => {
    expect(toContactForm(decode(submitted))).toStrictEqual({
      answers: [
        { answer: "05/20/1989", question: "Date of birth" },
        { answer: "$75,000", question: "Amount seeking" },
        {
          answer: "3750 S Susan Street, Santa Ana, CA 92704",
          question: "Property address",
        },
        { answer: "Investment property", question: "Occupancy" },
        { answer: "LLC", question: "Ownership" },
        {
          answer: "1 Main St, Irvine, CA 92618",
          question: "Primary residence",
        },
        { answer: "$140,000", question: "Pre-tax annual income" },
        { answer: "$0", question: "Other income" },
        { answer: "Employment", question: "Income source" },
        { answer: "No", question: "Listed for sale" },
        {
          answer: "Yes (calls, texts, and email)",
          question: "Contact consent",
        },
        { answer: "Spanish", question: "Language" },
      ],
      email: "jordan@example.com",
      message: "HELOC application for $75,000.",
      name: "Jordan A. Reyes",
      phone: "(714) 555-0123",
      turnstileToken: "token",
    });
  });

  it("records the primary residence as the property when they are the same", () => {
    const form = decode({
      ...primaryResidenceForm,
      occupancy: "Primary residence",
    });
    expect(toContactForm(form).answers?.[5]).toStrictEqual({
      answer: "Same as property",
      question: "Primary residence",
    });
  });
});

describe(ApplicationForm, () => {
  it("rejects an application without contact consent", () => {
    expect(() => decode({ ...submitted, consent: false })).toThrow("consent");
  });

  it("rejects an amount outside the program range", () => {
    expect(() => decode({ ...submitted, amount: "$2,000" })).toThrow(
      "$5,000 to $1,000,000"
    );
  });

  it("rejects a state that isn't a US state and an over-long ZIP", () => {
    const address = { ...submitted.propertyAddress, state: "MM" };
    expect(() => decode({ ...submitted, propertyAddress: address })).toThrow(
      "Choose a US state"
    );
    expect(() =>
      decode({
        ...submitted,
        propertyAddress: { ...submitted.propertyAddress, zip: "9943400000" },
      })
    ).toThrow("Enter a 5-digit ZIP code or ZIP+4");
  });

  it("rejects a street with no house number", () => {
    expect(() =>
      decode({
        ...submitted,
        propertyAddress: { ...submitted.propertyAddress, street: "Main St" },
      })
    ).toThrow("Enter a house number and street");
  });

  it("accepts a ZIP+4 and a blank middle name", () => {
    const form = decode({
      ...submitted,
      middleName: "",
      propertyAddress: { ...submitted.propertyAddress, zip: "92704-1234" },
    });
    expect(toContactForm(form).name).toBe("Jordan Reyes");
    expect(toContactForm(form).answers?.[2]?.answer).toBe(
      "3750 S Susan Street, Santa Ana, CA 92704-1234"
    );
  });

  it("requires income, its source, and an adult date of birth", () => {
    expect(() => decode({ ...submitted, incomeSource: "Lottery" })).toThrow(
      "incomeSource"
    );
    expect(() => decode({ ...submitted, income: "" })).toThrow(
      "Enter an annual amount in dollars, or 0"
    );
    expect(() => decode({ ...submitted, birthDate: "02/30/1989" })).toThrow(
      "Enter a date of birth as MM/DD/YYYY (18 or older)"
    );
  });
});

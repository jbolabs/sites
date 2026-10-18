import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { ChurchForm, toContactForm } from "./forms.ts";

const decode = Schema.decodeUnknownSync(ChurchForm);

const contact = {
  address: "123 Main St",
  city: "Anaheim",
  contactBy: ["Email", "Cell phone"],
  email: "maria@example.com",
  kind: "contact",
  locale: "ro",
  message: "What time is the Sunday evening service?",
  name: "Maria Popescu",
  phone: "(714) 555-0123",
  turnstileToken: "token",
};

describe(toContactForm, () => {
  it("keeps the old Google Form's fields as answers on the lead", () => {
    expect(toContactForm(decode(contact))).toStrictEqual({
      answers: [
        { answer: "Contact", question: "Request type" },
        { answer: "123 Main St", question: "Home address" },
        { answer: "Anaheim", question: "City" },
        { answer: "Email, Cell phone", question: "Prefers contact by" },
        { answer: "Romanian", question: "Language" },
      ],
      email: "maria@example.com",
      message: "What time is the Sunday evening service?",
      name: "Maria Popescu",
      phone: "(714) 555-0123",
      turnstileToken: "token",
    });
  });

  it("marks a prayer request so the office can tell it apart", () => {
    const prayer = decode({
      email: "john@example.com",
      kind: "prayer",
      locale: "en",
      message: "Please pray for my mother's surgery on Friday.",
      name: "John Smith",
      turnstileToken: "token",
    });
    expect(toContactForm(prayer).answers).toStrictEqual([
      { answer: "Prayer request", question: "Request type" },
      { answer: "English", question: "Language" },
    ]);
  });
});

describe(ChurchForm, () => {
  it("requires a city on the contact form, as the old form did", () => {
    expect(() => decode({ ...contact, city: "" })).toThrow(/city/u);
  });

  it("rejects an email without a domain", () => {
    expect(() => decode({ ...contact, email: "maria@example" })).toThrow(
      /Enter a valid email address/u
    );
    expect(decode({ ...contact, email: " maria@example.com " }).email).toBe(
      "maria@example.com"
    );
  });
});

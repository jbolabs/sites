import { Option, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { ApplicationForm, toContactForm } from "./application.ts";
import { escapeHtml, renderLeadEmail } from "./lead-email.ts";

const mail = {
  alert: Option.none(),
  from: Option.none(),
  inbox: Option.none(),
  name: "EquityFast",
  siteOrigin: "https://equityfast.homes",
};

// A made-up applicant, with every field E Mortgage Capital's Flow notice carries.
const lead = {
  answers: [
    { answer: "03/14/1985", question: "Date of birth" },
    { answer: "$75,000", question: "Amount seeking" },
    {
      answer: "3750 S Susan Street, Santa Ana, CA 92704",
      question: "Property address",
    },
    { answer: "Primary residence", question: "Occupancy" },
    { answer: "Joint owner", question: "Ownership" },
    { answer: "Same as property", question: "Primary residence" },
    { answer: "$140,000", question: "Pre-tax annual income" },
    { answer: "$12,000", question: "Other income" },
    { answer: "Other", question: "Income source" },
    { answer: "No", question: "Listed for sale" },
    { answer: "$250,000", question: "Mortgage balance" },
    { answer: "Yes (calls, texts, and email)", question: "Contact consent" },
    { answer: "English", question: "Language" },
  ],
  email: "jordan@example.com",
  message: "HELOC application for $75,000.",
  name: "Jordan <b>Reyes</b>",
  phone: "(714) 555-0123",
  sourcePath: "/apply",
};

describe(renderLeadEmail, () => {
  it("names the applicant and amount in the subject", () => {
    const notice = renderLeadEmail(lead, mail);
    expect(notice.subject).toBe(
      "New EquityFast application: Jordan <b>Reyes</b> ($75,000)"
    );
  });

  it("carries every field of E Mortgage Capital's own lead notice", () => {
    const notice = renderLeadEmail(lead, mail);
    for (const value of [
      "(714) 555-0123",
      "jordan@example.com",
      "03/14/1985",
      "3750 S Susan Street, Santa Ana, CA 92704",
      "$75,000 requested",
      "Primary residence",
      "Joint owner",
      "$140,000",
      "$12,000",
      "Income source",
      "Listed for sale",
      "$250,000",
      "Yes (calls, texts, and email)",
    ]) {
      expect(notice.html).toContain(value);
    }
    expect(notice.html).toContain('href="tel:+17145550123"');
  });

  it("escapes what the visitor typed", () => {
    const notice = renderLeadEmail(lead, mail);
    expect(notice.html).toContain("Jordan &lt;b&gt;Reyes&lt;/b&gt;");
    expect(notice.html).not.toContain("<b>Reyes</b>");
    expect(escapeHtml(`"Tom" & 'Jerry'`)).toBe(
      "&quot;Tom&quot; &amp; &#39;Jerry&#39;"
    );
  });

  it("keeps the plain-text summary as the fallback", () => {
    const notice = renderLeadEmail(lead, mail);
    expect(notice.text).toContain("Date of birth: 03/14/1985");
  });

  it("shows the plain-text part in the same sections", () => {
    const notice = renderLeadEmail(lead, mail);
    expect(notice.text)
      .toBe(`New HELOC application: Jordan <b>Reyes</b> ($75,000)

Contact
Name: Jordan <b>Reyes</b>
Phone: (714) 555-0123
Email: jordan@example.com
Date of birth: 03/14/1985

Property for this line of credit
Amount seeking: $75,000
Address: 3750 S Susan Street, Santa Ana, CA 92704
Occupancy: Primary residence
Ownership: Joint owner
Listed for sale: No
Mortgage balance: $250,000

Income
Pre-tax annual income: $140,000
Other income: $12,000
Income source: Other

Consent and source
Contact consent: Yes (calls, texts, and email)
Language: English
Submitted from: https://equityfast.homes/apply

Reply to this email to reach Jordan directly.`);
  });
});

const decode = Schema.decodeUnknownSync(ApplicationForm);

const application = {
  amount: "$90,000",
  birthDate: "07/04/1980",
  consent: true,
  email: "sam@example.com",
  firstName: "Sam",
  forSale: "No",
  income: "$210,000",
  incomeSource: "Self-employed",
  lastName: "Ortiz",
  locale: "en",
  otherIncome: "$0",
  phone: "(949) 555-0188",
  primaryAddress: {
    city: "Irvine",
    state: "CA",
    street: "1 Main St",
    zip: "92618",
  },
  propertyAddress: {
    city: "Newport Beach",
    state: "CA",
    street: "88 Harbor Way",
    zip: "92660",
  },
  turnstileToken: "token",
};

const count = (haystack: string, needle: string) =>
  haystack.split(needle).length - 1;

const OCCUPANCIES = [
  "Primary residence",
  "Secondary home",
  "Investment property",
] as const;
const OWNERSHIPS = ["Sole owner", "Joint owner", "LLC", "Trust"] as const;
const COMBINATIONS = OCCUPANCIES.flatMap((occupancy) =>
  OWNERSHIPS.map((ownership) => ({ occupancy, ownership }))
);

describe("each occupancy and ownership", () => {
  it.each(COMBINATIONS)(
    "lists every answer once for a $occupancy held as $ownership",
    ({ occupancy, ownership }) => {
      const notice = renderLeadEmail(
        {
          ...toContactForm(decode({ ...application, occupancy, ownership })),
          sourcePath: "/apply",
        },
        mail
      );
      const html = notice.html ?? "";
      const livesElsewhere = occupancy !== "Primary residence";
      const rows = [
        ["Date of birth", "07/04/1980"],
        ["Amount seeking", "$90,000"],
        ["Address", "88 Harbor Way, Newport Beach, CA 92660"],
        ["Occupancy", occupancy],
        ["Ownership", ownership],
        ["Listed for sale", "No"],
        ["Mortgage balance", "Not given"],
        ["Pre-tax annual income", "$210,000"],
        ["Other income", "$0"],
        ["Income source", "Self-employed"],
        ["Contact consent", "Yes (calls, texts, and email)"],
        ["Language", "English"],
        ...(livesElsewhere ? [["Address", "1 Main St, Irvine, CA 92618"]] : []),
      ] as const;
      const once = rows.map(() => 1);
      expect(
        rows.map(([label, value]) => count(notice.text, `${label}: ${value}`))
      ).toStrictEqual(once);
      expect(
        rows.map(([, value]) => count(html, `>${value}</td>`))
      ).toStrictEqual(once);
      expect(count(html, "Primary residence (where they live)")).toBe(
        livesElsewhere ? 1 : 0
      );
      expect(count(notice.text, "Same as property")).toBe(0);
      expect(notice.text.split("\n")).toHaveLength(livesElsewhere ? 30 : 27);
    }
  );
});

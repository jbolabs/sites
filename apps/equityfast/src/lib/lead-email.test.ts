import { Option } from "effect";
import { describe, expect, it } from "vitest";

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
      "Same as property",
      "$140,000",
      "$12,000",
      "Income source",
      "Listed for sale",
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
});

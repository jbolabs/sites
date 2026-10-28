import { describe, expect, it } from "vitest";

import { renderLeadNotice } from "./lead-notice.ts";

describe(renderLeadNotice, () => {
  it("names the topic in the subject and the body", () => {
    expect(
      renderLeadNotice({
        company: "Prayer request",
        email: "ana@example.com",
        message: "Please pray for my mother's surgery on Friday.",
        name: "Ana",
        sourcePath: "/contact",
      })
    ).toStrictEqual({
      subject: "Prayer request from Ana",
      text: "Name: Ana\nEmail: ana@example.com\nPhone: -\nTopic: Prayer request\nPage: /contact\n\nPlease pray for my mother's surgery on Friday.",
    });
  });

  it("falls back to a plain subject without a topic", () => {
    expect(
      renderLeadNotice({
        email: "sam@example.com",
        message: "What time is Sunday school?",
        name: "Sam",
        phone: "949-555-0100",
        sourcePath: "/visit",
      }).subject
    ).toBe("New message from Sam");
  });
});

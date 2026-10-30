import { describe, expect, it } from "@effect/vitest";
import { Email, LeadMail } from "@jakebodea/cloudflare-kit/server";
import type { EmailMessage } from "@jakebodea/cloudflare-kit/server";
import { ConfigProvider, Effect, Layer, Logger, Option, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";

import { ApplicationForm, toContactForm } from "./application.ts";
import type { AcceptLeadResponse } from "./flow-ag.ts";
import {
  FlowAg,
  FlowAgLive,
  forwardToFlowAg,
  toFlowAgLead,
} from "./flow-ag.ts";

const form = Schema.decodeUnknownSync(ApplicationForm)({
  amount: "$75,000",
  birthDate: "04/12/1981",
  consent: true,
  email: "jordan@example.com",
  firstName: "Jordan",
  forSale: "No",
  income: "$140,000",
  incomeSource: "Self-employed",
  lastName: "Reyes",
  locale: "es",
  middleName: "A.",
  mortgageBalance: "$250,000.60",
  occupancy: "Investment property",
  otherIncome: "0",
  ownership: "LLC",
  phone: "1 (714) 555-0123",
  primaryAddress: {
    city: "Irvine",
    state: "CA",
    street: "1 Main St",
    zip: "92618",
  },
  propertyAddress: {
    city: "Santa Ana",
    state: "ca",
    street: "3750 S Susan Street",
    zip: "92704",
  },
  propertyValue: "$700,000",
  turnstileToken: "token",
});

interface Sent {
  readonly url: string;
  readonly apiKey: string | undefined;
  readonly body: unknown;
}

/** Flow AG answering every call with `status` and `body`; records what it was sent. */
const flowAgReplying = (
  status: number,
  body: AcceptLeadResponse | string,
  apiKey: string,
  sent: Sent[] = []
) =>
  FlowAgLive.pipe(
    Layer.provide(
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request) => {
          if (request.body._tag === "Uint8Array") {
            sent.push({
              apiKey: request.headers["x-api-key"],
              body: JSON.parse(new TextDecoder().decode(request.body.body)),
              url: request.url,
            });
          }
          return Effect.succeed(
            HttpClientResponse.fromWeb(request, Response.json(body, { status }))
          );
        })
      )
    ),
    Layer.provide(
      ConfigProvider.layer(
        ConfigProvider.fromUnknown({ FLOW_AG_API_KEY: apiKey })
      )
    )
  );

/** Runs the hand-off against a Flow AG reply and returns what it logged. */
const forwardedLogs = (reply: AcceptLeadResponse) => {
  const logs: unknown[] = [];
  return forwardToFlowAg(form, toContactForm(form), {
    leadId: "entry-1",
    requestId: "ray-1",
    sourcePath: "/apply",
  }).pipe(
    Effect.as(logs),
    Effect.provide(flowAgReplying(200, reply, "test-key")),
    Effect.provide(
      Logger.layer([
        Logger.make((entry) => {
          logs.push(entry.message);
        }),
      ])
    ),
    Effect.provide(Layer.succeed(Email, { send: () => Effect.void })),
    Effect.provide(
      Layer.succeed(LeadMail, {
        alert: Option.none(),
        from: Option.none(),
        inbox: Option.none(),
        name: "EquityFast",
        siteOrigin: "https://equityfast.homes",
      })
    )
  );
};

describe(toFlowAgLead, () => {
  it("maps an application onto Flow AG's accept-lead fields", () => {
    expect(toFlowAgLead(form, "entry-1", "/es/solicitar")).toStrictEqual({
      address: "3750 S Susan Street",
      cashOut: 0,
      city: "Santa Ana",
      dob: "04/12/1981",
      email: "jordan@example.com",
      externalId: "entry-1",
      firstName: "Jordan",
      lastName: "Reyes",
      loanAmount: 75_000,
      loanPurpose: "heloc",
      mortgageBalance: 250_001,
      notes: [
        "HELOC application from the EquityFast website.",
        "Middle name: A.",
        "Date of birth: 04/12/1981",
        "Pre-tax annual income: $140,000",
        "Other annual income: $0",
        "Primary income source: Self-employed",
        "Occupancy: Investment property",
        "Primary residence: 1 Main St, Irvine, CA 92618",
        "Ownership: LLC",
        "Listed for sale: No",
        "Language: Spanish",
        "Contact consent: Yes (calls, texts, and email)",
        "Page: /es/solicitar",
      ].join("\n"),
      phone: "7145550123",
      propertyUse: "Investment",
      propertyValue: 700_000,
      state: "CA",
      zip: "92704",
    });
  });

  it("sends a blank mortgage balance as 0, which Flow AG accepts", () => {
    const blank = { ...form, mortgageBalance: "" };
    expect(toFlowAgLead(blank, "entry-1", "/apply").mortgageBalance).toBe(0);
  });
});

describe("Flow AG accept-lead", () => {
  it.effect("posts the lead with the key in the X-Api-Key header", () => {
    const sent: Sent[] = [];
    return Effect.gen(function* postsLead() {
      const flowAg = yield* FlowAg;
      const result = yield* flowAg.send(
        toFlowAgLead(form, "entry-1", "/apply")
      );
      expect(Option.getOrUndefined(result)).toMatchObject({
        assignedTo: { name: "Joe Mercuri" },
        leadId: "lead-9",
      });
      expect(sent[0]).toMatchObject({
        apiKey: "test-key",
        body: { externalId: "entry-1", loanPurpose: "heloc" },
        url: "https://flowag.emortgagecapital.com/api/v1/accept-lead",
      });
    }).pipe(
      Effect.provide(
        flowAgReplying(
          200,
          {
            assignedTo: { name: "Joe Mercuri" },
            leadId: "lead-9",
            success: true,
          },
          "test-key",
          sent
        )
      )
    );
  });

  it.effect("skips the call on a stage with no key", () =>
    Effect.gen(function* skipsWithoutKey() {
      const flowAg = yield* FlowAg;
      const result = yield* flowAg.send(
        toFlowAgLead(form, "entry-1", "/apply")
      );
      expect(Option.isNone(result)).toBeTruthy();
    }).pipe(Effect.provide(flowAgReplying(200, { success: true }, "")))
  );

  it.effect("fails with FlowAgNotSent when the key is refused", () =>
    Effect.gen(function* refusedKey() {
      const flowAg = yield* FlowAg;
      const error = yield* flowAg
        .send(toFlowAgLead(form, "entry-1", "/apply"))
        .pipe(Effect.flip);
      expect(error._tag).toBe("FlowAgNotSent");
    }).pipe(Effect.provide(flowAgReplying(401, "Invalid key", "wrong-key")))
  );
});

describe(forwardToFlowAg, () => {
  it.effect(
    "emails the alert inbox when Flow AG does not take the lead",
    () => {
      const emails: EmailMessage[] = [];
      return Effect.gen(function* alertsOnMiss() {
        yield* forwardToFlowAg(form, toContactForm(form), {
          leadId: "entry-1",
          requestId: "ray-1",
          sourcePath: "/apply",
        });
        expect(
          emails.map(({ subject, to }) => ({ subject, to }))
        ).toStrictEqual([
          {
            subject: "Lead not sent to Flow AG: EquityFast [ray-1]",
            to: "alerts@jbolabs.com",
          },
        ]);
        expect(emails[0]?.text).toContain("CMS entry: entry-1");
      }).pipe(
        Effect.provide(flowAgReplying(400, "No usable contact", "test-key")),
        Effect.provide(
          Layer.succeed(Email, {
            send: (message) =>
              Effect.sync(() => {
                emails.push(message);
              }),
          })
        ),
        Effect.provide(
          Layer.succeed(LeadMail, {
            alert: Option.some("alerts@jbolabs.com"),
            from: Option.some({
              email: "sites@mail.jbolabs.com",
              name: "EquityFast",
            }),
            inbox: Option.none(),
            name: "EquityFast",
            siteOrigin: "https://equityfast.homes",
          })
        )
      );
    }
  );

  it.effect("logs who Flow AG assigned an accepted lead to", () =>
    Effect.gen(function* logsAccepted() {
      const logs = yield* forwardedLogs({
        assignedTo: { name: "Joe Mercuri" },
        leadId: "lead-9",
        success: true,
        url: "https://flowag.emortgagecapital.com/leads/lead-9",
      });
      expect(logs).toStrictEqual([
        [
          "lead forwarded to Flow AG",
          {
            assignedTo: "Joe Mercuri",
            cmsEntry: "entry-1",
            duplicate: false,
            flowAgLeadId: "lead-9",
            flowAgMessage: "",
            flowAgUrl: "https://flowag.emortgagecapital.com/leads/lead-9",
            requestId: "ray-1",
          },
        ],
      ]);
    })
  );

  it.effect("logs a duplicate as a note on the existing lead", () =>
    Effect.gen(function* logsDuplicate() {
      const logs = yield* forwardedLogs({
        duplicate: true,
        leadId: "lead-3",
        message: "Lead already exists; it has been noted on the existing lead.",
        success: true,
      });
      expect(logs).toStrictEqual([
        [
          "lead noted on an existing Flow AG lead",
          {
            assignedTo: "not reported",
            cmsEntry: "entry-1",
            duplicate: true,
            flowAgLeadId: "lead-3",
            flowAgMessage:
              "Lead already exists; it has been noted on the existing lead.",
            flowAgUrl: "",
            requestId: "ray-1",
          },
        ],
      ]);
    })
  );
});

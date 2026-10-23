/**
 * Forwards applications to E Mortgage Capital's CRM, Flow AG, through its
 * Universal Lead API (`POST /api/v1/accept-lead`). This runs after the lead
 * is saved in the CMS, so a Flow AG outage never loses an application: the
 * failure is logged and emailed to the studio alert inbox, and the visitor
 * still sees success.
 *
 * API docs (fields, aliases, errors, dry runs):
 * https://flowag.emortgagecapital.com/api-docs
 *
 * The key travels in the `X-Api-Key` header, which the docs prefer over the
 * `?key=` query parameter because query strings land in access logs. It is
 * set on prod only (`FLOW_AG_API_KEY`, Infisical `sites-prod`); every other
 * stage has no key and skips the call, so test applications never reach the
 * client's CRM.
 */
import {
  Email,
  LeadMail,
  leadNotificationText,
} from "@jakebodea/cloudflare-kit/server";
import type { ContactForm } from "@jakebodea/cloudflare-kit/server";
import {
  Config,
  Context,
  Effect,
  Layer,
  Option,
  Redacted,
  Schema,
} from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

import { digits, dollars, formatAddress } from "./application-rules.ts";
import type { Occupancy } from "./application-rules.ts";
import type { ApplicationForm } from "./application.ts";

export const FLOW_AG_ACCEPT_LEAD_URL =
  "https://flowag.emortgagecapital.com/api/v1/accept-lead";

/** Flow AG answers in well under a second; past this the lead is alerted instead. */
const TIMEOUT = "10 seconds";

/** Flow AG's `propertyUse` values (default `Primary`). */
const PROPERTY_USE: Record<Occupancy, "Primary" | "Secondary" | "Investment"> =
  {
    "Investment property": "Investment",
    "Primary residence": "Primary",
    "Secondary home": "Secondary",
  };

/**
 * The accept-lead JSON body. Names are Flow AG's canonical field names, not
 * aliases. Anything without a Flow AG field (ownership, listing status,
 * language, consent) goes in `notes`, which the loan team reads on the lead.
 */
export interface FlowAgLead {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  /** Ten digits, no formatting. */
  readonly phone: string;
  /** The property the HELOC is on. */
  readonly address: string;
  readonly city: string;
  /** Two-letter code, upper case. */
  readonly state: string;
  readonly zip: string;
  readonly loanPurpose: "heloc";
  /** Whole dollars. On a HELOC the requested draw goes here. */
  readonly loanAmount: number;
  /** Flow AG's docs: on a HELOC `cashOut` may be 0. */
  readonly cashOut: 0;
  readonly propertyUse: "Primary" | "Secondary" | "Investment";
  /** The CMS entry id, so a lead in Flow AG traces back to the site's copy. */
  readonly externalId: string;
  readonly notes: string;
}

/** Flow AG caps a lead-creation note at 4,000 characters (and truncates past it). */
const MAX_NOTES = 4000;

const NOTES_INTRO = "HELOC application from the EquityFast website.";

/** An application as the accept-lead body. `leadId` is the CMS entry id. */
export const toFlowAgLead = (
  form: ApplicationForm,
  leadId: string,
  sourcePath: string
): FlowAgLead => {
  const property = form.propertyAddress;
  const primary =
    form.occupancy === "Primary residence" || form.primaryAddress === undefined
      ? "Same as property"
      : formatAddress(
          form.primaryAddress.street,
          form.primaryAddress.city,
          form.primaryAddress.state,
          form.primaryAddress.zip
        );
  const notes = [
    NOTES_INTRO,
    ...(form.middleName === undefined || form.middleName === ""
      ? []
      : [`Middle name: ${form.middleName}`]),
    `Occupancy: ${form.occupancy}`,
    `Primary residence: ${primary}`,
    `Ownership: ${form.ownership}`,
    `Listed for sale: ${form.forSale}`,
    `Language: ${form.locale === "es" ? "Spanish" : "English"}`,
    "Contact consent: Yes (calls, texts, and email)",
    `Page: ${sourcePath}`,
  ]
    .join("\n")
    .slice(0, MAX_NOTES);
  return {
    address: property.street,
    cashOut: 0,
    city: property.city,
    email: form.email,
    externalId: leadId,
    firstName: form.firstName,
    lastName: form.lastName,
    loanAmount: dollars(form.amount),
    loanPurpose: "heloc",
    notes,
    phone: digits(form.phone).slice(-10),
    propertyUse: PROPERTY_USE[form.occupancy],
    state: property.state.toUpperCase(),
    zip: property.zip,
  };
};

/** Flow AG did not take the lead (no key problem is silent: every status is reported). */
export class FlowAgNotSent extends Schema.TaggedError<FlowAgNotSent>()(
  "FlowAgNotSent",
  { cause: Schema.Defect() }
) {}

/**
 * The parts of a 200 worth logging. A duplicate is a 200 with
 * `duplicate: true` (Flow AG adds a note to the lead it already holds), and
 * `assignedTo` is what shows a loan officer got it, not `success` alone.
 */
const AcceptLeadResponse = Schema.Struct({
  assignedTo: Schema.optional(
    Schema.NullOr(Schema.Struct({ name: Schema.optional(Schema.String) }))
  ),
  duplicate: Schema.optional(Schema.Boolean),
  leadId: Schema.optional(Schema.String),
  success: Schema.Boolean,
});
export type AcceptLeadResponse = typeof AcceptLeadResponse.Type;

export class FlowAg extends Context.Service<
  FlowAg,
  {
    /** `None` when this stage has no key (every stage but prod). */
    readonly send: (
      lead: FlowAgLead
    ) => Effect.Effect<Option.Option<AcceptLeadResponse>, FlowAgNotSent>;
  }
>()("@sites/equityfast/FlowAg") {}

/** Needs `FLOW_AG_API_KEY` (empty or missing skips the call) and an `HttpClient`. */
export const FlowAgLive = Layer.effect(
  FlowAg,
  Effect.gen(function* FlowAgLive() {
    const key = yield* Config.Redacted("FLOW_AG_API_KEY").pipe(
      Config.option,
      Config.map(Option.filter((value) => Redacted.value(value) !== ""))
    );
    // 429, 500 and 503 are worth another try (Flow AG's error table); 400 and 401 are not.
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.retryTransient({ retryOn: "errors-and-responses", times: 2 }),
      HttpClient.filterStatusOk
    );

    const send = Effect.fn("FlowAg.send")(function* send(lead: FlowAgLead) {
      if (Option.isNone(key)) {
        yield* Effect.logInfo("Flow AG forwarding is not configured here");
        return Option.none();
      }
      const request = HttpClientRequest.post(FLOW_AG_ACCEPT_LEAD_URL).pipe(
        HttpClientRequest.setHeader("X-Api-Key", Redacted.value(key.value)),
        HttpClientRequest.bodyJsonUnsafe(lead)
      );
      const response = yield* client.execute(request).pipe(
        Effect.flatMap((reply) => reply.json),
        Effect.flatMap(Schema.decodeUnknownEffect(AcceptLeadResponse)),
        Effect.timeout(TIMEOUT),
        Effect.mapError((cause) => new FlowAgNotSent({ cause }))
      );
      if (!response.success) {
        return yield* new FlowAgNotSent({
          cause: new Error("Flow AG answered success: false"),
        });
      }
      yield* Effect.annotateCurrentSpan({
        "flowag.assigned": response.assignedTo?.name !== undefined,
        "flowag.duplicate": response.duplicate === true,
        "flowag.lead.id": response.leadId ?? "",
      });
      return Option.some(response);
    });

    return { send };
  })
);

/** Request facts the Flow AG hand-off needs: the CMS entry and where it came from. */
export interface SavedApplication {
  readonly leadId: string;
  readonly requestId: string;
  readonly sourcePath: string;
}

/** Logs a lead Flow AG did not take and emails it to the studio alert inbox. */
const reportFlowAgMiss = Effect.fn("reportFlowAgMiss")(
  function* reportFlowAgMiss(
    contact: ContactForm,
    saved: SavedApplication,
    error: FlowAgNotSent
  ) {
    const mail = yield* LeadMail;
    const email = yield* Email;
    const lead = leadNotificationText({
      answers: contact.answers,
      email: contact.email,
      message: contact.message,
      name: contact.name,
      phone: contact.phone,
      sourcePath: saved.sourcePath,
    });
    yield* Effect.logError("lead not forwarded to Flow AG").pipe(
      Effect.annotateLogs({
        error: String(error.cause),
        lead,
        leadId: saved.leadId,
        requestId: saved.requestId,
      })
    );
    const routes = Option.all({ from: mail.from, to: mail.alert });
    if (Option.isNone(routes)) {
      return;
    }
    yield* email
      .send({
        from: routes.value.from,
        replyTo: contact.email,
        subject: `Lead not sent to Flow AG: ${mail.name} [${saved.requestId}]`,
        text: [
          `Site: ${mail.siteOrigin}`,
          `Request: ${saved.requestId}`,
          `CMS entry: ${saved.leadId}`,
          "The application is saved in the CMS but Flow AG did not take it. Enter it in Flow AG by hand.",
          "",
          lead,
        ].join("\n"),
        to: routes.value.to,
      })
      .pipe(
        Effect.catchCause(() =>
          Effect.logError("Flow AG miss alert email failed")
        )
      );
  }
);

/**
 * Sends a saved application to Flow AG. Never fails: the lead is already in
 * the CMS, so a miss is logged and emailed to the studio alert inbox for
 * someone to enter by hand.
 */
export const forwardToFlowAg = Effect.fn("forwardToFlowAg")(
  function* forwardToFlowAg(
    form: ApplicationForm,
    contact: ContactForm,
    saved: SavedApplication
  ) {
    const flowAg = yield* FlowAg;
    yield* flowAg
      .send(toFlowAgLead(form, saved.leadId, saved.sourcePath))
      .pipe(
        Effect.catchTag("FlowAgNotSent", (error) =>
          reportFlowAgMiss(contact, saved, error).pipe(Effect.as(Option.none()))
        )
      );
  }
);

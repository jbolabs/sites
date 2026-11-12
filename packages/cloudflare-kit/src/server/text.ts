/**
 * Outbound text messages (SMS) behind one interface, sent through Twilio's
 * Messages API with an API key. Without every Twilio value configured, the
 * logging implementation records that a text would have gone out, so stages
 * without credentials (local, previews, staging) never text anyone.
 */
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

export interface TextMessage {
  /** E.164, like `+19495550123`. */
  readonly to: string;
  readonly body: string;
}

export class TextFailed extends Schema.TaggedError<TextFailed>()("TextFailed", {
  cause: Schema.Defect(),
}) {}

export class Texts extends Context.Service<
  Texts,
  { readonly send: (message: TextMessage) => Effect.Effect<void, TextFailed> }
>()("@jakebodea/cloudflare-kit/Texts") {}

export interface TwilioCredentials {
  readonly accountSid: string;
  readonly apiKeySid: string;
  readonly apiKeySecret: Redacted.Redacted;
  /** The site's own Twilio number, E.164. */
  readonly from: string;
}

/** Twilio's Messages endpoint for one account. */
export const twilioMessagesUrl = (accountSid: string): string =>
  `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;

/** Sends through Twilio; a non-2xx answer (unverified number, bad key) is a `TextFailed`. */
export const textsTwilio = (credentials: TwilioCredentials) =>
  Layer.effect(
    Texts,
    Effect.gen(function* buildTextsTwilio() {
      const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient);
      const send = Effect.fn("Texts.send")(function* send(
        message: TextMessage
      ) {
        const request = HttpClientRequest.post(
          twilioMessagesUrl(credentials.accountSid)
        ).pipe(
          HttpClientRequest.basicAuth(
            credentials.apiKeySid,
            credentials.apiKeySecret
          ),
          HttpClientRequest.bodyUrlParams({
            Body: message.body,
            From: credentials.from,
            To: message.to,
          })
        );
        yield* client
          .execute(request)
          .pipe(Effect.mapError((cause) => new TextFailed({ cause })));
      });
      return { send };
    })
  );

/** Logs instead of sending; the default wherever Twilio is not configured. */
export const TextsLog = Layer.succeed(Texts, {
  // Never log bodies or numbers: texts name clients.
  send: () => Effect.logInfo("text not sent: Twilio is not configured"),
});

const nonEmpty = (name: string) =>
  Config.String(name).pipe(
    Config.option,
    Config.map(Option.filter((value) => value !== ""))
  );

/**
 * Twilio when `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`,
 * `TWILIO_API_KEY_SECRET` and `TEXT_FROM` are all set (see `textMessages` in
 * the infra helpers); otherwise `TextsLog`.
 */
export const textsFromConfig = Layer.unwrap(
  Effect.gen(function* chooseTexts() {
    const accountSid = yield* nonEmpty("TWILIO_ACCOUNT_SID");
    const apiKeySid = yield* nonEmpty("TWILIO_API_KEY_SID");
    const apiKeySecret = yield* nonEmpty("TWILIO_API_KEY_SECRET");
    const from = yield* nonEmpty("TEXT_FROM");
    if (
      Option.isNone(accountSid) ||
      Option.isNone(apiKeySid) ||
      Option.isNone(apiKeySecret) ||
      Option.isNone(from)
    ) {
      return TextsLog;
    }
    return textsTwilio({
      accountSid: accountSid.value,
      apiKeySecret: Redacted.make(apiKeySecret.value),
      apiKeySid: apiKeySid.value,
      from: from.value,
    });
  })
);

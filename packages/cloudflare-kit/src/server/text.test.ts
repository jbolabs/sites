import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Exit, Layer, Redacted } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";

import {
  Texts,
  textsFromConfig,
  textsTwilio,
  twilioMessagesUrl,
} from "./text.ts";

interface SentRequest {
  readonly url: string;
  readonly authorization: string | undefined;
  readonly body: string;
}

/** An HttpClient that answers every request with `status` and records what it was sent. */
const twilioReplying = (status: number, sent: SentRequest[]) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) => {
      sent.push({
        authorization: request.headers.authorization,
        body:
          request.body._tag === "Uint8Array"
            ? new TextDecoder().decode(request.body.body)
            : "",
        url: request.url,
      });
      return Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          Response.json({ sid: "SM1" }, { status })
        )
      );
    })
  );

const CREDENTIALS = {
  accountSid: "AC123",
  apiKeySecret: Redacted.make("key-secret"),
  apiKeySid: "SK456",
  from: "+18885550100",
};

const textPat = Effect.gen(function* textPat() {
  const texts = yield* Texts;
  yield* texts.send({ body: "New booking: Pat", to: "+19495550142" });
});

describe(twilioMessagesUrl, () => {
  it("addresses the account's Messages endpoint", () => {
    expect(twilioMessagesUrl("AC123")).toBe(
      "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json"
    );
  });
});

describe("Twilio texts", () => {
  it.effect("posts the message to Twilio with the API key", () =>
    Effect.gen(function* postsToTwilio() {
      const sent: SentRequest[] = [];
      yield* textPat.pipe(
        Effect.provide(
          textsTwilio(CREDENTIALS).pipe(
            Layer.provide(twilioReplying(201, sent))
          )
        )
      );

      expect(sent).toStrictEqual([
        {
          // "SK456:key-secret", base64
          authorization: "Basic U0s0NTY6a2V5LXNlY3JldA==",
          body: "Body=New+booking%3A+Pat&From=%2B18885550100&To=%2B19495550142",
          url: "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json",
        },
      ]);
    })
  );

  it.effect("fails when Twilio refuses the message", () =>
    Effect.gen(function* refused() {
      const exit = yield* textPat.pipe(
        Effect.provide(
          textsTwilio(CREDENTIALS).pipe(Layer.provide(twilioReplying(400, [])))
        ),
        Effect.exit
      );

      expect(Exit.isFailure(exit) && exit.cause.toString()).toContain(
        "TextFailed"
      );
    })
  );

  it.effect("sends nothing until every Twilio value is configured", () =>
    Effect.gen(function* logsWithoutConfig() {
      const sent: SentRequest[] = [];
      const exit = yield* textPat.pipe(
        Effect.provide(
          textsFromConfig.pipe(
            Layer.provide(twilioReplying(201, sent)),
            Layer.provide(
              ConfigProvider.layer(
                ConfigProvider.fromUnknown({
                  TEXT_FROM: "",
                  TWILIO_ACCOUNT_SID: "AC123",
                  TWILIO_API_KEY_SECRET: "key-secret",
                  TWILIO_API_KEY_SID: "SK456",
                })
              )
            )
          )
        ),
        Effect.exit
      );

      expect(Exit.isSuccess(exit)).toBeTruthy();
      expect(sent).toHaveLength(0);
    })
  );
});

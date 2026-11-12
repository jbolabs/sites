import { AlchemyContext } from "alchemy/AlchemyContext";
import { Config, Effect, Option, Redacted } from "effect";

import type { TextEnv } from "../env.ts";
import type { StageSettings } from "./stage.ts";

const EMPTY = {
  TEXT_FROM: "",
  TEXT_NOTIFY_TO: "",
  TWILIO_ACCOUNT_SID: "",
  TWILIO_API_KEY_SECRET: "",
  TWILIO_API_KEY_SID: "",
} satisfies Record<keyof TextEnv, string>;

const optional = (name: string) =>
  Config.Redacted(name).pipe(
    Config.option,
    Config.map(Option.filter((value) => Redacted.value(value) !== ""))
  );

/**
 * Twilio bindings for texts, on prod only, so staging and preview bookings
 * never text the client. The account's key is shared by every site
 * (`TWILIO_*`); the sending number and the client's cell are per site
 * (`<PREFIX>_TEXT_FROM`, `<PREFIX>_TEXT_TO`). Until all five are in Infisical,
 * every binding is empty and the Worker logs texts instead of sending them,
 * so a merge never waits on the Twilio setup.
 */
export const textMessages = (
  stage: StageSettings,
  options: { readonly secretPrefix: string }
) =>
  Effect.gen(function* createTextMessages() {
    const { dev } = yield* AlchemyContext;
    if (!stage.production || dev) {
      return EMPTY;
    }
    const values = yield* Config.all({
      TEXT_FROM: optional(`${options.secretPrefix}_TEXT_FROM`),
      TEXT_NOTIFY_TO: optional(`${options.secretPrefix}_TEXT_TO`),
      TWILIO_ACCOUNT_SID: optional("TWILIO_ACCOUNT_SID"),
      TWILIO_API_KEY_SECRET: optional("TWILIO_API_KEY_SECRET"),
      TWILIO_API_KEY_SID: optional("TWILIO_API_KEY_SID"),
    });
    const configured = Option.all(values);
    if (Option.isNone(configured)) {
      const missing = Object.entries(values).flatMap(([name, value]) =>
        Option.isNone(value) ? [name] : []
      );
      yield* Effect.logWarning(
        "Twilio not fully configured; texts will be logged, not sent"
      ).pipe(Effect.annotateLogs({ missing: missing.join(",") }));
      return EMPTY;
    }
    const secret = configured.value;
    return {
      // Numbers and ids are not secrets; the key's secret stays redacted.
      TEXT_FROM: Redacted.value(secret.TEXT_FROM),
      TEXT_NOTIFY_TO: secret.TEXT_NOTIFY_TO,
      TWILIO_ACCOUNT_SID: Redacted.value(secret.TWILIO_ACCOUNT_SID),
      TWILIO_API_KEY_SECRET: secret.TWILIO_API_KEY_SECRET,
      TWILIO_API_KEY_SID: Redacted.value(secret.TWILIO_API_KEY_SID),
    } satisfies Record<keyof TextEnv, string | Redacted.Redacted>;
  });

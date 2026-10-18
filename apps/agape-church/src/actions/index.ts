import { runRequest, submitContact } from "@jakebodea/cloudflare-kit/server";
import { ActionError, defineAction } from "astro:actions";
import { Cause, Effect, Exit, Option, Schema } from "effect";

import { ChurchForm, toContactForm } from "@/lib/forms";
import { contactLayer, waitUntil } from "@/lib/server";

const header = (request: Request, name: string) =>
  request.headers.get(name) ?? undefined;

const MESSAGES = {
  en: {
    failed:
      "We could not send your message. Please try again in a few minutes.",
    invalid: "Please check the highlighted fields.",
    verify: "Please complete the verification and try again.",
  },
  ro: {
    failed:
      "Nu am putut trimite mesajul. Vă rugăm să încercați din nou peste câteva minute.",
    invalid: "Vă rugăm să verificați câmpurile marcate.",
    verify: "Vă rugăm să completați verificarea și să încercați din nou.",
  },
} as const;

/** The visitor's language, read before full validation so even a rejected form answers in it. */
const decodeLocale = Schema.decodeUnknownOption(
  Schema.Struct({ locale: Schema.Literals(["en", "ro"]) })
);

export const server = {
  /**
   * The contact form and the prayer request form. Validation lives in
   * `ChurchForm` (Effect Schema); the lead then goes through the shared
   * contact pipeline (Turnstile, the CMS Messages collection, email).
   */
  contact: defineAction({
    accept: "json",
    // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Astro hands over the raw JSON body; it is decoded with Effect Schema on the next line.
    handler: async (input: unknown, context) => {
      const { request } = context;
      const locale = Option.match(decodeLocale(input), {
        onNone: () => "en" as const,
        onSome: (value) => value.locale,
      });
      const messages = MESSAGES[locale];
      const program = Schema.decodeUnknownEffect(ChurchForm)(input).pipe(
        Effect.flatMap((form) =>
          submitContact(toContactForm(form), {
            remoteIp: header(request, "cf-connecting-ip"),
            requestId: header(request, "cf-ray") ?? crypto.randomUUID(),
            sourcePath: new URL(request.headers.get("referer") ?? context.url)
              .pathname,
          })
        ),
        Effect.withSpan("action.contact")
      );
      const exit = await runRequest(program, contactLayer(), waitUntil);
      if (Exit.isSuccess(exit)) {
        return { ok: true as const };
      }
      const error = Cause.findErrorOption(exit.cause);
      if (error._tag === "Some" && error.value._tag === "SchemaError") {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: messages.invalid,
        });
      }
      if (error._tag === "Some" && error.value._tag === "TurnstileRejected") {
        throw new ActionError({ code: "FORBIDDEN", message: messages.verify });
      }
      throw new ActionError({
        code: "INTERNAL_SERVER_ERROR",
        message: messages.failed,
      });
    },
  }),
};

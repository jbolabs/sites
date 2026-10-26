/**
 * Request-scoped Effect wiring for server code (Astro actions). Every service
 * reads its configuration from the Worker env through one ConfigProvider, so
 * secrets resolve once, at layer construction, as `Redacted` values.
 */
import {
  LeadMailFromConfig,
  LeadNotice,
  TurnstileLive,
  WaitUntil,
  emailFromEnv,
} from "@jakebodea/cloudflare-kit/server";
import { env, waitUntil } from "cloudflare:workers";
import { ConfigProvider, Layer } from "effect";
import { FetchHttpClient } from "effect/http";

import { renderLeadEmail } from "./lead-email.ts";
import { LeadStoreEmDash } from "./leads.ts";

export { waitUntil } from "cloudflare:workers";

const configLayer = () => ConfigProvider.layer(ConfigProvider.fromUnknown(env));

/** Every service the contact pipeline needs, for one request. */
export const contactLayer = () =>
  Layer.mergeAll(
    TurnstileLive,
    LeadStoreEmDash,
    emailFromEnv(env.EMAIL),
    LeadMailFromConfig
  ).pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(Layer.succeed(WaitUntil, waitUntil)),
    Layer.provide(configLayer()),
    // The designed lead email (lead-email.ts) instead of the kit's plain one.
    Layer.merge(Layer.succeed(LeadNotice, { render: renderLeadEmail }))
  );

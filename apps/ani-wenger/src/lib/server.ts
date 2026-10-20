/**
 * Request-scoped Effect wiring for server code (Astro actions, routes, the
 * cron, the admin plugin). Every service reads its configuration from the
 * Worker env through one ConfigProvider, so secrets resolve once, at layer
 * construction, as `Redacted` values.
 */
import {
  LeadMailFromConfig,
  TurnstileLive,
  WaitUntil,
  emailFromEnv,
} from "@jakebodea/cloudflare-kit/server";
import { env, waitUntil } from "cloudflare:workers";
import { ConfigProvider, Layer } from "effect";
import { FetchHttpClient } from "effect/http";

import { site } from "../../site.config.ts";
import { AppointmentsEmDash, catalogEmDash } from "./booking/emdash-store.ts";
import { bookingLockD1 } from "./booking/lock.ts";
import { bookingMailFromConfig } from "./booking/services.ts";
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
    Layer.provide(configLayer())
  );

/** The appointment book, menu, mail, and lock, without visitor verification (cron, admin). */
export const scheduleLayer = () =>
  Layer.mergeAll(
    AppointmentsEmDash,
    catalogEmDash(site.timeZone),
    bookingLockD1(env.DB),
    emailFromEnv(env.EMAIL),
    bookingMailFromConfig({ replyTo: site.business.email, siteName: site.name })
  ).pipe(Layer.provide(configLayer()));

/** Everything a public booking request needs, Turnstile included. */
export const bookingLayer = () =>
  Layer.mergeAll(scheduleLayer(), TurnstileLive).pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(configLayer())
  );

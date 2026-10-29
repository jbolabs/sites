import * as Cloudflare from "@alchemy.run/cloudflare";
import { AlchemyContext } from "alchemy/AlchemyContext";
import { Effect } from "effect";

import type { GoogleTagManagerEnv } from "../env.ts";
import { assertContainerId } from "../google-tag-manager.ts";
import type { StageSettings } from "./stage.ts";

/**
 * An agency's Tag Manager container, live on prod only. With a production
 * domain, Cloudflare's Google tag gateway also serves the container
 * first-party from that zone (at `endpoint`), so ad blockers that drop
 * googletagmanager.com don't drop the client's conversions. The gateway is a
 * zone setting: destroying this restores the zone's earlier config.
 */
export const googleTagManager = (
  stage: StageSettings,
  container: {
    readonly id: string;
    /** An unused top-level path on the site for the gateway, e.g. `/metrics`. */
    readonly endpoint: string;
  }
) =>
  Effect.gen(function* createGoogleTagManager() {
    const containerId = assertContainerId(container.id);
    const { dev } = yield* AlchemyContext;
    if (!stage.production || dev) {
      return {
        GTM_CONTAINER_ID: "",
      } satisfies Record<keyof GoogleTagManagerEnv, string>;
    }
    if (stage.domain !== undefined) {
      yield* Cloudflare.GoogleTagGateway.GoogleTagGateway("GoogleTagGateway", {
        enabled: true,
        endpoint: container.endpoint,
        // Google keeps the visitor's IP, as when gtm.js loads from Google directly.
        hideOriginalIp: false,
        measurementId: containerId,
        // Cloudflare points the page's existing GTM snippet at the first-party path.
        setUpTag: true,
        zone: stage.domain,
      });
    }
    return {
      GTM_CONTAINER_ID: containerId,
    } satisfies Record<keyof GoogleTagManagerEnv, string>;
  });

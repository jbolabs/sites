/**
 * The three AI Gateways every site's CMS assistant shares: one each for
 * previews, staging and prod (`ASSISTANT_GATEWAYS` in the kit's `assistantAi`).
 * Sites only name their tier's gateway, so destroying a site's stage never
 * deletes one; the gateways are retained even if this stack is destroyed.
 *
 *   ALCHEMY_PROFILE=admin bun alchemy deploy stacks/assistant-gateways.ts --stage shared
 *
 * Deploy this before any site deploys code that points at these gateways.
 */
import {
  ASSISTANT_GATEWAYS,
  ASSISTANT_RATE_LIMIT,
} from "@jakebodea/cloudflare-kit/infra";
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as RemovalPolicy from "alchemy/RemovalPolicy";
import { Effect, Layer } from "effect";

const sharedOnly = Layer.unwrap(
  Alchemy.Stage.pipe(
    Effect.flatMap((stage) =>
      stage === "shared"
        ? Effect.succeed(Cloudflare.state())
        : Effect.die(
            new Error(
              `stacks/assistant-gateways.ts only deploys --stage shared (got ${stage})`
            )
          )
    )
  )
);

const gateway = (logicalId: string, id: string) =>
  Cloudflare.AI.Gateway(logicalId, {
    // Cloudflare rejects new gateways without it (7001). The Worker's AI binding is
    // pre-authenticated, so the assistant needs no token.
    authentication: true,
    collectLogs: true,
    id,
    rateLimitingInterval: ASSISTANT_RATE_LIMIT.interval,
    rateLimitingLimit: ASSISTANT_RATE_LIMIT.limit,
    rateLimitingTechnique: "sliding",
  }).pipe(RemovalPolicy.retain());

export default Alchemy.Stack(
  "assistant-gateways",
  { providers: Cloudflare.providers(), state: sharedOnly },
  Effect.gen(function* assistantGateways() {
    const preview = yield* gateway("Preview", ASSISTANT_GATEWAYS.preview);
    const staging = yield* gateway("Staging", ASSISTANT_GATEWAYS.staging);
    const prod = yield* gateway("Prod", ASSISTANT_GATEWAYS.prod);
    return {
      preview: preview.gatewayId,
      prod: prod.gatewayId,
      staging: staging.gatewayId,
    };
  })
);

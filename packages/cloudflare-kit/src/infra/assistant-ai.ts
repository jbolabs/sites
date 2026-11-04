import { AlchemyContext } from "alchemy/AlchemyContext";
import { Effect } from "effect";

import type { StageKind, StageSettings } from "./stage.ts";

/**
 * Every site shares one AI Gateway per tier instead of creating its own: the
 * account allows only a few gateways, and each site's every stage used one.
 * `stacks/assistant-gateways.ts` owns them, so destroying a site's stage never
 * removes a gateway other sites use. Requests carry the site and stage as
 * gateway metadata, so logs and costs still split per site.
 */
export type AssistantGatewayTier = "preview" | "staging" | "prod";

export const ASSISTANT_GATEWAYS: Readonly<
  Record<AssistantGatewayTier, string>
> = {
  preview: "sites-assistant-preview",
  prod: "sites-assistant-prod",
  staging: "sites-assistant-staging",
};

/**
 * A full assistant turn is up to 12 model calls (one per tool round), so this
 * allows about 30 full turns per ten minutes across every site on a tier, while
 * a stuck loop or a runaway script still stops well short of draining the
 * account's daily Workers AI allowance.
 */
export const ASSISTANT_RATE_LIMIT = { interval: 600, limit: 360 } as const;

/** `prod` and `staging` get their own gateway; every other deployed stage is a preview. */
export const assistantGatewayTier = (kind: StageKind): AssistantGatewayTier => {
  if (kind === "production") {
    return "prod";
  }
  return kind === "staging" ? "staging" : "preview";
};

/**
 * The CMS assistant's model (`site-admin` plugin): Workers AI routed through the
 * stage's shared AI Gateway (rate limit and request logs). Local dev has no
 * Workers AI emulation, so `bindModel` is false unless `AI_REMOTE=1` (the real
 * model, no gateway); without the binding the assistant answers offline.
 *
 * The site adds `AI: Cloudflare.Workers.AI()` itself when `bindModel` is true, the
 * same way it adds `EMAIL`: an optional key spread into the bindings fails Alchemy's types.
 */
export const assistantAi = (stage: StageSettings) =>
  Effect.gen(function* createAssistantAi() {
    const { dev } = yield* AlchemyContext;
    if (dev) {
      return { bindModel: process.env.AI_REMOTE === "1", gatewayId: "" };
    }
    return {
      bindModel: true,
      gatewayId: ASSISTANT_GATEWAYS[assistantGatewayTier(stage.kind)],
    };
  });

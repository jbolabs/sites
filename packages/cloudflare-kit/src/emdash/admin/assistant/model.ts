/**
 * The model behind the assistant: Workers AI through TanStack's Cloudflare
 * adapter, on the `env.AI` binding and routed through the stage's shared AI
 * Gateway (rate limits, logs). Local dev has no Workers AI emulation, so without
 * `AI_REMOTE=1` it gets a scripted stand-in that still makes one real MCP call.
 */
import type { AnyTextAdapter } from "@tanstack/ai";
import { createCloudflareText } from "@tanstack/ai-cloudflare";
import { fakeText } from "@tanstack/ai/testing";
import { Schema } from "effect";

export const OFFLINE_NOTE =
  "The assistant is offline in local development, so this is a stand-in answer. Start the site with AI_REMOTE=1 to use the real model.";

/** `env.AI`; typed loosely so this module does not pin a workers-types version. */
export type WorkersAiBinding = Parameters<
  typeof createCloudflareText
>[1] extends infer Config
  ? Config extends { binding: infer Binding }
    ? Binding
    : never
  : never;

/** Which gateway a call goes through, and the metadata that names its site in the gateway's logs. */
export interface AssistantGateway {
  readonly id: string;
  readonly metadata: { readonly site: string; readonly stage: string };
}

/** The bindings that name the stage's gateway and this site; decode `env` with `decodeGatewayEnv`. */
export const GatewayEnv = Schema.Struct({
  AI_GATEWAY_ID: Schema.String,
  CMS_OWNER_SITE: Schema.String,
  STAGE: Schema.String,
});
export const decodeGatewayEnv = Schema.decodeUnknownOption(GatewayEnv);

/**
 * Every site on a stage shares one gateway (`assistantAi`), so each call says
 * which site and stage it came from. No gateway id (local dev with
 * `AI_REMOTE=1`) means no gateway.
 */
export const assistantGateway = (
  bindings: typeof GatewayEnv.Type
): AssistantGateway | undefined =>
  bindings.AI_GATEWAY_ID === ""
    ? undefined
    : {
        id: bindings.AI_GATEWAY_ID,
        metadata: { site: bindings.CMS_OWNER_SITE, stage: bindings.STAGE },
      };

export const workersAiAdapter = (options: {
  readonly binding: WorkersAiBinding;
  readonly model: string;
  readonly gateway: AssistantGateway | undefined;
}): AnyTextAdapter =>
  createCloudflareText(options.model, {
    binding: options.binding,
    ...(options.gateway !== undefined && {
      gateway: {
        id: options.gateway.id,
        metadata: { ...options.gateway.metadata },
      },
    }),
  });

/**
 * Local-dev stand-in: thinks, lists a few entries through the real MCP tools,
 * then answers, so the panel's reasoning and tool steps, the tool loop, and
 * EmDash's permission checks all run without a model.
 */
export const offlineAdapter = (collection: string): AnyTextAdapter => {
  const fake = fakeText({ model: "offline" });
  fake.setResponses([
    {
      thinking: `No model is connected, so I will check the connection instead: list a few "${collection}" entries through EmDash's MCP tools.`,
      toolCalls: [{ input: { collection, limit: 3 }, name: "content_list" }],
    },
    {
      text: `${OFFLINE_NOTE} It read the "${collection}" list through EmDash's MCP tools, so the connection works.`,
    },
  ]);
  return fake;
};

import { describe, expect, it } from "vitest";

import { ASSISTANT_GATEWAYS, assistantGatewayTier } from "./assistant-ai.ts";
import { resolveStage } from "./stage.ts";

const site = {
  domain: "example.com",
  id: "example",
  stagingBaseDomain: "studio.test",
  workersSubdomain: "acme",
};

const gatewayFor = (stage: string): string =>
  ASSISTANT_GATEWAYS[assistantGatewayTier(resolveStage(site, stage).kind)];

describe(assistantGatewayTier, () => {
  it("gives prod and staging their own shared gateway", () => {
    expect(gatewayFor("prod")).toBe("sites-assistant-prod");
    expect(gatewayFor("staging")).toBe("sites-assistant-staging");
  });

  it("puts every other deployed stage on the preview gateway", () => {
    expect(
      ["pr-12", "client-pr-109", "ae-preview", "dev-main"].map(gatewayFor)
    ).toStrictEqual([
      "sites-assistant-preview",
      "sites-assistant-preview",
      "sites-assistant-preview",
      "sites-assistant-preview",
    ]);
  });
});

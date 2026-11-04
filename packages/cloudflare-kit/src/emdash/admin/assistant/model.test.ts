import { Option } from "effect";
import { describe, expect, it } from "vitest";

import { assistantGateway, decodeGatewayEnv } from "./model.ts";

describe(assistantGateway, () => {
  it("routes through the stage's shared gateway, tagged with the site and stage", () => {
    expect(
      assistantGateway({
        AI_GATEWAY_ID: "sites-assistant-prod",
        CMS_OWNER_SITE: "ani-wenger",
        STAGE: "prod",
      })
    ).toStrictEqual({
      id: "sites-assistant-prod",
      metadata: { site: "ani-wenger", stage: "prod" },
    });
  });

  it("skips the gateway when local dev binds the model without one", () => {
    const local = {
      AI_GATEWAY_ID: "",
      CMS_OWNER_SITE: "ani-wenger",
      STAGE: "dev-main",
    };
    expect(assistantGateway(local)).toBeUndefined();
    expect(
      assistantGateway({ ...local, AI_GATEWAY_ID: "sites-assistant-preview" })
        ?.id
    ).toBe("sites-assistant-preview");
  });
});

describe(decodeGatewayEnv, () => {
  it("reads the gateway, site and stage from a Worker's bindings", () => {
    const env = {
      AI_GATEWAY_ID: "sites-assistant-staging",
      CMS_OWNER_SITE: "equityfast",
      DB: {},
      STAGE: "staging",
    };
    expect(Option.getOrUndefined(decodeGatewayEnv(env))).toStrictEqual({
      AI_GATEWAY_ID: "sites-assistant-staging",
      CMS_OWNER_SITE: "equityfast",
      STAGE: "staging",
    });
    expect(Option.isNone(decodeGatewayEnv({ STAGE: "staging" }))).toBeTruthy();
  });
});

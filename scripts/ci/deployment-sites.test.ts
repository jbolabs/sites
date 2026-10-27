import { execFileSync } from "node:child_process";

import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  deploymentConcurrency,
  deploymentSites,
  loadDeploymentSites,
} from "./deployment-sites.ts";

const sites = [
  {
    domain: "example.com",
    id: "launched",
    stagingBaseDomain: "jbolabs.com",
    workersSubdomain: "jakebodea",
  },
  {
    domain: null,
    id: "unlaunched",
    stagingBaseDomain: "jbolabs.com",
    workersSubdomain: "jakebodea",
  },
];

describe(deploymentConcurrency, () => {
  it("shares the three-site preview limit with client previews", () => {
    expect(deploymentConcurrency("pr-42", false, 3)).toBe(3);
    expect(deploymentConcurrency("client-pr-42", false, 3)).toBe(3);
    for (const stage of [
      "staging",
      "prod",
      "dev-local",
      "client-pr-0",
      "pr-",
    ]) {
      expect(deploymentConcurrency(stage, false, 3)).toBe(1);
    }
  });

  it("keeps teardown and single-site previews serial", () => {
    expect(deploymentConcurrency("client-pr-42", true, 3)).toBe(1);
    expect(deploymentConcurrency("pr-42", true, 3)).toBe(1);
    expect(deploymentConcurrency("client-pr-42", false, 1)).toBe(1);
    expect(deploymentConcurrency("pr-42", false, 0)).toBe(1);
  });
});

describe(deploymentSites, () => {
  it("ships every affected app to staging and only domain apps to production", () => {
    expect(deploymentSites(sites, "staging")).toStrictEqual([
      "launched",
      "unlaunched",
    ]);
    expect(deploymentSites(sites, "prod")).toStrictEqual(["launched"]);
    expect(deploymentSites(sites, "pr-42")).toStrictEqual([
      "launched",
      "unlaunched",
    ]);
  });

  it("plans the real staging release without cloud access", () => {
    const output = execFileSync(
      "bun",
      [
        "scripts/ci/deploy.ts",
        "--stage",
        "staging",
        "--sites",
        "all",
        "--plan",
      ],
      { cwd: new URL("../../", import.meta.url), encoding: "utf-8" }
    );
    const planned = Schema.decodeUnknownSync(
      Schema.fromJsonString(
        Schema.Array(Schema.Struct({ origin: Schema.String }))
      )
    )(output);
    expect(planned.map(({ origin }) => origin).toSorted()).toStrictEqual([
      "https://ani-wenger-staging.jbolabs.com",
      "https://equityfast-staging.jbolabs.com",
      "https://ms-custom-homes-staging.jbolabs.com",
    ]);
  });

  it("loads the app configs used by the real deployment command", async () => {
    const configured = await loadDeploymentSites(
      new URL("../../", import.meta.url).pathname,
      ["ani-wenger", "equityfast", "ms-custom-homes"]
    );
    expect(deploymentSites(configured, "staging")).toStrictEqual([
      "ani-wenger",
      "equityfast",
      "ms-custom-homes",
    ]);
  });
});

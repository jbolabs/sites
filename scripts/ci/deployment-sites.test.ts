import { execFileSync } from "node:child_process";

import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { deploymentSites, loadDeploymentSites } from "./deployment-sites.ts";

const sites = [
  { domain: "example.com", id: "launched", workersSubdomain: "jakebodea" },
  { domain: null, id: "unlaunched", workersSubdomain: "jakebodea" },
];

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
      "https://access-electric-staging.jakebodea.workers.dev",
      "https://equityfast-staging.jakebodea.workers.dev",
      "https://ms-custom-homes-staging.jakebodea.workers.dev",
    ]);
  });

  it("loads the app configs used by the real deployment command", async () => {
    const configured = await loadDeploymentSites(
      new URL("../../", import.meta.url).pathname,
      ["access-electric", "equityfast", "ms-custom-homes"]
    );
    expect(deploymentSites(configured, "staging")).toStrictEqual([
      "access-electric",
      "equityfast",
      "ms-custom-homes",
    ]);
  });
});

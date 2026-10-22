import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../../.github/workflows/ci.yml", import.meta.url),
  "utf-8"
);

const job = (stage: string) =>
  workflow.split(`\n  ${stage}:\n`)[1]?.split(/\n {2}[a-z-]+:\n/u)[0];

describe("main release queue", () => {
  it("retains pending releases and serializes shared state upgrades across both stages", () => {
    for (const stage of ["staging", "production"]) {
      expect(job(stage)).toContain(`    environment: ${stage}\n`);
      expect(job(stage)).toContain(
        "      group: main-site-deploy\n      queue: max\n      cancel-in-progress: false"
      );
    }
  });

  it("deploys production only after staging deployed and verified the same release", () => {
    expect(job("staging")).toContain("    needs: check\n");
    expect(job("production")).toContain("    needs: [check, staging]\n");
    expect(job("production")).toContain(
      "needs.check.result == 'success' && needs.staging.result == 'success' &&"
    );
  });

  it("allows only supported queue settings while actionlint lacks this key", () => {
    const settings = workflow
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("queue:"))
      .map((line) => line.slice("queue:".length).trim());
    expect(settings).toStrictEqual(["max", "max", "max"]);
  });
});

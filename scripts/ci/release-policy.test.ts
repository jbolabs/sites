import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../../.github/workflows/ci.yml", import.meta.url),
  "utf-8"
);

describe("main release queue", () => {
  it("retains pending releases and serializes shared state upgrades across both stages", () => {
    for (const stage of ["staging", "production"]) {
      const job = workflow
        .split(`\n  ${stage}:\n`)[1]
        ?.split(/\n {2}[a-z-]+:\n/u)[0];
      expect(job).toContain("    needs: check\n");
      expect(job).toContain(`    environment: ${stage}\n`);
      expect(job).toContain(
        "      group: main-site-deploy\n      queue: max\n      cancel-in-progress: false"
      );
    }
  });

  it("allows only supported queue settings while actionlint lacks this key", () => {
    const settings = workflow
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("queue:"))
      .map((line) => line.slice("queue:".length).trim());
    expect(settings).toStrictEqual(["max", "max"]);
  });
});

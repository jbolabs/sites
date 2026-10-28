import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../../.github/workflows/ci.yml", import.meta.url),
  "utf-8"
);
const upgradeWorkflow = readFileSync(
  new URL("../../.github/workflows/upgrade-smoke.yml", import.meta.url),
  "utf-8"
);

const job = (stage: string, source = workflow) =>
  source.split(`\n  ${stage}:\n`)[1]?.split(/\n {2}[a-z-]+:\n/u)[0];

describe("main release queue", () => {
  it("compares locked and latest dependencies without hiding canary failures", () => {
    const smoke = job("smoke", upgradeWorkflow);
    expect(smoke).toContain("dependencies: [locked, latest]");
    expect(smoke).toContain("fail-fast: false");
    expect(smoke).toContain("if: matrix.dependencies == 'latest'");
    expect(smoke).toMatch(/Typecheck selected versions[\s\S]*name: Build/u);
    expect(smoke).not.toContain("continue-on-error");
  });

  it("includes dependency review in the required aggregate while permitting intentional skips", () => {
    expect(job("check")).toContain(
      "needs: [affected, deploy-scope, lint-test, verify, dependency-review]"
    );
    expect(job("check")).toContain("if: always()");
    expect(job("check")).toContain("contains(needs.*.result, 'failure')");
    expect(job("dependency-review")).toContain(
      "if: github.event_name == 'pull_request' && !github.event.repository.private"
    );
  });

  it("verifies path candidates without waiting on the comparison builds that prune deploys", () => {
    expect(job("affected")).toContain("--paths-only");
    expect(job("verify")).toContain("needs: affected\n");
    expect(job("verify")).toContain("fromJSON(needs.affected.outputs.verify)");
    expect(job("deploy-scope")).not.toContain("--paths-only");
    expect(job("check")).toContain(
      `deploy: \${{ needs.deploy-scope.outputs.deploy }}`
    );
  });

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

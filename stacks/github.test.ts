import { describe, expect, it } from "vitest";

import { environments } from "./github.ts";

// `ci-prod` trusts any job in the `production` environment
// (`repo:jbolabs@305914027/*:environment:production`), so that environment's branch
// policy is the only thing keeping a PR branch away from sites-prod.
describe("GitHub production environment", () => {
  it("exists exactly once and deploys from main only", () => {
    const production = environments.filter(
      (environment) => environment.name === "production"
    );
    expect(production.map((environment) => environment.branches)).toStrictEqual(
      [{ customBranchPolicies: ["main"] }]
    );
  });

  it("is the only environment with a branch policy, so previews stay open to PRs", () => {
    expect(
      environments
        .filter((environment) => environment.branches === null)
        .map((environment) => environment.name)
    ).toStrictEqual(["preview"]);
  });
});

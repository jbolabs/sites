import { describe, expect, it } from "vitest";

import { deployPolicies, environments } from "./github.ts";

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

  it("restricts staging to main while previews stay open to PRs", () => {
    expect(
      environments
        .filter((environment) => environment.branches === null)
        .map((environment) => environment.name)
    ).toStrictEqual(["client-preview", "preview"]);
    expect(
      environments
        .filter((environment) => environment.name === "staging")
        .map((environment) => environment.branches)
    ).toStrictEqual([{ customBranchPolicies: ["main"] }]);
  });

  it("grants staging custom-domain permissions while keeping PR previews workers.dev-only", () => {
    const routing = environments
      .filter((env) => env.permissions.includes("Workers Routes Write"))
      .map((env) => env.name);
    expect(routing).toStrictEqual(["client-preview", "staging", "production"]);
  });

  it("keeps account permissions separate from zone permissions", () => {
    for (const environment of environments) {
      const [policy] = deployPolicies(environment);
      expect(policy?.permissionGroups).toContain("Workers Scripts Write");
      expect(policy?.resources).toStrictEqual({
        "com.cloudflare.api.account.984b82870acd18daf8bda97bad966b38": "*",
      });
      expect(policy?.permissionGroups).not.toContain("DNS Write");
    }
  });

  it.each(["client-preview", "staging", "production"])(
    "scopes %s domain permissions under the account's zones",
    (name) => {
      const environment = environments.find((item) => item.name === name);
      if (environment === undefined) {
        throw new Error(`Missing ${name} environment`);
      }
      expect(deployPolicies(environment)[1]).toStrictEqual({
        effect: "allow",
        permissionGroups: ["Zone Read", "DNS Write", "Workers Routes Write"],
        resources: {
          "com.cloudflare.api.account.984b82870acd18daf8bda97bad966b38": {
            "com.cloudflare.api.account.zone.*": "*",
          },
        },
      });
    }
  );

  it("gives PR preview tokens only an account policy", () => {
    const environment = environments.find((item) => item.name === "preview");
    if (environment === undefined) {
      throw new Error("Missing preview environment");
    }
    const policies = deployPolicies(environment);
    expect(policies).toHaveLength(1);
    expect(policies[0]?.permissionGroups).toContain("Workers Scripts Write");
  });
});

import { describe, expect, it } from "vitest";

import {
  developmentStage,
  productionDeployRefusal,
  resolveStage,
  stageKind,
} from "./stage.ts";

const site = {
  domain: "example.com",
  id: "example",
  stagingBaseDomain: "studio.test",
  workersSubdomain: "acme",
};

describe(resolveStage, () => {
  it("serves prod from the custom domain", () => {
    expect(resolveStage(site, "prod")).toStrictEqual({
      domain: "example.com",
      kind: "production",
      origin: "https://example.com",
      production: true,
      stage: "prod",
      workerName: "example-prod",
    });
  });

  it("serves prod from workers.dev until the site has a domain", () => {
    expect(resolveStage({ ...site, domain: null }, "prod")).toMatchObject({
      origin: "https://example-prod.acme.workers.dev",
      production: true,
    });
    expect(
      resolveStage({ ...site, domain: null }, "prod").domain
    ).toBeUndefined();
  });

  it("serves staging from the studio domain even with a production domain", () => {
    expect(resolveStage(site, "staging")).toMatchObject({
      domain: "example-staging.studio.test",
      kind: "staging",
      origin: "https://example-staging.studio.test",
      production: false,
      stage: "staging",
      workerName: "example-staging",
    });
  });

  it("uses branded staging before a production domain is configured", () => {
    expect(resolveStage({ ...site, domain: null }, "staging").origin).toBe(
      "https://example-staging.studio.test"
    );
    expect(() =>
      resolveStage(
        { domain: null, id: "example", workersSubdomain: "acme" },
        "staging"
      )
    ).toThrow("Staging requires a studio-owned stagingBaseDomain.");
  });

  it("serves every other stage from workers.dev", () => {
    expect(resolveStage(site, "pr-42").origin).toBe(
      "https://example-pr-42.acme.workers.dev"
    );
    expect(resolveStage(site, "ae-preview").kind).toBe("named");
  });

  it("rejects stage names Cloudflare cannot use", () => {
    expect(() => resolveStage(site, "Feature/Thing")).toThrow(/Invalid stage/u);
  });
});

describe(stageKind, () => {
  it("classifies stages", () => {
    expect(stageKind("prod")).toBe("production");
    expect(stageKind("pr-7")).toBe("pull-request");
    expect(stageKind("pr-0")).toBe("named");
    expect(stageKind("dev-main")).toBe("development");
  });
});

describe(developmentStage, () => {
  it("derives a stage from the worktree directory", () => {
    expect(developmentStage("sites")).toBe("dev-sites");
    expect(developmentStage("Fix Hero__Slides!")).toBe("dev-fix-hero-slides");
    expect(developmentStage("___")).toBe("dev-local");
  });
});

describe(productionDeployRefusal, () => {
  const prod = resolveStage(site, "prod");

  it("refuses prod outside CI", () => {
    expect(productionDeployRefusal(prod, {})).toMatch(/Refusing/u);
  });

  it("refuses domainless production even in CI", () => {
    expect(
      productionDeployRefusal(resolveStage({ ...site, domain: null }, "prod"), {
        CI: "true",
      })
    ).toBe(
      "Refusing to deploy prod without a production domain. Use staging instead."
    );
  });

  it("allows prod from CI or with the explicit override", () => {
    expect(productionDeployRefusal(prod, {})).toMatch(/Refusing/u);
    expect(productionDeployRefusal(prod, { CI: "true" })).toBeUndefined();
    expect(
      productionDeployRefusal(prod, { ALLOW_PROD_DEPLOY: "1" })
    ).toBeUndefined();
  });

  it("never blocks other stages", () => {
    expect(productionDeployRefusal(prod, {})).toMatch(/Refusing/u);
    expect(
      productionDeployRefusal(resolveStage(site, "pr-3"), {})
    ).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";

import { secretSource } from "./secrets.ts";

const projects = { dev: "dev-project-id", prod: "prod-project-id" };

describe(secretSource, () => {
  it("reads the prod project's prod env for the prod stage", () => {
    expect(secretSource("prod", projects, true)).toStrictEqual({
      environment: "prod",
      project: "prod-project-id",
    });
  });

  it("reads the prod project's preview env for the control-plane stage", () => {
    expect(secretSource("ci", projects, false)).toStrictEqual({
      environment: "preview",
      project: "prod-project-id",
    });
  });

  it("reads the dev project for local development stages", () => {
    expect(secretSource("dev-sites-infisical", projects, false)).toStrictEqual({
      environment: "dev",
      project: "dev-project-id",
    });
  });

  it("reads no Infisical project for PR stages, even from a shell", () => {
    expect(secretSource("pr-12", projects, false)).toBeUndefined();
    expect(secretSource("dev-x", projects, false)?.project).toBe(
      "dev-project-id"
    );
  });

  it("reads no Infisical project for non-production stages in GitHub Actions", () => {
    expect(secretSource("dev-upgrade", projects, true)).toBeUndefined();
    expect(secretSource("prod", projects, true)?.project).toBe(
      "prod-project-id"
    );
  });

  it("never reads Infisical for a client PR preview, including from a shell", () => {
    expect(secretSource("client-pr-123", projects, false)).toBeUndefined();
    expect(secretSource("prod", projects, true)).toStrictEqual({
      environment: "prod",
      project: "prod-project-id",
    });
  });
});

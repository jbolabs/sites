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

  it("reads the dev project for local development and PR stages", () => {
    expect(secretSource("dev-sites-infisical", projects, false)).toStrictEqual({
      environment: "dev",
      project: "dev-project-id",
    });
    expect(secretSource("pr-12", projects, false)).toStrictEqual({
      environment: "dev",
      project: "dev-project-id",
    });
  });

  it("reads no Infisical project for PR stages in GitHub Actions", () => {
    expect(secretSource("pr-12", projects, true)).toBeUndefined();
    expect(secretSource("prod", projects, true)?.project).toBe(
      "prod-project-id"
    );
  });
});

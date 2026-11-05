import * as Infisical from "@alchemy.run/infisical";
/**
 * Generic stage → Infisical source mapping for Alchemy's native provider
 * (Effect Config, never `process.env`). A repo binds its own project ids in
 * `stacks/secrets.ts`. Two projects split by trust tier, because the free
 * plan's only access boundary is the project:
 *
 * - `prod` (CI on `main`, `ci-prod` over GitHub OIDC): the prod project, env `prod`.
 * - `ci` (the operator's control-plane deploy of `stacks/github.ts`): the prod project, env
 *   `preview`, which it writes into the GitHub `preview` environment.
 * - `pr-*`, and any other stage inside GitHub Actions (cleanup, janitor, upgrade smoke):
 *   no Infisical. Agents push PR branches, so those never read either project; CI jobs get
 *   Alchemy-minted GitHub environment secrets through the process environment.
 * - Anything else (local `dev-*`): the dev project, env `dev`, with the Alchemy
 *   profile's Infisical identity (`agent-dev` on agent machines).
 *
 * The process environment is always read last (Alchemy's default).
 */
import type { StackSecrets } from "alchemy";

import { isPullRequestStage } from "./stage.ts";

/** Infisical project UUIDs (a user token only resolves UUIDs, not slugs). */
export interface SecretProjects {
  readonly dev: string;
  readonly prod: string;
}

export interface SecretSource {
  readonly project: string;
  readonly environment: "dev" | "preview" | "prod";
}

/** The control-plane stage `stacks/github.ts` deploys to. */
export const CONTROL_PLANE_STAGE = "ci";

/** Which Infisical project and environment `stage` reads, or `undefined` for none. */
export const secretSource = (
  stage: string,
  projects: SecretProjects,
  inGitHubActions: boolean
): SecretSource | undefined => {
  if (stage === "prod") {
    return { environment: "prod", project: projects.prod };
  }
  if (stage === CONTROL_PLANE_STAGE) {
    return { environment: "preview", project: projects.prod };
  }
  return inGitHubActions || isPullRequestStage(stage)
    ? undefined
    : { environment: "dev", project: projects.dev };
};

/** A `secrets` option for `Alchemy.Stack` bound to a repo's projects. */
export const stageSecretsFor =
  (projects: SecretProjects): StackSecrets =>
  ({ stage }) => {
    const source = secretSource(
      stage,
      projects,
      process.env.GITHUB_ACTIONS === "true"
    );
    return source === undefined ? [] : [Infisical.Secrets({ ...source })];
  };

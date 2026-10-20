/**
 * Where a stack's secrets come from, per stage, through Alchemy's native
 * Infisical provider (Effect Config, never `process.env`). Two Infisical
 * projects split by trust tier, because the free plan's only access boundary
 * is the project:
 *
 * - `prod` (CI on `main`, `ci-prod` identity over GitHub OIDC): the prod project, env `prod`.
 * - `ci` (the operator's control-plane deploy of `stacks/github.ts`): the prod project, env
 *   `preview`, which it writes into the GitHub `preview` environment.
 * - Any other stage inside GitHub Actions (PR previews, cleanup, janitor, upgrade smoke):
 *   no Infisical at all. Agents push PR branches, so those jobs never read either project;
 *   they get Alchemy-minted GitHub environment secrets through the process environment.
 * - Any other stage elsewhere (local `dev-*`, `pr-*` from a shell): the dev project, env `dev`,
 *   with the Alchemy profile's Infisical identity (`agent-dev` on agent machines).
 *
 * The process environment is always read last (Alchemy's default), so CI-injected
 * GitHub secrets and deliberately exported variables still apply.
 */
import type { StackSecrets } from "alchemy";
import * as Infisical from "alchemy/Infisical";

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
  return inGitHubActions
    ? undefined
    : { environment: "dev", project: projects.dev };
};

/** The `secrets` option for an `Alchemy.Stack`. */
export const stageSecrets =
  (projects: SecretProjects): StackSecrets =>
  ({ stage }) => {
    const source = secretSource(
      stage,
      projects,
      process.env.GITHUB_ACTIONS === "true"
    );
    return source === undefined ? [] : [Infisical.Secrets({ ...source })];
  };

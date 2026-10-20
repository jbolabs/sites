/**
 * The only place with this repo's Infisical ids and its stage → source mapping
 * (shared jbolabs standard; docs/stack.md "Secrets", ADR 0004). Not secrets: ids only.
 *
 * - `prod` reads `sites-prod` env `prod` (CI on `main`, `ci-prod` over GitHub OIDC).
 * - `ci` (control plane, `stacks/github.ts`, operator) reads `sites-prod` env `preview`.
 * - `pr-*` and every other stage in GitHub Actions read nothing from Infisical.
 * - Everything else (local `dev-*`) reads `sites-dev` env `dev`.
 */
import { stageSecretsFor } from "@jakebodea/cloudflare-kit/infra";

export const infisical = {
  dev: "49d82a92-1821-44d4-bb5f-4252b411eadb",
  prod: "cb46a5eb-7afc-4e8a-93b7-40a065c6d6c9",
} as const;

/** `ci-prod`: reads `*-prod` from GitHub Actions jobs in the `production` environment (OIDC). */
export const ciProd = {
  audience: "https://github.com/jbolabs",
  identityId: "23fa16cc-a7a1-4e35-8011-2f24b0e037ba",
} as const;

/** The `secrets` option for every `Alchemy.Stack` in this repo. */
export const stageSecrets = stageSecretsFor(infisical);

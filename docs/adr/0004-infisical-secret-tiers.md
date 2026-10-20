# 4. Secrets: two Infisical projects split by trust tier, `.env` dev-only

- Status: accepted
- Date: 2026-10-20

## Context

Until now this repo used no secrets manager: one gitignored `.env` in the main checkout, symlinked into worktrees, and GitHub environment secrets written by `stacks/github.ts`. That ties every agent to the main checkout's file, and the operator mints production values from the same file agents read.

Infisical's free plan has no environment-scoped roles, so a project is the only access boundary. Agents authenticate with a Universal Auth machine identity (`agent-dev`); CI can authenticate with GitHub OIDC (`ci-prod`, `main` of jbolabs repos only).

## Decision

Secrets live in two Infisical projects, one per trust tier:

- `sites-dev` (id in the committed `.infisical.json`, single env `dev`): development values. Readable by `agent-dev`. Agents run commands through `bun run secrets -- <cmd>` (`scripts/dev-secrets.ts`).
- `sites-prod` (id `cb46a5eb-7afc-4e8a-93b7-40a065c6d6c9`, envs `preview`, `prod`): deployed-tier values. Readable by `ci-prod` and the operator, never by agents.

Operator commands that mint or deploy deployed-tier values source `sites-prod`, for example `infisical run --projectId cb46a5eb-7afc-4e8a-93b7-40a065c6d6c9 --env prod -- bun alchemy deploy stacks/github.ts --stage ci`. The main checkout's `.env` stays as a dev-only fallback.

## Design

`siteSecrets()` in `packages/cloudflare-kit/src/infra/secrets.ts` is unchanged: it reads the main checkout's `.env` files and then the process environment, which wins. Values injected by `infisical run` therefore override `.env`, and with no `.env` the process environment alone is used. Bun's own `.env` loading never overrides variables already set.

CI is unchanged for now: deploy jobs still read GitHub environment secrets written by `stacks/github.ts`. Loading `sites-prod` in CI through `ci-prod` (OIDC) is a later change.

## Alternatives considered

- One project with `dev`/`preview`/`prod` environments: the free plan cannot restrict a role to an environment, so agents would read prod.
- Keep `.env` only: agents stay coupled to the main checkout, and nothing separates what agents can read from what the operator mints into production.
- Alchemy's `Infisical.Secrets` provider inside `siteSecrets()`: workable later, but it would make every stack depend on Infisical credentials, including credential-free local dev.

## Consequences

- An agent with `INFISICAL_CLIENT_ID`/`INFISICAL_CLIENT_SECRET` needs no `.env` file.
- `sites-dev` must never hold a preview or prod value, and never gains a non-`dev` environment.
- `PUBLISHED_CONTENT_EXPORT_TOKEN` is the exception that already crosses tiers by design ([ADR 3](0003-published-production-content.md)): local `--content prod` fetches the production exporter, so the same value sits in `sites-dev` and `sites-prod`. It only reads already-published public content.
- `infisical run` reports any child failure as exit code 1.

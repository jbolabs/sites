# 4. Secrets: Alchemy reads two Infisical projects split by trust tier; no `.env`

- Status: accepted
- Date: 2026-10-20

## Context

Until now this repo used no secrets manager: one gitignored `.env` in the main checkout, symlinked into worktrees and read by Alchemy's DotEnv provider, plus GitHub environment secrets written by `stacks/github.ts`. Agents depended on the main checkout's file, and the operator minted production values from the same file agents read.

Infisical's free plan has no environment-scoped roles, so a project is the only access boundary. Three machine identities exist: `agent-dev` (Universal Auth, `*-dev` projects only, the default Alchemy profile on agent machines), `operator` (every project, the user's `admin` Alchemy profile) and `ci-prod` (GitHub OIDC from jbolabs `main`, audience `https://github.com/jbolabs`, `*-prod` projects only). Agents push PR branches, so a PR job must never be able to read a prod project.

Alchemy v2 ships `Infisical.Secrets`, a `secrets` provider that loads an Infisical environment into Effect Config (not `process.env`) and authenticates from `INFISICAL_TOKEN`, then `INFISICAL_IDENTITY_ID` with the platform's OIDC token, then the Alchemy profile.

## Decision

Every stack sets `secrets: stageSecrets` from `stacks/secrets.ts`, which follows the shared jbolabs standard: it exports `infisical = { dev, prod }` (project UUIDs) and `stageSecrets`, and is the only place with ids and the stage mapping. The mapping itself is the generic `stageSecretsFor` in `packages/cloudflare-kit/src/infra/secrets.ts`. By stage:

| Stage | Reads | Identity |
| --- | --- | --- |
| `prod` (CI on `main` only) | `sites-prod` env `prod` | `ci-prod` over GitHub OIDC |
| `ci` (operator deploys `stacks/github.ts`) | `sites-prod` env `preview` | `operator` (`admin` profile) |
| `pr-*` anywhere, and anything else inside GitHub Actions (cleanup, janitor, upgrade smoke) | no Infisical | none; Alchemy-minted GitHub `preview` environment secrets |
| anything else locally (`dev-*`) | `sites-dev` env `dev` | Alchemy profile (`agent-dev` for agents) |

The process environment is still read last (Alchemy's default), so GitHub environment secrets in CI and deliberately exported variables apply. The main-checkout `.env` mechanism (DotEnv provider, worktree symlinks, `.env.example`) is removed.

## Design

- **Production** reads `PUBLISHED_CONTENT_EXPORT_TOKEN` from `sites-prod`/`prod` at deploy time. The `production` job has `id-token: write` and the GitHub environment variables `INFISICAL_IDENTITY_ID` and `INFISICAL_OIDC_AUDIENCE`, both written by `stacks/github.ts`. The token is no longer copied into the GitHub `production` environment. Values Alchemy generates (`CMS_BOOTSTRAP_TOKEN`, Cloudflare tokens) stay GitHub environment secrets minted by `stacks/github.ts`.
- **PR previews** keep reading `PUBLISHED_CONTENT_EXPORT_TOKEN` (for the `production-content` label) from the GitHub `preview` environment. `stacks/github.ts`, run by the operator at stage `ci`, writes it there from `sites-prod`/`preview`. One `Infisical.Secrets` entry is enough because the control plane no longer needs the `prod` value. `preview` and `prod` must hold the same value, because previews fetch the production exporter.
- **Non-Alchemy consumers.** `bun run secrets -- <cmd>` (`scripts/dev-secrets.ts`) runs a plain command under `infisical run` with `sites-dev`. Only processes that read `process.env` themselves need it: the control app's production-content fetch (`bun run app -- … --content prod`) and, optionally, Turborepo's `TURBO_*` remote-cache credentials. Alchemy commands do not need it.
- **Agent bootstrap**, once per machine: `bun run setup:infisical` adds `agent-dev` (from `INFISICAL_CLIENT_ID`/`INFISICAL_CLIENT_SECRET`) to the current Alchemy profile.

This replaces ADR 3's private setup through the main checkout's `.env`.

## Alternatives considered

- One Infisical project with `dev`/`preview`/`prod` environments: the free plan cannot restrict a role to an environment, so agents would read prod.
- Keep `.env` with an `infisical run` wrapper around Alchemy: Alchemy already authenticates and loads Infisical natively, and a wrapper is one more thing agents must remember.
- `sites-dev` for `pr-*` stages: CI has no `agent-dev` credentials, PR stages need the Alchemy-minted GitHub preview values anyway, and nothing a PR stage reads lives in `sites-dev`.
- Two `Infisical.Secrets` entries (`preview` and `prod`) for stage `ci`: unnecessary once production reads Infisical directly.

## Consequences

- Every local stack start (`bun run app -- start`, `alchemy dev`) downloads `sites-dev` and fails without an Infisical identity in the Alchemy profile (or `INFISICAL_TOKEN`). Run `bun run setup:infisical` once per agent machine.
- `sites-dev` must never hold a preview or prod value, and never gains a non-`dev` environment.
- `PUBLISHED_CONTENT_EXPORT_TOKEN` already crosses tiers by design ([ADR 3](0003-published-production-content.md)): local `--content prod` fetches the production exporter, so the same value sits in `sites-dev` and `sites-prod`. It only reads already-published public content.
- `ci-prod` trusts only the subject `repo:jbolabs@305914027/*:environment:production`, so the GitHub `production` environment's `main`-only branch policy is the guard keeping PR branches away from `sites-prod`. `stacks/github.test.ts` fails if that policy allows any other branch, and a PR job must never declare `environment: production`.

# 5. Main releases deploy every app to staging and domain-qualified apps to production

- Status: accepted; staging hostname and credentials superseded by [ADR 6](0006-branded-client-staging.md); independent staging and production jobs superseded by [ADR 9](0009-production-waits-on-staging.md)
- Date: 2026-10-20

## Context

Apps need a stable review URL after merge before a client domain is ready. Previously every affected app deployed to `prod`, including apps with no domain, which served from a `-prod.workers.dev` address.

## Decision

Every main-branch release deploys affected apps to the persistent Alchemy `staging` stage at `https://<app>-staging.jakebodea.workers.dev`. Apps with a configured non-null `site.domain` additionally deploy to `prod` on the same release. Apps without one deploy only to staging. The existing affected-site policy still applies; unchanged apps need no redeploy.

## Design

- `scripts/ci/deployment-sites.ts` loads each app's `site.config.ts`, validates its identity, and filters domainless apps out of production deployments. `resolveStage` owns names and origins; the stack's production refusal also rejects domainless production.
- The staging and production workflow jobs independently follow the required checks and share a serialized main-release deployment queue (`queue: max`, up to 100 pending jobs), so staging and production cannot race while upgrading Alchemy’s account-wide state service or replace another pending release. Both run migrations, initial CMS setup/owner provisioning, smoke and SEO checks. `workflow_dispatch` retries the same policy for selected apps.
- `stacks/github.ts` owns a main-only GitHub `staging` environment with separate bootstrap and deploy credentials, using preview-level Cloudflare permissions. Staging has no Infisical/OIDC access in CI. Production secrets and domain permissions stay in the production environment.
- Staging has its own D1, R2, sessions and Turnstile widget. It uses the ordinary non-production indexing, analytics, cache, exporter and cron policy. Initial seed runs once; later deployments preserve CMS edits. No production content is copied automatically.

## Alternatives considered

- Keep domainless apps on `prod`: does not provide the requested staging URL or separate staging data for launched sites.
- Alias staging to the production Worker: would share client CMS data and stage behavior.

## Consequences

The operator must deploy the CI control plane to provision staging credentials before the first staging workflow can succeed. Main-branch CI then creates the staging resources. Existing `prod` Workers and their data remain intact; no migration or destruction is implicit. Local seed-media references to existing public production assets remain valid until deliberately replaced after staging is verified. Moving useful content from an existing production CMS into staging is separate work.

Roll back by reverting the workflow/selection change and the domainless-prod refusal together; existing production stages remain available. Do not destroy staging as part of a rollback without separate authorization.

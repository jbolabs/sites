# 9. Production deploys only after staging deploys and passes verification

- Status: accepted
- Date: 2026-10-21

## Context

[ADR 5](0005-main-staging.md) runs the staging and production jobs independently after the required checks, sharing one serialized queue. A failed staging verification therefore stops nothing: production deploys the same release regardless. From #58 until #66 fixed it, every main release that deployed staging ended red on a false SEO error, and nobody noticed for two days, because nothing depended on staging passing. Had the failure been real, production would have shipped it.

## Decision

The `production` job in `.github/workflows/ci.yml` needs `staging` and runs only when it succeeded: staging must deploy every affected app and pass its hosted smoke and SEO checks before any domain-qualified app deploys to production. `scripts/ci/release-policy.test.ts` asserts the dependency.

## Design

Staging deploys every affected app, a superset of the production set (apps with a `site.domain`), so a green staging run covers each app production will receive. `workflow_dispatch` retries follow the same order. Both jobs keep the shared `main-site-deploy` queue.

## Alternatives considered

- Keep independent jobs and alert on red staging: notices failures but still ships them to production.
- Block all merges while main is red: stops unrelated work and needs an exemption for the fix itself.

## Consequences

A release reaches production a few minutes later, after staging deploys and verifies. A staging-only failure (its credentials, DNS, or CMS data) holds production until fixed or retried with `workflow_dispatch`. Until an app has a production domain, nothing changes in practice.

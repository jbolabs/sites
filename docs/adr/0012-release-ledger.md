# 12. Main releases retry failed sites from a release ledger, not only from the diff

- Status: accepted
- Date: 2026-10-30

## Context

Main chose what to release only from the pushed diff (`scripts/ci/affected.ts`). On 2026-10-30 Ani Wenger's first prod release failed three times for infrastructure reasons (a new AI Gateway rule, a dead EmDash migration lock, a half-applied migration). Each fix landed outside `apps/ani-wenger/`, so no later push selected the site: the fix for the migration lock (#105) verified all three sites, deployed none, and the run was green. Recovery took manual `workflow_dispatch` runs, and a dispatch for one site still verified all three, because it diffed against an empty base. The opposite fix (deploy every site when a deploy script changes, #106) was rejected: re-verifying and redeploying every app for a CI-script change is waste.

## Decision

Main's `staging` job runs on every push and plans its release with `scripts/ci/release-records.ts`: the sites the diff selects plus every site whose latest release on staging or prod did not succeed. Each release is a GitHub deployment per site and stage (task `release:<site>`, in the existing `staging`/`production` environments), marked `in_progress` before Alchemy and `success` or `failure` after hosted verification. Staging creates the prod records as `queued`, so a production job that never runs still leaves a retry. Reads skip the `inactive` status GitHub adds to earlier staging records when a job's own deployment succeeds. Production releases exactly what staging just released, so ADR 9 holds for retries too. A dispatch releases exactly the sites it names.

Change detection narrows at the same time:

- `deploy.ts`, `migrate.ts` and `prepare-content.ts` leave every site's fingerprint: they change how a site deploys, not what it ships, and take effect on its next release.
- The verifier (`local-verify.ts` and what it runs, `packages/control-app`, `ci.yml`, Lighthouse budgets) verifies one canary, `ms-custom-homes`, instead of every site.
- Other CI scripts verify and deploy no site; their unit tests cover them.
- A `workflow_dispatch` verifies and releases exactly the sites it names.

## Alternatives considered

- Deploy every site when a deploy script changes (#106): redeploys and re-verifies apps whose output did not change.
- Compare every site's head fingerprint against its last successful release: retries and skips more precisely, but builds every site on every push; the diff plus failed releases fixes the incident without that cost.
- Keep the ledger in Alchemy state or outputs: the credential-free planning jobs would need state credentials, and Alchemy cannot record that migration, seeding and hosted checks passed.
- One GitHub environment per site: the Deployments API would create environments outside `stacks/github.ts`.

## Consequences

- A failed release retries on the next push to main, whatever that push touches; a dispatch remains for a stage destroyed by hand.
- Sites with no record are left to change detection, so adopting the ledger redeploys nothing; records start with each site's next release.
- A broken `deploy.ts` or `migrate.ts` surfaces on the next real release rather than its own PR. Their unit tests and the `preview` label are the guard.
- A GitHub API failure before any record exists (planning or recording) can still drop one release, as before this ADR; the window is a few seconds a run.
- A site that keeps failing is retried on every push until fixed, and every push to main starts the `staging` job, which exits after planning when nothing needs releasing.

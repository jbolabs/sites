# 7. PR labels own branded client previews and their full teardown

- Status: accepted
- Date: 2026-10-20

## Context

A client may compare redesigns on separate PRs. These need branded URLs and a predictable lifetime, including cleanup after failed deployment or a branch that removes its app. Developer previews remain separate.

## Decision

The `client-preview` label on a same-repository PR deploys affected apps, after required checks, to Alchemy stage `client-pr-<number>`. Its public hostname is `<app>-preview-<number>.jbolabs.com`; no allocation or collision counter is needed. Pushes update that preview. Removing the label or closing/merging the PR retires it. Developer `preview` stages remain independent.

## Design

- Stage resolution attaches branded hostnames only to client previews and staging. Client Workers disable both stable and version workers.dev URLs. All preview data is isolated; indexing, cache, analytics and cron behavior stays nonproduction.
- Alchemy owns a separate GitHub `client-preview` environment, its deploy/bootstrap credentials and published-content token. It has custom-domain permissions without production Infisical/OIDC or analytics credentials. Fork PRs never enter the deploy job. `production-content` can opt a fresh stage into the existing published-content importer.
- A GitHub deployment record with task `client-preview`, environment `client-preview-inventory`, and a versioned PR/site payload is created before the first Alchemy operation. Records are transient and status updates disable auto-inactivation, so another PR's successful deployment cannot lose ownership. An attempt with no status or a failed status still requires cleanup.
- Deploys, teardown and main releases share a serialized `main-site-deploy` queue with pending jobs retained. Each queued deploy rechecks the PR's current head and label. Cleanup checks current PR state after acquiring that same lock, preserving reopened/relabelled requests.
- Cleanup unions every active record's sites for the PR and destroys each entire stage through a state-only Alchemy entrypoint. It does not need the app directory or current CMS/build secrets. The entrypoint refuses every stage outside `client-pr-<positive number>`. Alchemy's recorded providers and removal policies own deletion of Worker/domain/DNS/certificate attachment, D1, media/backups buckets, sessions, Turnstile and AI Gateway. Shared zone, registrar, mail and CI credentials stay outside those stages.
- Records become inactive only after all destroys and the PR's retired-preview notice succeed. A daily workflow and manual dispatch repeat the reconciliation, including partial deployments with no Worker. Each preview type has its own comment marker.

## Consequences

Deploy the CI control plane to provision the environment, credentials and label, then merge the workflows to activate the feature. Closing a labelled PR is authorization for teardown, including preview-only CMS edits and media. Closing or removing a label never deletes staging or production. Existing developer preview cleanup is unchanged.

GitHub deployment records are the recovery inventory; do not manually delete them while resources exist. The inventory API and PR lookup must succeed before cleanup acts. A failure retains ownership for a retry. Live deploy/update/relabel/teardown rehearsal remains required to verify provider-side deletion; local lifecycle tests alone do not establish that cloud resources were removed.

# 10. Retire Access Electric from the monorepo; MS Custom Homes becomes the reference site

- Status: accepted
- Date: 2026-10-22

## Context

Access Electric is no longer a JBO Labs client. Jake rebuilt the site for free, then handed the original (separate) repo to the client, who runs it themselves. The copy in `apps/access-electric` stopped being maintained here, but it still shipped on every shared change (staging redeploys, per-site verification, the published-content exporter policy) and it was the documented reference site that `new-site` copies.

CI never destroys a persistent stage (`staging`, `prod`, named previews) when a site disappears from the repo: staging and `prod` deploy only the sites that exist at the pushed commit, and the janitor, `preview-cleanup` and client-preview reconciliation only touch `pr-<n>` and `client-pr-<n>` stages (including those of removed sites, when their PR closes). The site's own `alchemy destroy` needs `apps/<site>`, which this change deletes.

## Decision

Delete `apps/access-electric` and every list that enumerated it: the published-content policy, schema literal and route/CLI guards (now MS Custom Homes only), and the fixtures and tests that were coupled to the real site list. `apps/ms-custom-homes` becomes the reference site. It has the closest file set to the former reference (the same contact form, project gallery and page/project/lead collections, without ani-wenger's booking system or equityfast's multi-step application and Spanish locale), so the template stays small.

Teardown of Access Electric's deployed stages stays a deliberate, separately authorized Alchemy action. `scripts/ci/retirement-policy.ts` is the allowlist for the teardown-only entrypoint `scripts/ci/retire-preview.alchemy.ts`; it now also permits `access-electric/staging`, next to the `access-electric/prod` entry already there.

## Alternatives considered

- Have CI destroy stages of removed sites: needs a destructive, automated path and a way to tell a removed site from a broken checkout; the repo's rule is that destroys are explicitly authorized.
- Keep `apps/access-electric` as a frozen reference: ships dead weight on every shared change and keeps a former client's content in the template.
- Pick ani-wenger or equityfast as the reference: both carry large site-specific features (booking, application flow) that every new site would have to delete.

## Consequences

Access Electric's deployed resources are left as they are until Jake runs the teardown (or decides to keep them). Retained prod D1/R2 data survives a teardown and needs its own decision. The client's own live site and domain are not part of this repo and are untouched. [ADR 3](0003-published-production-content.md) described Access Electric's published-content policy; that policy no longer exists.

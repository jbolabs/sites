# 6. Clients preview sites on branded staging hostnames

- Status: accepted
- Date: 2026-10-20

## Context

Before migrating a client domain, the studio shares the persistent staging site for client review. Client-facing URLs should use the studio brand. PR previews are developer tooling and may retain workers.dev.

## Decision

Staging uses `https://<app>-staging.jbolabs.com`. Its Worker has `workersDev: false`, disabling both the stable workers.dev endpoint and version previews. PR stages and named developer previews keep their existing workers.dev URLs. Production still requires a client's configured `site.domain` and deploys alongside staging.

## Design

`site.stagingBaseDomain` references `studio.domain`. `resolveStage` derives the staging hostname separately from the client's production hostname and refuses staging when the studio base domain is missing. Each site's Alchemy Website attaches that custom domain, which owns the DNS record and edge certificate. The `jbolabs` repo retains ownership of the zone, registrar and mail; this repo owns only its site hostnames.

The GitHub staging environment gains the custom-domain permissions already used by production (`Zone Read`, `DNS Write`, `Workers Routes Write`). These use a separate policy with zone resources nested under the account, as required for Cloudflare account-owned API tokens; the shared policy construction also corrects production. PR preview credentials do not gain those permissions. CI outputs the Website's branded primary URL; build inputs, CMS origin and Turnstile use that same origin. Staging remains noindex with isolated CMS data and no production analytics, exporter or backup cron.

## Consequences

Deploy the updated CI control plane before the first staging release so its token can attach hostnames. Cloudflare provisions DNS and TLS through Alchemy on deploy; no manually managed DNS or wildcard route is required. Staging workers.dev links will not serve the site. Existing domainless production environments remain retained; this does not rename the Cloudflare account's subdomain or change other projects.

Rollback by reverting this hostname change and redeploying staging through Alchemy; that removes its branded attachment and restores the previous Workers URL. Never delete the studio zone. Live hostname, certificate and CMS sign-in checks are required after deployment.

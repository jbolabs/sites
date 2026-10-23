# 11. Agency tags: the client's own Tag Manager container, served through Cloudflare's Google tag gateway

- Status: accepted
- Date: 2026-10-23

## Context

EquityFast runs paid campaigns through its marketing agency, Kaleidico. The agency built a Google Tag Manager container (GA4, ad conversions) and expects to manage the tags in it themselves. [ADR 0001](0001-client-site-analytics-and-alerting.md) keeps client sites free of third-party scripts by default; it did not cover a client whose agency owns its own tracking.

Every resource lives in Alchemy, so whatever serves the tags has to be code too. Alchemy 2.0.0-beta.82 has two candidates: `Cloudflare.Zaraz.Config` and `Cloudflare.GoogleTagGateway.GoogleTagGateway`.

## Decision

A site whose client brings a Tag Manager container loads it on prod only, through `googleTagManager` in `packages/cloudflare-kit/src/infra` and the `google-tag-manager.astro` component in its layout. On a site with a production domain, the same helper enables Cloudflare's Google tag gateway on that zone, so the container is served first-party from the client's own domain. The container ID is committed in `site.config.ts`; it is public in every page anyway.

## Design

| Module | Owns |
| --- | --- |
| `infra/google-tag-manager.ts` | Validates the ID, binds `GTM_CONTAINER_ID` (empty off prod), and on prod creates the zone's `GoogleTagGateway` with `setUpTag: true`. Destroy restores the zone's earlier gateway config. |
| `google-tag-manager.ts` | `googleTagManagerFromEnv` ("empty means off"), Google's loader script and the noscript frame URL. |
| `astro/google-tag-manager.astro` | `part="head"` and `part="body"`. Renders only on the origin hostname or its `www` form, like the Web Analytics beacon. |
| `stacks/github.ts` | The production deploy token gains zone-scoped `Zaraz Edit`, the only group Cloudflare's API accepts for the gateway config. |

## Alternatives considered

- **Zaraz with the tags as code.** Cloudflare advises against loading a GTM container through Zaraz, so the agency's tags would be rewritten as Zaraz tools that only we can change. The agency loses the console it already uses.
- **Zaraz loading the GTM container.** Cloudflare's own FAQ calls this not recommended: tags inside GTM get none of Zaraz's optimisation and the page pays for both.
- **Plain GTM snippet, no gateway.** Works, but ad blockers that drop googletagmanager.com also drop the client's conversions. The gateway is free and is one Alchemy resource.

## Consequences

- The client's agency can add any tag to prod without a deploy. That is the point, and it also means scripts we did not write run on the site.
- The prod deploy token must be re-minted (apply the `ci` stage of `stacks/github.ts`) before the first prod deploy that creates the gateway.
- Not yet proven: that the gateway rewrites the snippet on a Worker custom domain. If it does not, the snippet still loads GTM from Google directly. Check with Tag Assistant after the first prod deploy.
- Staging and previews load no tags, so the agency's data holds only real visitors.

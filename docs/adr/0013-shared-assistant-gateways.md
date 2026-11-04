# 13. Shared assistant gateways: one AI Gateway per tier, used by every site

- Status: accepted
- Date: 2026-11-04

## Context

Every deployed stage of every site created its own AI Gateway for the CMS assistant (`<site>-<stage>-assistant`). A site has staging, prod, and any number of PR and client previews, so the count grew with sites times stages. Cloudflare limits how many gateways one account can hold, and on 2026-11-04 the Stud Construction client preview failed while creating its gateway, though the same stack deployed a preview on 2026-10-27. A gateway only routes, rate-limits and logs calls; nothing in it belongs to one site.

## Decision

Three gateways, owned by `stacks/assistant-gateways.ts` (stage `shared`): `sites-assistant-preview`, `sites-assistant-staging` and `sites-assistant-prod`. `assistantAi` in the kit's infra gives a site the one for its stage: `prod` and `staging` their own, every other deployed stage the preview one. Sites no longer create a gateway.

## Design

- `ASSISTANT_GATEWAYS` and `assistantGatewayTier` (kit `infra/assistant-ai.ts`) are the one source of the ids, imported by both the shared stack and every site.
- The shared stack retains the gateways if it is destroyed, and refuses any stage but `shared`, so no second copy appears.
- Each model call sends gateway `metadata` `{ site, stage }` (from `CMS_OWNER_SITE` and `STAGE`; `assistantGateway` in the assistant's `model.ts`), so logs filter and costs split by site.
- The rate limit moves from per site and stage (120 calls in 10 minutes) to per tier (360 calls in 10 minutes, sliding). Its job is to stop a stuck loop or a script from draining the account's Workers AI allowance, which an account-wide count does better than one count per site.

## Alternatives considered

- Keep per-site gateways and raise the account limit: the count still grows with every preview, and every new site adds two more.
- One gateway for everything: preview traffic would share prod's rate limit and logs.
- A per-site Workers rate-limit binding beside the shared gateway: its windows are 10 or 60 seconds, too short to allow a 12-round turn while still bounding a minute of runaway calls, and it adds a binding to every site for little gain.

## Consequences

- Deploy order: the shared stack first, then sites. A site deployed before its tier's gateway exists still deploys, but its assistant fails until the gateway does.
- When a stage next deploys or is destroyed, Alchemy deletes the per-site gateway it used to own. CI tokens keep `AI Gateway Write` for that.
- One site's runaway use can rate-limit the other sites on its tier for up to ten minutes.

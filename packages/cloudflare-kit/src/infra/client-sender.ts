import { AlchemyContext } from "alchemy/AlchemyContext";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect, Option } from "effect";

import type { StageSettings } from "./stage.ts";

/**
 * Lead mail from the client's own domain (e.g. `applications@mail.example.com`)
 * instead of the studio sender. On prod this registers the address's
 * subdomain with Cloudflare Email Sending, which adds its DKIM, SPF and
 * return-path records to the client's zone. Other stages get none
 * and keep the studio sender: they email no client anyway (`leadMail`).
 *
 * A subdomain, not the bare domain: Cloudflare onboards a zone apex for
 * sending only in the dashboard, and every resource here lives in Alchemy.
 */
export const clientSender = (stage: StageSettings, address: string) =>
  Effect.gen(function* createClientSender() {
    const subdomain = address.slice(address.indexOf("@") + 1);
    const { dev } = yield* AlchemyContext;
    if (!stage.production || dev || stage.domain === undefined) {
      return Option.none<string>();
    }
    if (!subdomain.endsWith(`.${stage.domain}`)) {
      return yield* Effect.die(
        new Error(`${address} must be on a subdomain of ${stage.domain}`)
      );
    }
    const { accountId } = yield* yield* Cloudflare.CloudflareEnvironment;
    const zoneId = yield* Cloudflare.Zone.resolveZoneId({
      accountId,
      hostname: stage.domain,
      zone: stage.domain,
      // A zone missing from the account can't be fixed mid-deploy: fail it.
    }).pipe(Effect.orDie);
    yield* Cloudflare.Email.SendingSubdomain("ClientSender", {
      name: subdomain,
      // Lead mail carries applicants' details: keep no copies in Cloudflare's activity log.
      previewEnabled: false,
      zoneId,
    });
    return Option.some(address);
  });

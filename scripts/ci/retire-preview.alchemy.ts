/**
 * Teardown-only stack for stages in `retirement-policy.ts`. Loading an app stack
 * would need CMS secrets and build inputs during deletion, or code that is gone.
 * Alchemy deletes the resources recorded in this existing stack/stage's state.
 */
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { RandomProvider } from "alchemy/Random";
import { Effect, Layer } from "effect";

import { forceEmptyBucket, retirementSite } from "./retirement-policy.ts";

const site = process.env.RETIRE_SITE ?? "";

export default Alchemy.Stack(
  site,
  {
    providers: Layer.mergeAll(Cloudflare.providers(), RandomProvider()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* retirement() {
    const stage = yield* Alchemy.Stage;
    retirementSite(site, stage);
    const bucket = forceEmptyBucket(site, stage);
    if (bucket !== undefined) {
      yield* Cloudflare.R2.Bucket("Bucket", {
        forceDestroy: true,
        name: bucket,
      });
    }
    return {};
  })
);

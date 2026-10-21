/** State-driven teardown works even when the PR's app was removed from main. */
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { RandomProvider } from "alchemy/Random";
import { Effect, Layer } from "effect";

import { teardownIdentity } from "./client-preview-records.ts";

const site = process.env.PREVIEW_SITE ?? "";
export default Alchemy.Stack(
  site,
  {
    providers: Layer.mergeAll(Cloudflare.providers(), RandomProvider()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* clientTeardown() {
    teardownIdentity(site, yield* Alchemy.Stage);
    return {};
  })
);

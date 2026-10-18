import {
  LeadNotSaved,
  LeadStore,
  leadNotificationText,
} from "@jakebodea/cloudflare-kit/server";
import type { Lead } from "@jakebodea/cloudflare-kit/server";
import { Effect, Layer } from "effect";
import { withEmDashRuntime } from "emdash/middleware";

import { KIND_LABEL, KIND_QUESTION } from "./forms.ts";

/**
 * Messages and prayer requests live in the EmDash `leads` collection
 * ("Messages" in the admin): the church reads them where it already edits
 * the site, marked Contact or Prayer request. The collection is not routable
 * and entries stay drafts, so they never reach a public page, sitemap, or
 * query. The entry's text is the same summary the notification email carries.
 *
 * `withEmDashRuntime` is EmDash's trusted server-side entry point (public
 * routes get no write handlers on `locals`); input is validated by
 * `ChurchForm` before it gets here.
 */
export const LeadStoreEmDash = Layer.succeed(LeadStore, {
  save: (lead: Lead) =>
    Effect.tryPromise({
      catch: (cause) => new LeadNotSaved({ cause }),
      try: async () =>
        await withEmDashRuntime(async (runtime) => {
          const kind = lead.answers?.find(
            ({ question }) => question === KIND_QUESTION
          )?.answer;
          const result = await runtime.handleContentCreate("leads", {
            data: {
              email: lead.email,
              kind:
                kind === KIND_LABEL.prayer
                  ? KIND_LABEL.prayer
                  : KIND_LABEL.contact,
              message: leadNotificationText(lead),
              phone: lead.phone ?? null,
              source_path: lead.sourcePath,
              title: lead.name,
            },
            status: "draft",
          });
          if (!result.success) {
            throw new Error(`${result.error.code}: ${result.error.message}`);
          }
          return { id: result.data.item.id };
        }),
    }).pipe(Effect.withSpan("LeadStore.save")),
});

/**
 * Worker entry. Alchemy's pinned entry is aliased here (see
 * `@jakebodea/cloudflare-kit/emdash/alchemy-workarounds`), so this wraps
 * EmDash's entry. The kit's `siteScheduled` owns the crons (analytics plugin
 * settings, EmDash's minute tick, the prod backup); the minute tick also sends
 * appointment reminders every quarter hour. Non-prod stages send
 * `X-Robots-Tag: noindex` so previews never get indexed (a header, not
 * robots.txt, because a Disallow hides the noindex). Resized photos go
 * through the kit's image cache, since EmDash's endpoint re-resizes per view.
 */
import handler from "@emdash-cms/cloudflare/worker";
import { fetchCachedImage } from "@jakebodea/cloudflare-kit/emdash/image-cache";
import { fetchPublicHtml } from "@jakebodea/cloudflare-kit/emdash/public-html";
import {
  canonicalRedirect,
  siteScheduled,
} from "@jakebodea/cloudflare-kit/emdash/worker";

import { sendReminders } from "./lib/booking/booking.ts";
import { runSchedule } from "./lib/booking/run.ts";
import { BACKUP_CRON, EMDASH_CRON, isReminderTick } from "./lib/schedule.ts";

// EmDash's sandboxed-plugin entrypoint must be exported from the Worker's main module.
export { PluginBridge } from "@emdash-cms/cloudflare/worker";

const SWITCHING_PROTOCOLS = 101;
const scheduled = siteScheduled({ backupCron: BACKUP_CRON });

export default {
  async fetch(request, env, ctx) {
    const redirect = canonicalRedirect(request, env.SITE_ORIGIN);
    if (redirect !== undefined) {
      return redirect;
    }
    const response = await fetchCachedImage(
      request,
      env,
      ctx,
      async () =>
        await fetchPublicHtml(
          request,
          env,
          ctx,
          async () =>
            (await handler.fetch?.(request, env, ctx)) ??
            new Response(null, { status: 404 })
        )
    );
    if (env.STAGE === "prod" || response.status === SWITCHING_PROTOCOLS) {
      return response;
    }
    const headers = new Headers(response.headers);
    headers.set("X-Robots-Tag", "noindex, nofollow");
    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  },
  async scheduled(controller, env, ctx) {
    await scheduled(controller, env, ctx);
    if (
      controller.cron === EMDASH_CRON &&
      isReminderTick(new Date(controller.scheduledTime))
    ) {
      ctx.waitUntil(runSchedule(sendReminders()));
    }
  },
} satisfies ExportedHandler<Env>;

/// <reference types="bun" />
import {
  BUILD_INPUTS_FILE,
  assistantAi,
  cmsCrons,
  TURNSTILE_TEST_KEYS,
  WORKER_COMPATIBILITY,
  devPort,
  isPullRequestStage,
  productionDeployRefusal,
  resolveStage,
  webAnalytics,
  leadMail,
  emdashSecrets,
  siteObservability,
  writeBuildInputs,
  publishedContentDigest,
  siteState,
} from "@jakebodea/cloudflare-kit/infra";
/**
 * Ani Wenger infrastructure (one Alchemy stack, one stage per environment):
 *
 *   D1 (EmDash content and appointments) + R2 (media; clients' hair photos) + Images binding + session KV (auto)
 *   + Turnstile widget (contact form and booking) + every-minute cron (EmDash
 *   scheduled publishing, appointment reminders) + a random calendar-feed key
 *   + Workers AI + AI Gateway for the CMS assistant (deployed stages only)
 *   prod only: custom domain, retained backups bucket + daily backup cron
 *
 * Deploy: `bun alchemy deploy --stage <stage> --profile <profile>` from this
 * directory (see .agents/skills/deploy). Never export CLOUDFLARE_* variables.
 */
import * as Alchemy from "alchemy";
import { AlchemyContext } from "alchemy/AlchemyContext";
import * as Cloudflare from "alchemy/Cloudflare";
import { Random, RandomProvider } from "alchemy/Random";
import * as RemovalPolicy from "alchemy/RemovalPolicy";
import { Config, Effect, Layer, Redacted } from "effect";

import { studio } from "../../stacks/config.ts";
import { stageSecrets } from "../../stacks/secrets.ts";
import { site } from "./site.config.ts";
import { BACKUP_CRON, EMDASH_CRON } from "./src/lib/schedule.ts";

const root = import.meta.dirname;

export default Alchemy.Stack(
  site.id,
  {
    providers: Layer.mergeAll(Cloudflare.providers(), RandomProvider()),
    secrets: stageSecrets,
    state: siteState(),
  },
  Effect.gen(function* stack() {
    const stage = resolveStage(site, yield* Alchemy.Stage);
    const refusal = productionDeployRefusal(stage, process.env);
    if (refusal !== undefined) {
      return yield* Effect.die(new Error(refusal));
    }
    const keep = RemovalPolicy.retain(stage.production);
    // `alchemy dev` emulates D1/R2/KV/Images locally; nothing here may need the cloud.
    const { dev } = yield* AlchemyContext;
    const port = devPort(stage.stage);
    const origin = dev ? `http://localhost:${port}` : stage.origin;

    // Build inputs the Astro config reads (origin, seed media, CMS email sender).
    const emailFrom = studio.sender;
    writeBuildInputs(root, {
      contentDigest:
        (dev || isPullRequestStage(stage.stage)) &&
        process.env.CONTENT_MODE === "prod"
          ? publishedContentDigest(root, true)
          : "seed",
      emailFrom,
      emailFromName: `${site.shortName} website`,
      origin,
      // EmDash's SSRF guard refuses localhost seed downloads, so local dev seeds from a public copy.
      seedMediaBase: dev ? site.localSeedMediaBase : `${origin}/_seed/media`,
    });

    const database = yield* Cloudflare.D1.Database("Content").pipe(keep);
    const media = yield* Cloudflare.R2.Bucket("Media", {
      // Disposable stages must empty the bucket to delete it.
      forceDestroy: !stage.production,
    }).pipe(keep);
    // Photos clients send with a booking: private (served only by unguessable
    // name), never in the media library, and deleted after a year.
    const hairPhotos = yield* Cloudflare.R2.Bucket("HairPhotos", {
      forceDestroy: !stage.production,
      lifecycleRules: [
        {
          deleteObjectsTransition: {
            condition: { maxAge: 365 * 86_400, type: "Age" },
          },
          id: "delete-after-a-year",
        },
      ],
    }).pipe(keep);
    // Bound everywhere so the Worker's types never branch; only prod runs the backup cron.
    const backups = yield* Cloudflare.R2.Bucket("Backups", {
      forceDestroy: !stage.production,
    }).pipe(keep);
    // Turnstile has no local emulation: dev uses Cloudflare's always-pass test keys.
    const turnstile = dev
      ? {
          secret: TURNSTILE_TEST_KEYS.secretKey,
          sitekey: TURNSTILE_TEST_KEYS.siteKey,
        }
      : yield* Cloudflare.Turnstile.Widget("Turnstile", {
          domains: [new URL(stage.origin).hostname],
          mode: "managed",
          name: stage.workerName,
        });
    // The secret part of Ani's calendar feed URL; rotate by replacing this resource.
    const calendarFeed = yield* Random("CalendarFeedKey", { bytes: 24 });
    // CMS assistant: Workers AI behind a rate-limited AI Gateway (no model in offline dev).
    const assistant = yield* assistantAi(stage);
    const bindings = {
      ...(yield* webAnalytics(stage)),
      ...leadMail(stage, {
        alertInbox: studio.alertInbox,
        emailFrom,
        fromName: `${site.name} website`,
        inbox: site.leadInbox,
      }),
      ...(yield* emdashSecrets),
      AI_GATEWAY_ID: assistant.gatewayId,
      BACKUPS: backups,
      CALENDAR_FEED_KEY: calendarFeed.text,
      CF_VERSION_METADATA: Cloudflare.Workers.VersionMetadata(),
      CMS_BOOTSTRAP_TOKEN: dev
        ? Redacted.make("local-only-cms-bootstrap-credential")
        : yield* Config.Redacted("CMS_BOOTSTRAP_TOKEN"),

      CMS_OWNER_EMAIL: studio.cmsOwnerEmail,
      CMS_OWNER_SITE: site.id,
      CMS_PREVIOUS_OWNER_EMAILS: studio.previousCmsOwnerEmails.join(","),
      DB: database,
      HAIR_PHOTOS: hairPhotos,
      // EmDash's /_image endpoint resizes media with this binding.
      IMAGES: Cloudflare.Images.Images("IMAGES"),
      MEDIA: media,
      PUBLIC_HTML_CACHE_TTL_SECONDS: stage.production ? "30" : "0",
      PUBLISHED_CONTENT_EXPORT_TOKEN: stage.production
        ? yield* Config.Redacted("PUBLISHED_CONTENT_EXPORT_TOKEN")
        : Redacted.make(""),
      SITE_ORIGIN: origin,
      STAGE: stage.stage,
      TURNSTILE_SECRET_KEY: turnstile.secret,
      TURNSTILE_SITE_KEY: turnstile.sitekey,
    };
    const withModel = assistant.bindModel
      ? { ...bindings, AI: Cloudflare.Workers.AI() }
      : bindings;
    // Cloudflare Email Service needs a verified sender; until then mail is logged, not sent.
    const env =
      emailFrom === undefined
        ? withModel
        : {
            ...withModel,
            EMAIL: Cloudflare.Email.SendEmail("Email", {
              allowedSenderAddresses: [emailFrom],
            }),
          };

    const website = yield* Cloudflare.Website.Astro("Website", {
      // Keep the pre-Worker cache off so static asset requests remain free.
      cache: { enabled: false },
      compatibility: {
        date: WORKER_COMPATIBILITY.date,
        flags: [...WORKER_COMPATIBILITY.flags],
      },
      crons: cmsCrons({
        backupCron: BACKUP_CRON,
        previewScheduledPublishing:
          process.env.PREVIEW_SCHEDULED_PUBLISHING === "1",
        production: stage.production,
        publishCron: EMDASH_CRON,
      }),
      dev: { port, strictPort: true },
      domain: stage.workerDomain,
      env,
      memo: {
        // Hash the app, the lockfile, workspace packages it imports (auto), and the
        // gitignored build-inputs stamp so per-stage inputs trigger a rebuild.
        exclude: [
          "node_modules/**",
          "dist/**",
          ".astro/**",
          ".alchemy/**",
          ".wrangler/**",
          ".emdash/**",
          "public/_seed/**",
          ".published-content.json",
        ],
        include: ["**/*", BUILD_INPUTS_FILE],
        lockfile: true,
      },
      name: stage.workerName,
      observability: siteObservability(stage),
      workersDev: stage.workersDev,
    });

    return {
      databaseId: database.databaseId,
      stage: stage.stage,
      url: website.url,
    };
  })
);

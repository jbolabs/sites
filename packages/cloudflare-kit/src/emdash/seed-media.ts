/**
 * Astro integration that lets an EmDash seed ship its own images.
 *
 * EmDash seeds reference media by URL (`{ "$media": { "url": ... } }`) and
 * download them during setup; local files are not supported, and the SSRF
 * guard refuses private hosts. So the seed keeps site-relative URLs under
 * `/_seed/media/`, this integration
 *
 * 1. copies `seed/media/` into `public/_seed/media/` (gitignored) so every
 *    stage serves the originals itself, and
 * 2. writes `.emdash/seed.json` (EmDash's first seed lookup path) with those
 *    URLs made absolute against `mediaBase`, and
 * 3. keeps `seed/placeholders.json` (blurred placeholders, see
 *    `seed-placeholders.ts`) in step with `seed/media/` and serves it to pages
 *    as `virtual:seed-placeholders`.
 *
 * Without a `mediaBase` the URLs stay relative and setup skips the images.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AstroIntegration } from "astro";
import { Schema } from "effect";
import { generatePlaceholder } from "emdash/media";

import { readPublishedPlan } from "./published-integration.ts";
import { SeedPlaceholders } from "./seed-placeholders.ts";
import type { SeedPlaceholder } from "./seed-placeholders.ts";

export const SEED_MEDIA_PATH = "/_seed/media/";

export interface SeedMediaOptions {
  /** Absolute base the seed's `/_seed/media/<file>` URLs resolve against, e.g. `https://example.com/_seed/media`. */
  readonly mediaBase: string | undefined;
  /** Seed source, relative to the project root. */
  readonly seed?: string;
  /** Directory of seed images, relative to the project root. */
  readonly media?: string;
}

/** Rewrites `/_seed/media/<file>` URLs in a seed's JSON text to `<mediaBase>/<file>`. */
export const resolveSeedMedia = (
  seedJson: string,
  mediaBase: string
): string => {
  const base = mediaBase.endsWith("/") ? mediaBase : `${mediaBase}/`;
  return seedJson.replaceAll(`"${SEED_MEDIA_PATH}`, `"${base}`);
};

const syncDirectory = (from: string, to: string): number => {
  mkdirSync(to, { recursive: true });
  let copied = 0;
  for (const name of readdirSync(from)) {
    const source = path.join(from, name);
    const target = path.join(to, name);
    if (
      !existsSync(target) ||
      statSync(target).size !== statSync(source).size
    ) {
      copyFileSync(source, target);
      copied += 1;
    }
  }
  return copied;
};

export const SEED_PLACEHOLDERS_FILE = "seed/placeholders.json";

/** Formats EmDash's placeholder generator decodes. */
const MIME_TYPES = new Map([
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
]);

export const readSeedPlaceholders = (file: string): SeedPlaceholders => {
  try {
    return Schema.decodeUnknownSync(Schema.fromJsonString(SeedPlaceholders))(
      readFileSync(file, "utf-8")
    );
  } catch {
    return {};
  }
};

const photoPlaceholder = async (
  file: string,
  known: SeedPlaceholder | undefined
): Promise<SeedPlaceholder | undefined> => {
  const mimeType = MIME_TYPES.get(path.extname(file).toLowerCase());
  if (mimeType === undefined) {
    return undefined;
  }
  const bytes = statSync(file).size;
  if (known?.bytes === bytes) {
    return known;
  }
  const placeholder = await generatePlaceholder(
    new Uint8Array(readFileSync(file)),
    mimeType
  );
  return placeholder === null ? undefined : { bytes, ...placeholder };
};

/** Placeholders for every photo in `mediaDir`, decoding only those `known` lacks or has at another size. */
export const syncSeedPlaceholders = async (
  mediaDir: string,
  known: SeedPlaceholders
): Promise<SeedPlaceholders> => {
  const names = readdirSync(mediaDir).toSorted();
  const placeholders = await Promise.all(
    names.map(
      async (name) =>
        await photoPlaceholder(path.join(mediaDir, name), known[name])
    )
  );
  return Object.fromEntries(
    names.flatMap((name, index) => {
      const placeholder = placeholders[index];
      return placeholder === undefined ? [] : [[name, placeholder] as const];
    })
  );
};

const PLACEHOLDERS_MODULE = "virtual:seed-placeholders";

export const seedMedia = (options: SeedMediaOptions): AstroIntegration => ({
  hooks: {
    "astro:config:setup": async ({ config, logger, updateConfig }) => {
      const root = fileURLToPath(config.root);
      const mediaDir = path.join(root, options.media ?? "seed/media");
      if (existsSync(mediaDir)) {
        const publicMedia = path.join(
          fileURLToPath(config.publicDir),
          SEED_MEDIA_PATH
        );
        const copied = syncDirectory(mediaDir, publicMedia);
        if (copied > 0) {
          logger.info(
            `copied ${copied} seed images to public${SEED_MEDIA_PATH}`
          );
        }
      }
      const placeholdersFile = path.join(root, SEED_PLACEHOLDERS_FILE);
      const known = readSeedPlaceholders(placeholdersFile);
      const placeholders = existsSync(mediaDir)
        ? await syncSeedPlaceholders(mediaDir, known)
        : known;
      const placeholdersJson = `${JSON.stringify(placeholders, null, 2)}\n`;
      if (
        !existsSync(placeholdersFile) ||
        readFileSync(placeholdersFile, "utf-8") !== placeholdersJson
      ) {
        writeFileSync(placeholdersFile, placeholdersJson);
        logger.info(`updated ${SEED_PLACEHOLDERS_FILE}: commit it`);
      }
      updateConfig({
        vite: {
          plugins: [
            {
              load: (id) =>
                id === `\0${PLACEHOLDERS_MODULE}`
                  ? `export default ${JSON.stringify(placeholders)}`
                  : undefined,
              name: "seed-placeholders",
              resolveId: (id) =>
                id === PLACEHOLDERS_MODULE
                  ? `\0${PLACEHOLDERS_MODULE}`
                  : undefined,
            },
          ],
        },
      });
      const seedJson = readFileSync(
        path.join(root, options.seed ?? "seed/seed.json"),
        "utf-8"
      );
      const plan = readPublishedPlan(root);
      const contentSeed = plan === null ? seedJson : JSON.stringify(plan.seed);
      const resolved =
        options.mediaBase === undefined
          ? contentSeed
          : resolveSeedMedia(contentSeed, options.mediaBase);
      mkdirSync(path.join(root, ".emdash"), { recursive: true });
      writeFileSync(path.join(root, ".emdash", "seed.json"), resolved);
      if (options.mediaBase === undefined) {
        logger.warn(
          "no seed media base configured: setup will skip seed images"
        );
      }
    },
  },
  name: "@jakebodea/cloudflare-kit/seed-media",
});

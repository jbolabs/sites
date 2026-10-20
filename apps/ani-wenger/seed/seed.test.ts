/**
 * The seed is what a fresh stage (and every preview) starts from, so it must
 * be internally consistent: every image it references ships in `seed/media`,
 * every `$ref` points at a real entry, and every menu link and old-site
 * redirect resolves to a route the site serves.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const SEED_DIR = import.meta.dirname;
const seedText = readFileSync(path.join(SEED_DIR, "seed.json"), "utf-8");

const MEDIA_URL = /"url":\s*"\/_seed\/media\/(?<file>[^"]+)"/gu;
const REF = /"\$ref:(?<id>[^"]+)"/gu;
const ENTRY_ID = /"id":\s*"(?<id>[a-z0-9-]+)"/gu;

const captures = (pattern: RegExp, group: string): string[] =>
  [...seedText.matchAll(pattern)].flatMap((match) => {
    const value = match.groups?.[group];
    return value === undefined ? [] : [value];
  });

const Entry = Schema.Struct({
  slug: Schema.optional(Schema.NullOr(Schema.String)),
});
const Seed = Schema.Struct({
  content: Schema.Struct({
    pages: Schema.Array(Entry),
    questions: Schema.Array(Entry),
    services: Schema.Array(Entry),
  }),
  menus: Schema.Array(
    Schema.Struct({
      items: Schema.Array(Schema.Struct({ url: Schema.String })),
    })
  ),
  redirects: Schema.Array(
    Schema.Struct({ destination: Schema.String, source: Schema.String })
  ),
});
const seed = Schema.decodeUnknownSync(Schema.fromJsonString(Seed))(seedText);

/** Every path the seeded site serves: dedicated routes plus each routable entry. */
const routes = new Set([
  "/",
  ...seed.content.pages.map((page) => `/${page.slug ?? ""}`),
  ...seed.content.services.map((service) => `/services/${service.slug ?? ""}`),
  ...seed.content.questions.map(
    (question) => `/ask-ani/${question.slug ?? ""}`
  ),
]);

describe("seed/seed.json", () => {
  it("ships every image it references", () => {
    const files = captures(MEDIA_URL, "file");
    expect(files.length).toBeGreaterThan(0);
    const missing = files.filter(
      (file) => !existsSync(path.join(SEED_DIR, "media", file))
    );
    expect(missing).toStrictEqual([]);
  });

  it("only references entries that exist", () => {
    const ids = new Set(captures(ENTRY_ID, "id"));
    const references = captures(REF, "id");
    expect(references).toContain("product-genesis-anti-hair-fall-serum");
    expect(references.filter((id) => !ids.has(id))).toStrictEqual([]);
  });

  it("links menus to routes the site serves", () => {
    const urls = seed.menus.flatMap((menu) =>
      menu.items.map((item) => item.url)
    );
    expect(urls).toContain("/book");
    expect(urls.filter((url) => !routes.has(url))).toStrictEqual([]);
  });

  it("sends the old aniwenger.com pages somewhere real", () => {
    const destinations = new Map(
      seed.redirects.map((redirect) => [redirect.source, redirect.destination])
    );
    expect(destinations.get("/brazilian-blowout")).toBe(
      "/services/brazilian-blowout"
    );
    expect(
      [...destinations.values()].filter((url) => !routes.has(url))
    ).toStrictEqual([]);
  });
});

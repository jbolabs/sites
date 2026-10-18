/**
 * The seed is what a fresh stage (and every preview) starts from, so it must
 * be internally consistent: every image it references ships in `seed/media`,
 * every menu link resolves to a route, every English entry has its Romanian
 * translation, and every old agapeoc.com address (`src/lib/legacy.ts`)
 * redirects to a page the seed creates.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { LEGACY_REDIRECTS } from "../src/lib/legacy.ts";

const SEED_DIR = import.meta.dirname;
const seedText = readFileSync(path.join(SEED_DIR, "seed.json"), "utf-8");

const MEDIA_URL = /"url":\s*"\/_seed\/media\/(?<file>[^"]+)"/gu;
const MENU_URL =
  /"type":\s*"custom",\s*"label":\s*"[^"]*",\s*"url":\s*"(?<url>[^"]+)"/gu;
const TRANSLATION_OF = /"translationOf":\s*"(?<id>[a-z0-9-]+)"/gu;
const SLUG = /"slug":\s*"(?<slug>[a-z0-9-]+)"/gu;
const LOCALE_PREFIX = /^\/(?:ro(?:\/|$))?/u;

const captures = (pattern: RegExp, group: string): string[] =>
  [...seedText.matchAll(pattern)].flatMap((match) => {
    const value = match.groups?.[group];
    return value === undefined ? [] : [value];
  });

const slugs = new Set(captures(SLUG, "slug"));
/** A site path the seed can serve: home, a page, or a ministry, in either language. */
const resolves = (url: string): boolean => {
  const rest = url.replace(LOCALE_PREFIX, "");
  if (rest === "") {
    return true;
  }
  const ministry = /^ministries\/(?<slug>[a-z0-9-]+)$/u.exec(rest)?.groups
    ?.slug;
  return slugs.has(ministry ?? rest);
};

describe("seed/seed.json", () => {
  it("ships every image it references", () => {
    const files = captures(MEDIA_URL, "file");
    expect(files).toContain("easter-worship.jpg");
    const missing = files.filter(
      (file) => !existsSync(path.join(SEED_DIR, "media", file))
    );
    expect(missing).toStrictEqual([]);
  });

  it("links menus to routes the site serves", () => {
    const urls = captures(MENU_URL, "url");
    expect(urls).toContain("/ro/lucrari");
    expect(urls.filter((url) => !resolves(url))).toStrictEqual([]);
  });

  it("translates every page and ministry into Romanian", () => {
    const translated = captures(TRANSLATION_OF, "id");
    expect(translated).toContain("page-give");
    expect(translated).toContain("ministry-awana");
    expect(translated).toContain("site-text");
    expect(translated.filter((id) => id.startsWith("ministry-"))).toHaveLength(
      15
    );
  });

  it("has a live route for every old agapeoc.com address", () => {
    const destinations = [...LEGACY_REDIRECTS.values()];
    expect(destinations).toContain("/ministries/youth");
    expect(
      destinations.filter((destination) => !resolves(destination))
    ).toStrictEqual([]);
  });
});

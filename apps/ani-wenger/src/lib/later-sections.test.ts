import { readFileSync } from "node:fs";
import path from "node:path";

import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  ensureLaterSections,
  LATER_SECTIONS,
  VIDEOS_SECTION,
} from "./later-sections.ts";
import type { SectionRegistries } from "./later-sections.ts";

const LAUNCH_SECTIONS = ["hero", "story", "transformations", "cta_band"];

const LAUNCH_SITE = { home: LAUNCH_SECTIONS, pages: LAUNCH_SECTIONS };

/** Block types and Sections fields in memory, recording every write. */
const fakeSite = (collections: Readonly<Record<string, readonly string[]>>) => {
  const types = new Set<string>(LAUNCH_SECTIONS);
  const allowed = new Map(
    Object.entries(collections).map(([slug, list]) => [slug, [...list]])
  );
  const writes: string[] = [];
  const registries: SectionRegistries = {
    applySeedBlockType: async (input, onConflict) => {
      await Promise.resolve();
      expect(onConflict).toBe("skip");
      if (!types.has(input.slug)) {
        types.add(input.slug);
        writes.push(`type ${input.slug}`);
      }
      return { slug: input.slug };
    },
    getCollectionWithFields: async (slug) => {
      await Promise.resolve();
      const list = allowed.get(slug);
      return list === undefined
        ? null
        : {
            fields: [
              { slug: "title" },
              {
                slug: "content",
                validation: { allowedTypes: list, maxItems: 20 },
              },
            ],
          };
    },
    updateField: async (collection, field, input) => {
      await Promise.resolve();
      expect(field).toBe("content");
      expect(input.validation.maxItems).toBe(20);
      allowed.set(collection, [...(input.validation.allowedTypes ?? [])]);
      writes.push(`allow ${collection}`);
    },
  };
  return { allowed, registries, types, writes };
};

describe(ensureLaterSections, () => {
  it("adds Videos to a site that launched without it, after the sections it had", async () => {
    const site = fakeSite(LAUNCH_SITE);
    const result = await ensureLaterSections(site.registries);
    expect(site.writes).toStrictEqual([
      "type videos",
      "allow home",
      "allow pages",
    ]);
    expect(result.allowed).toStrictEqual(["home", "pages"]);
    expect(site.allowed.get("home")).toStrictEqual([
      "hero",
      "story",
      "transformations",
      "cta_band",
      "videos",
    ]);
  });

  it("changes nothing the second time", async () => {
    const site = fakeSite(LAUNCH_SITE);
    await ensureLaterSections(site.registries);
    const again = await ensureLaterSections(site.registries);
    expect(again.allowed).toStrictEqual([]);
    expect(site.writes).toHaveLength(3);
    expect(site.types.has("videos")).toBeTruthy();
  });

  it("only allows it where it is missing", async () => {
    const site = fakeSite({
      home: [...LAUNCH_SECTIONS, "videos"],
      pages: LAUNCH_SECTIONS,
    });
    const result = await ensureLaterSections(site.registries);
    expect(result.allowed).toStrictEqual(["pages"]);
    expect(site.allowed.get("home")).toStrictEqual([
      ...LAUNCH_SECTIONS,
      "videos",
    ]);
  });

  it("leaves a site with no pages yet to its seed", async () => {
    const site = fakeSite({});
    const result = await ensureLaterSections(site.registries);
    expect(result.allowed).toStrictEqual([]);
    expect(site.writes).toStrictEqual(["type videos"]);
  });

  it("passes on a failure", async () => {
    const site = fakeSite(LAUNCH_SITE);
    const broken: SectionRegistries = {
      ...site.registries,
      updateField: async () => {
        await Promise.resolve();
        throw new Error("D1 is down");
      },
    };
    await expect(ensureLaterSections(broken)).rejects.toThrow("D1 is down");
  });
});

const Seed = Schema.Struct({
  blockTypes: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
  collections: Schema.Array(
    Schema.Struct({
      fields: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
      slug: Schema.String,
    })
  ),
});

describe("seed.json", () => {
  const seed = Schema.decodeUnknownSync(Seed)(
    JSON.parse(
      readFileSync(
        path.join(import.meta.dirname, "../../seed/seed.json"),
        "utf-8"
      )
    )
  );

  it.each(LATER_SECTIONS)(
    "defines $slug the way live sites get it",
    (section) => {
      expect(
        seed.blockTypes.find((seeded) => seeded.slug === section.slug)
      ).toStrictEqual(section);
    }
  );

  it.each(["home", "pages"])("lets %s use Videos", (collection) => {
    const content = seed.collections
      .find((entry) => entry.slug === collection)
      ?.fields.find((field) => field.slug === "content");
    const { allowedTypes } = Schema.decodeUnknownSync(
      Schema.Struct({ allowedTypes: Schema.Array(Schema.String) })
    )(content?.validation);
    expect(
      allowedTypes.filter((slug) => slug === VIDEOS_SECTION.slug)
    ).toStrictEqual(["videos"]);
  });
});

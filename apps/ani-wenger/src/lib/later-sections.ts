/**
 * Section types the site gained after launch. EmDash's seed only runs on a
 * fresh site, so a live site (prod, staging) would never offer them in the
 * page editor; this registers each missing one, the way the seed would, and
 * lets the Home and Pages "Sections" fields use it. Pages and their saved
 * sections are never touched. It runs on the worker's minute tick until it
 * succeeds once per isolate, and is safe to repeat: anything already there is
 * left alone.
 */
import { invalidateCollectionCache, invalidateSchemaObjectCache } from "emdash";
import type { ApplySeedBlockTypeInput, FieldValidation } from "emdash";

/** Instagram reels or posts; matches `videos` in seed.json. */
export const VIDEOS_SECTION: ApplySeedBlockTypeInput = {
  category: "Sections",
  currentVersion: 1,
  description:
    "Instagram reels or posts. Paste the link from Instagram's Share button.",
  label: "Videos",
  slug: "videos",
  versions: [
    {
      fields: [
        { label: "Headline", required: true, slug: "headline", type: "string" },
        {
          label: "Videos",
          required: true,
          slug: "items",
          type: "repeater",
          validation: {
            maxItems: 6,
            minItems: 1,
            subFields: [
              {
                label: "Instagram link",
                required: true,
                slug: "url",
                type: "url",
              },
            ],
          },
        },
      ],
      version: 1,
    },
  ],
};

/** Every section type added after launch, in the order they came. */
export const LATER_SECTIONS: readonly ApplySeedBlockTypeInput[] = [
  VIDEOS_SECTION,
];

/** The collections whose `content` field lists the sections an editor can add. */
export const SECTION_COLLECTIONS = ["home", "pages"] as const;
const SECTIONS_FIELD = "content";

/** The parts of EmDash's `BlockTypeRegistry` and `SchemaRegistry` this needs (fakes in tests). */
export interface SectionRegistries {
  readonly applySeedBlockType: (
    input: ApplySeedBlockTypeInput,
    onConflict: "skip"
  ) => Promise<{ readonly slug: string }>;
  readonly getCollectionWithFields: (slug: string) => Promise<{
    readonly fields: readonly {
      readonly slug: string;
      readonly validation?: FieldValidation | undefined;
    }[];
  } | null>;
  readonly updateField: (
    collectionSlug: string,
    fieldSlug: string,
    input: { readonly validation: FieldValidation }
  ) => Promise<void>;
}

/**
 * Lets one collection's Sections field use the given types, keeping the ones
 * it has first so the editor's list keeps its order. Answers whether it
 * changed anything; a collection with no Sections field yet is left to its seed.
 */
const allowOn = async (
  registries: SectionRegistries,
  collectionSlug: string,
  slugs: readonly string[]
): Promise<boolean> => {
  const collection = await registries.getCollectionWithFields(collectionSlug);
  const field = collection?.fields.find(
    (entry) => entry.slug === SECTIONS_FIELD
  );
  const current = field?.validation?.allowedTypes ?? [];
  const have = new Set(current);
  const missing = slugs.filter((slug) => !have.has(slug));
  if (field === undefined || missing.length === 0) {
    return false;
  }
  await registries.updateField(collectionSlug, SECTIONS_FIELD, {
    validation: { ...field.validation, allowedTypes: [...current, ...missing] },
  });
  invalidateCollectionCache(collectionSlug);
  return true;
};

/**
 * Registers the later section types and allows them on Home and Pages,
 * answering which collections it changed. Each type is registered before any
 * field names it, because EmDash refuses a Sections field that lists an
 * unknown type.
 */
export const ensureLaterSections = async (
  registries: SectionRegistries,
  sections: readonly ApplySeedBlockTypeInput[] = LATER_SECTIONS
): Promise<{ readonly allowed: string[] }> => {
  await Promise.all(
    sections.map(
      async (section) => await registries.applySeedBlockType(section, "skip")
    )
  );
  const slugs = sections.map((section) => section.slug);
  const changed = await Promise.all(
    SECTION_COLLECTIONS.map(async (collectionSlug) =>
      (await allowOn(registries, collectionSlug, slugs)) ? [collectionSlug] : []
    )
  );
  const allowed = changed.flat();
  if (allowed.length > 0) {
    invalidateSchemaObjectCache();
  }
  return { allowed };
};

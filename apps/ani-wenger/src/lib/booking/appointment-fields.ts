/**
 * Fields the Appointments collection gained after launch. EmDash's seed only
 * runs on a fresh site, so a live site (prod, staging) would never get them;
 * this adds each one that is missing, the same way Content types in the admin
 * does (a new, empty column), and never touches the appointments already
 * saved. It runs on the worker's minute tick and before a booking is saved,
 * and is safe to repeat: a field that is already there is left alone.
 */
import { invalidateCollectionCache, invalidateSchemaObjectCache } from "emdash";
import type { CreateFieldInput } from "emdash";

import { CLIENT_FOR } from "../labels.ts";

export const APPOINTMENTS = "appointments";

/** "Who is the appointment for?" from the booking page; matches seed.json. */
export const CLIENT_FOR_FIELD: CreateFieldInput = {
  label: "Who it's for",
  slug: "client_for",
  type: "select",
  validation: { options: [...CLIENT_FOR] },
};

/** Every field added after launch, in the order they came. */
export const LATER_APPOINTMENT_FIELDS: readonly CreateFieldInput[] = [
  CLIENT_FOR_FIELD,
];

/** The part of EmDash's `SchemaRegistry` this needs (a fake in tests). */
export interface FieldRegistry {
  readonly getCollectionWithFields: (slug: string) => Promise<{
    readonly fields: readonly { readonly slug: string }[];
  } | null>;
  readonly createField: (
    collectionSlug: string,
    input: CreateFieldInput
  ) => Promise<{ readonly slug: string }>;
}

const hasSlug = async (
  registry: FieldRegistry,
  slug: string
): Promise<boolean> => {
  const collection = await registry.getCollectionWithFields(APPOINTMENTS);
  return collection?.fields.some((field) => field.slug === slug) ?? false;
};

/**
 * Adds the later fields a site lacks and answers which fields the collection
 * now has. A site with no Appointments collection yet is left to its seed.
 * Two isolates racing to add the same field is fine: the loser sees it exists.
 */
export const ensureAppointmentFields = async (
  registry: FieldRegistry,
  fields: readonly CreateFieldInput[] = LATER_APPOINTMENT_FIELDS
): Promise<{ readonly added: string[]; readonly present: Set<string> }> => {
  const collection = await registry.getCollectionWithFields(APPOINTMENTS);
  if (collection === null) {
    return { added: [], present: new Set() };
  }
  const present = new Set(collection.fields.map((field) => field.slug));
  const missing = fields.filter((field) => !present.has(field.slug));
  const results = await Promise.all(
    missing.map(async (field) => {
      try {
        await registry.createField(APPOINTMENTS, field);
        return [field.slug];
      } catch (error) {
        if (await hasSlug(registry, field.slug)) {
          return [];
        }
        throw error;
      }
    })
  );
  const added = results.flat();
  for (const field of missing) {
    present.add(field.slug);
  }
  if (added.length > 0) {
    invalidateCollectionCache(APPOINTMENTS);
    invalidateSchemaObjectCache();
  }
  return { added, present };
};

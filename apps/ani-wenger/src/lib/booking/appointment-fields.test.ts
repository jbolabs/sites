import { readFileSync } from "node:fs";
import path from "node:path";

import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  ensureAppointmentFields,
  LATER_APPOINTMENT_FIELDS,
} from "./appointment-fields.ts";
import type { FieldRegistry } from "./appointment-fields.ts";

/** A schema registry over an in-memory field list, counting what it adds. */
const fakeRegistry = (
  slugs: readonly string[] | null,
  options: { readonly raceOn?: string } = {}
) => {
  const fields = slugs === null ? null : [...slugs];
  const created: string[] = [];
  const registry: FieldRegistry = {
    createField: async (collection, input) => {
      await Promise.resolve();
      expect(collection).toBe("appointments");
      if (fields === null) {
        throw new Error("COLLECTION_NOT_FOUND");
      }
      if (fields.includes(input.slug) || input.slug === options.raceOn) {
        // Another isolate added it a moment ago.
        fields.push(input.slug);
        throw new Error("FIELD_EXISTS");
      }
      fields.push(input.slug);
      created.push(input.slug);
      return input;
    },
    getCollectionWithFields: async () => {
      await Promise.resolve();
      return fields === null
        ? null
        : { fields: fields.map((slug) => ({ slug })) };
    },
  };
  return { created, registry };
};

const LAUNCH_FIELDS = ["title", "service", "starts_at", "phone"];

describe(ensureAppointmentFields, () => {
  it("adds Who it's for to a site that launched without it", async () => {
    const { created, registry } = fakeRegistry(LAUNCH_FIELDS);
    const result = await ensureAppointmentFields(registry);
    expect(created).toStrictEqual(["client_for"]);
    expect(result.added).toStrictEqual(["client_for"]);
    expect(result.present.has("client_for")).toBeTruthy();
  });

  it("changes nothing the second time", async () => {
    const { created, registry } = fakeRegistry(LAUNCH_FIELDS);
    await ensureAppointmentFields(registry);
    const again = await ensureAppointmentFields(registry);
    expect(created).toStrictEqual(["client_for"]);
    expect(again.added).toStrictEqual([]);
  });

  it("leaves a site that already has the field alone", async () => {
    const { created, registry } = fakeRegistry([
      ...LAUNCH_FIELDS,
      "client_for",
    ]);
    const result = await ensureAppointmentFields(registry);
    expect(result.added).toStrictEqual([]);
    expect(created).toStrictEqual([]);
  });

  it("counts a field another isolate just added as there", async () => {
    const { created, registry } = fakeRegistry(LAUNCH_FIELDS, {
      raceOn: "client_for",
    });
    const result = await ensureAppointmentFields(registry);
    expect(created).toStrictEqual([]);
    expect(result.present.has("client_for")).toBeTruthy();
  });

  it("leaves a site with no Appointments yet to its seed", async () => {
    const { created, registry } = fakeRegistry(null);
    const result = await ensureAppointmentFields(registry);
    expect(created).toStrictEqual([]);
    expect(result.present.size).toBe(0);
  });

  it("passes on a failure that is not a race", async () => {
    const { registry } = fakeRegistry(LAUNCH_FIELDS);
    const broken: FieldRegistry = {
      ...registry,
      createField: async () => {
        await Promise.resolve();
        throw new Error("D1 is down");
      },
    };
    await expect(ensureAppointmentFields(broken)).rejects.toThrow("D1 is down");
  });
});

const SeedCollections = Schema.Struct({
  collections: Schema.Array(
    Schema.Struct({
      fields: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
      slug: Schema.String,
    })
  ),
});

describe("seed.json", () => {
  const seed = Schema.decodeUnknownSync(SeedCollections)(
    JSON.parse(
      readFileSync(
        path.join(import.meta.dirname, "../../../seed/seed.json"),
        "utf-8"
      )
    )
  );
  const appointments = seed.collections.find(
    (collection) => collection.slug === "appointments"
  );

  it.each(LATER_APPOINTMENT_FIELDS)(
    "defines $slug the way live sites get it",
    (field) => {
      expect(
        appointments?.fields.find((seeded) => seeded.slug === field.slug)
      ).toStrictEqual(field);
    }
  );
});

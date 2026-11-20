import { readFileSync } from "node:fs";
import path from "node:path";

import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { lighthouseConfig, SHARED_LIGHTHOUSE_CONFIG } from "./lighthouse.ts";

const root = path.resolve(import.meta.dirname, "../..");
const ANI = path.join(root, "apps/ani-wenger");
const HOME = "^https?://[^/]+/$";

const Assertions = Schema.Record(Schema.String, Schema.Unknown);
const Config = Schema.Struct({
  ci: Schema.Struct({
    assert: Schema.Struct({
      assertMatrix: Schema.optional(
        Schema.Array(
          Schema.Struct({
            assertions: Assertions,
            matchingUrlPattern: Schema.String,
          })
        )
      ),
      assertions: Schema.optional(Assertions),
    }),
    collect: Schema.Unknown,
    upload: Schema.Unknown,
  }),
});

const read = (file: string) =>
  Schema.decodeUnknownSync(Config)(JSON.parse(readFileSync(file, "utf-8")));

describe(lighthouseConfig, () => {
  it("uses the shared budgets for a site without its own", () => {
    expect(lighthouseConfig(path.join(root, "apps/ms-custom-homes"))).toBe(
      SHARED_LIGHTHOUSE_CONFIG
    );
  });

  it("uses a site's own config when it has one", () => {
    expect(lighthouseConfig(ANI)).toBe(path.join(ANI, "lighthouserc.json"));
  });

  it("holds Ani's site to the shared budgets except best practices on Home", () => {
    const shared = read(SHARED_LIGHTHOUSE_CONFIG);
    const ani = read(lighthouseConfig(ANI));
    expect(ani.ci.collect).toStrictEqual(shared.ci.collect);
    expect(ani.ci.upload).toStrictEqual(shared.ci.upload);
    // Instagram's embed (the Videos section) sets third-party cookies and logs
    // console errors; only Home's best-practices floor makes room for it.
    expect(ani.ci.assert.assertMatrix).toStrictEqual([
      {
        assertions: {
          ...shared.ci.assert.assertions,
          "categories:best-practices": ["error", { minScore: 0.75 }],
        },
        matchingUrlPattern: HOME,
      },
      {
        assertions: shared.ci.assert.assertions,
        matchingUrlPattern: "^https?://[^/]+/.+",
      },
    ]);
  });

  it("tells Home apart from every other page", () => {
    const home = new RegExp(HOME, "u");
    expect(home.test("http://localhost:34341/")).toBeTruthy();
    expect(home.test("http://localhost:34341/book")).toBeFalsy();
  });
});

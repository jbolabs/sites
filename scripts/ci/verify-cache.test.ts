import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { listSites } from "@jakebodea/control-app/site";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { VERIFY_TOOLING_PATHS, affectedSites } from "./affected.ts";
import { siteVerifyScript } from "./verify-script.ts";

const root = path.resolve(import.meta.dirname, "../..");

describe("per-site verification cache", () => {
  it("hashes every tracked verification tool and the site's content, then restores isolated reports", () => {
    const dry = Schema.decodeUnknownSync(
      Schema.fromJsonString(
        Schema.Struct({
          tasks: Schema.Array(
            Schema.Struct({
              dependencies: Schema.Array(Schema.String),
              hash: Schema.NullOr(Schema.String),
              hashReason: Schema.optionalKey(Schema.String),
              inputs: Schema.Record(Schema.String, Schema.String),
              resolvedTaskDefinition: Schema.Struct({
                env: Schema.Array(Schema.String),
                outputs: Schema.Array(Schema.String),
                passThroughEnv: Schema.NullOr(Schema.Array(Schema.String)),
              }),
              taskId: Schema.String,
            })
          ),
        })
      )
    )(
      execFileSync(
        "bunx",
        [
          "turbo",
          "run",
          "verify:ci",
          "--filter=@sites/ms-custom-homes",
          "--cache=local:rw",
          "--dry=json",
        ],
        { cwd: root, encoding: "utf-8" }
      )
    );
    const task = dry.tasks.find(
      ({ taskId }) => taskId === "@sites/ms-custom-homes#verify:ci"
    );
    expect(task).toMatchObject({
      dependencies: ["@sites/ms-custom-homes#build"],
      hash: null,
      hashReason: "Deferred because dependencyOutputs hashing mode was used.",
      resolvedTaskDefinition: {
        outputs: [".artifacts/ci/local-verification/**"],
        passThroughEnv: [],
      },
    });
    expect(task?.resolvedTaskDefinition.env).toContain("VERIFY_RUNTIME");
    expect(task?.resolvedTaskDefinition.env).toContain("CONTENT_MODE");
    const inputs = Object.keys(task?.inputs ?? {}).map((file) =>
      path.posix.normalize(`apps/ms-custom-homes/${file}`)
    );
    expect(inputs).toStrictEqual(
      expect.arrayContaining([
        "apps/ms-custom-homes/seed/seed.json",
        "apps/ms-custom-homes/site.config.ts",
        "scripts/ci/local-worker.ts",
        "scripts/ci/local-verify.ts",
        "scripts/ci/verify-ci.ts",
        "scripts/ci/lighthouse.ts",
        "scripts/ci/control-check.ts",
        "scripts/ci/command.ts",
        "packages/control-app/src/seo.ts",
        "lighthouserc.json",
      ])
    );
    const files = execFileSync("git", ["ls-files"], {
      cwd: root,
      encoding: "utf-8",
    })
      .trim()
      .split("\n")
      .filter(
        (file) =>
          !file.endsWith(".test.ts") &&
          !file.endsWith(".test.tsx") &&
          VERIFY_TOOLING_PATHS.some((pattern) => pattern.test(file))
      );
    for (const file of files) {
      expect(
        inputs,
        `${file} triggers verification and must invalidate it`
      ).toContain(file);
    }
    expect(
      affectedSites(
        ["scripts/ci/lighthouse.ts", "scripts/ci/command.ts"],
        ["ms-custom-homes", "equityfast"]
      )
    ).toStrictEqual({ deploy: [], verify: ["ms-custom-homes"] });
  });
});

describe(siteVerifyScript, () => {
  it("runs the cached local verification for exactly that site", () => {
    expect(siteVerifyScript("ani-wenger")).toBe(
      `node ../../scripts/ci/local-verify.ts --cached-task --sites '["ani-wenger"]'`
    );
  });

  // Turbo silently skips a package without the script, so a new site would
  // otherwise pass CI without being verified.
  it("is defined by every site package", () => {
    const scripts = listSites(root).map((site) => {
      const manifest = Schema.decodeUnknownSync(
        Schema.Struct({ scripts: Schema.Record(Schema.String, Schema.String) })
      )(
        JSON.parse(
          readFileSync(path.join(root, "apps", site, "package.json"), "utf-8")
        )
      );
      return [site, manifest.scripts["verify:ci"] === siteVerifyScript(site)];
    });
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.filter(([, ok]) => ok !== true)).toStrictEqual([]);
  });
});

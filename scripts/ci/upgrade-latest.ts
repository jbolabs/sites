/**
 * Points the workspace catalog at the newest Alchemy and EmDash releases (in
 * the CI checkout only) and reinstalls, for the weekly upgrade smoke test.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Schema } from "effect";

const TRACKED = [
  "alchemy",
  "@alchemy.run/frontend-frameworks",
  "@alchemy.run/cloudflare",
  "@alchemy.run/github",
  "@alchemy.run/infisical",
  "effect",
  "@effect/platform-bun",
  "@effect/platform-node",
  "@effect/platform-node-shared",
  "@effect/vitest",
  "emdash",
  "@emdash-cms/cloudflare",
] as const;

const Manifest = Schema.Struct({
  overrides: Schema.Record(Schema.String, Schema.String),
  workspaces: Schema.Struct({
    catalog: Schema.Record(Schema.String, Schema.String),
  }),
});

const root = path.resolve(import.meta.dirname, "../..");
const file = path.join(root, "package.json");
const text = readFileSync(file, "utf-8");
const manifest = Schema.decodeUnknownSync(Schema.fromJsonString(Manifest))(
  text
);
const { catalog } = manifest.workspaces;

let next = text;
for (const name of TRACKED) {
  const current = catalog[name] ?? manifest.overrides[name];
  const latest = execFileSync("npm", ["view", name, "version"], {
    encoding: "utf-8",
  }).trim();
  if (current !== undefined && current !== latest) {
    next = next.replaceAll(`"${name}": "${current}"`, `"${name}": "${latest}"`);
    process.stdout.write(`${name}: ${current} -> ${latest}\n`);
  }
}
writeFileSync(file, next);
execFileSync("bun", ["install"], { cwd: root, stdio: "inherit" });

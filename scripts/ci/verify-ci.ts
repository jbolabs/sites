import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { listSites } from "@jakebodea/control-app/site";
import { Predicate, Schema } from "effect";

import { command } from "./command.ts";

const root = path.resolve(import.meta.dirname, "../..");
const [site, ...turboFlags] = process.argv.slice(2);
if (site === undefined || !listSites(root).includes(site)) {
  throw new Error("Usage: bun run verify:ci <site> [turbo flags]");
}

// Use the pinned LHCI's own discovery so we fingerprint the browser it audits.
const require = createRequire(import.meta.url);
type ChromeDiscovery = (options: Record<string, never>) => string | undefined;
const lhci = Schema.decodeUnknownSync(
  Schema.Struct({
    determineChromePath: Schema.declare((value): value is ChromeDiscovery =>
      Predicate.isFunction(value)
    ),
  })
)(require("@lhci/cli/src/utils.js"));
const chrome = Schema.decodeUnknownSync(Schema.NonEmptyString)(
  lhci.determineChromePath({})
);
process.env.CHROME_PATH = chrome;
process.env.VERIFY_RUNTIME = JSON.stringify({
  arch: process.arch,
  bun: execFileSync("bun", ["--version"], { encoding: "utf-8" }).trim(),
  chrome: execFileSync(chrome, ["--version"], { encoding: "utf-8" }).trim(),
  node: process.versions.node,
  platform: process.platform,
});
// Only this allowlisted, public fingerprint is logged, never the process env.
process.stdout.write(`Verification runtime: ${process.env.VERIFY_RUNTIME}\n`);

// This cheap write must precede Turbo's build hash, including on clean CI runners.
await command(
  "bun",
  [
    "scripts/ci/local-verify.ts",
    "--prepare",
    "--sites",
    JSON.stringify([site]),
  ],
  root
);
// Turbo restores outputs over existing files. Remove obsolete chunks before
// hashing dist, and old reports before a failed attempt can upload stale proof.
for (const generated of [
  "dist",
  "public/_seed",
  ".artifacts/ci/local-verification",
]) {
  rmSync(path.join(root, "apps", site, generated), {
    force: true,
    recursive: true,
  });
}
await command(
  "bunx",
  ["turbo", "run", "verify:ci", `--filter=@sites/${site}`, ...turboFlags],
  root
);

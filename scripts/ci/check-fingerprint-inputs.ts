/** Run outside Turbo's result cache so a new authored escape cannot disable pruning silently. */
import path from "node:path";

import { listSites } from "@jakebodea/control-app/site";

import { authoredInputFiles, deployableFiles } from "./site-fingerprint.ts";

const root = path.resolve(import.meta.dirname, "../..");
for (const site of listSites(root)) {
  deployableFiles(["export {};"], [], authoredInputFiles(root, site));
  process.stdout.write(`${site}: authored inputs can be fingerprinted\n`);
}

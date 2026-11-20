import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import { command } from "./command.ts";

const root = path.resolve(import.meta.dirname, "../..");

/** The shared budgets every site is held to. */
export const SHARED_LIGHTHOUSE_CONFIG = path.join(root, "lighthouserc.json");

/**
 * The Lighthouse config for a site: its own `lighthouserc.json` when it has
 * one (an exception to the shared budgets, kept beside the site and tested
 * against them), otherwise the shared one.
 */
export const lighthouseConfig = (siteDirectory: string): string => {
  const own = path.join(siteDirectory, "lighthouserc.json");
  return existsSync(own) ? own : SHARED_LIGHTHOUSE_CONFIG;
};

/**
 * Audit the home page and the lead form's page. Keep each site's collection
 * state and failed-budget reports together.
 */
export const lighthouse = async (
  origin: string,
  formPage: string,
  directory: string,
  siteDirectory: string
) => {
  mkdirSync(directory, { recursive: true });
  await command(
    path.join(root, "node_modules/.bin/lhci"),
    [
      "autorun",
      `--config=${lighthouseConfig(siteDirectory)}`,
      `--upload.outputDir=${directory}`,
      ...["/", formPage].map((route) => `--collect.url=${origin}${route}`),
    ],
    directory
  );
};

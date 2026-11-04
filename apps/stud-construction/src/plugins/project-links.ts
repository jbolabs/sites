/**
 * The `project-links` EmDash plugin descriptor, for `emdash({ plugins })` in
 * astro.config. The plugin itself (bundled into the Worker) is
 * `project-links-plugin.ts`; this file stays free of Worker-only imports.
 */
import { fileURLToPath } from "node:url";

import type { PluginDescriptor } from "emdash";

export const PROJECT_LINKS_PLUGIN_ID = "project-links";
export const PROJECT_LINKS_VERSION = "1.0.0";

export const projectLinksPlugin = (): PluginDescriptor => ({
  entrypoint: fileURLToPath(
    new URL("project-links-plugin.ts", import.meta.url)
  ),
  format: "native",
  id: PROJECT_LINKS_PLUGIN_ID,
  options: {},
  version: PROJECT_LINKS_VERSION,
});

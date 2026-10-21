/**
 * The `schedule` EmDash plugin descriptor, for `emdash({ plugins })` in
 * astro.config. The plugin itself (bundled into the Worker) is
 * `schedule-plugin.ts`; this file stays free of Worker-only imports.
 */
import { fileURLToPath } from "node:url";

import type { PluginDescriptor } from "emdash";

export const SCHEDULE_PLUGIN_ID = "schedule";
const VERSION = "1.0.0";

export const schedulePlugin = (): PluginDescriptor => ({
  entrypoint: fileURLToPath(new URL("schedule-plugin.ts", import.meta.url)),
  format: "native",
  id: SCHEDULE_PLUGIN_ID,
  options: {},
  version: VERSION,
});

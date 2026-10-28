import { createRoot } from "react-dom/client";
import cmsAdmin from "virtual:cms-admin-config";

import { installAdminMarks } from "#assistant/admin-marks.ts";
import { Assistant } from "#assistant/assistant.tsx";
import { installMobileNavigation } from "#assistant/mobile-navigation.ts";

import { DEFAULT_PRESETS } from "../options.ts";

import assistantCss from "#assistant/assistant.css?inline";

/**
 * The site-admin plugin's admin bundle (`adminEntry`). EmDash bundles it into
 * the admin app, which renders client-side only; it mounts the Assistant in a
 * root of its own beside the admin, since the admin has no header slot.
 */
const ROOT_ID = "site-assistant";

if (typeof document !== "undefined") {
  installMobileNavigation();
  installAdminMarks();
}

if (typeof document !== "undefined" && cmsAdmin.assistant !== false) {
  const { assistant } = cmsAdmin;
  // Inlined, not imported for effect: Vite would emit it as a chunk the public
  // pages also link, and its :root token map turned their backgrounds see-through.
  // First in <head>: both builds share Tailwind's `utilities` layer, so a later
  // sheet's plain `.hidden` would beat the admin's own `sm:inline` and hide its
  // desktop labels. The admin's utilities come after and win shared class names.
  const style = document.createElement("style");
  style.textContent = assistantCss;
  document.head.prepend(style);
  const host = document.createElement("div");
  host.id = ROOT_ID;
  document.body.append(host);
  createRoot(host).render(
    <Assistant
      config={{
        collections: assistant.collections,
        presets: assistant.presets ?? DEFAULT_PRESETS,
        siteName: cmsAdmin.siteName,
      }}
      host={host}
    />
  );
}

/** EmDash reads plugin pages, widgets and fields from here; this plugin's are Block Kit. */
export const pages = {};

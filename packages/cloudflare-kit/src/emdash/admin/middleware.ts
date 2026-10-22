import { defineMiddleware } from "astro/middleware";
import config from "virtual:cms-admin-config";
import themeCss from "virtual:cms-admin-theme";

import { dropAdminDevStyles, dropSiteDevStyles } from "./dev-styles.ts";
import { brandAdminCopy, injectAdminTheme } from "./theme.ts";

const ADMIN_SHELL = "/_emdash/admin";

export const onRequest = defineMiddleware(async (context, render) => {
  const response = await render();
  const html = response.headers.get("content-type")?.includes("text/html");
  if (html !== true) {
    return response;
  }
  if (!context.url.pathname.startsWith(ADMIN_SHELL)) {
    if (!import.meta.env.DEV) {
      return response;
    }
    return new Response(dropAdminDevStyles(await response.text()), {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    });
  }
  // The admin shell is one small HTML document (a React SPA mounts into it).
  const source = await response.text();
  const branded = brandAdminCopy(
    import.meta.env.DEV ? dropSiteDevStyles(source) : source,
    config.siteName
  );
  return new Response(injectAdminTheme(branded, themeCss), {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
});

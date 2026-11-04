import { Option } from "effect";

import type { GoogleTagManagerEnv } from "./env.ts";

/** A Tag Manager web container ID, as Google issues it (`GTM-` and 6 to 9 characters). */
const CONTAINER_ID = /^GTM-[A-Z0-9]{6,9}$/u;

/** Throws on a malformed ID so a typo fails the deploy instead of shipping a dead tag. */
export const assertContainerId = (containerId: string): string => {
  if (!CONTAINER_ID.test(containerId)) {
    throw new Error(`Not a Google Tag Manager container ID: "${containerId}"`);
  }
  return containerId;
};

/** The container to load, or none: an empty binding (every stage but prod) means off. */
export const googleTagManagerFromEnv = (
  env: GoogleTagManagerEnv
): Option.Option<string> =>
  CONTAINER_ID.test(env.GTM_CONTAINER_ID)
    ? Option.some(env.GTM_CONTAINER_ID)
    : Option.none();

/** Google's standard container loader, with the ID embedded as a JSON string literal. */
export const containerScript = (containerId: string): string =>
  `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(containerId)});`;

/** The `<noscript>` fallback frame Google asks for right after `<body>` opens. */
export const noscriptFrameUrl = (containerId: string): string =>
  `https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(containerId)}`;

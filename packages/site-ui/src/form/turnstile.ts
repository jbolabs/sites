/** Loads Cloudflare Turnstile once, on demand, for every form on the page. */

export interface TurnstileOptions {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
  /**
   * `auto` swaps an expired token (they last 300 s) for a fresh one without
   * the visitor doing anything, so a widget solved early in a long form still
   * holds a valid token at submit.
   */
  "refresh-expired": "auto" | "manual" | "never";
  size: "flexible";
  theme: "light";
  /** Widget language, e.g. `es`; Turnstile otherwise follows the browser. */
  language?: string;
}

export interface TurnstileApi {
  readonly render: (element: HTMLElement, options: TurnstileOptions) => string;
  readonly remove: (widgetId: string) => void;
  /** Clears a solved widget so it issues a fresh token (tokens are single use). */
  readonly reset: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let loading: Promise<TurnstileApi> | null = null;

const injectScript = async (): Promise<TurnstileApi> => {
  const { promise, reject, resolve } = Promise.withResolvers<TurnstileApi>();
  const script = document.createElement("script");
  script.src = SCRIPT_URL;
  script.async = true;
  script.addEventListener("load", () => {
    if (window.turnstile === undefined) {
      reject(new Error("Turnstile did not initialize"));
    } else {
      resolve(window.turnstile);
    }
  });
  script.addEventListener("error", () => {
    // A blocked or failed load must not stick: the next form to mount tries again.
    loading = null;
    reject(new Error("Turnstile failed to load"));
  });
  document.head.append(script);
  return await promise;
};

export const loadTurnstile = async (): Promise<TurnstileApi> => {
  loading ??= injectScript();
  return await loading;
};

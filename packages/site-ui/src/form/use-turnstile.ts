import { useCallback, useEffect, useRef, useState } from "react";

import { loadTurnstile } from "./turnstile.ts";
import type { TurnstileOptions } from "./turnstile.ts";

export interface UseTurnstileOptions {
  readonly siteKey: string;
  /** Widget language, e.g. `es`. */
  readonly locale?: string | undefined;
  /** Render only while true (e.g. from the step that shows it on). Defaults to true. */
  readonly active?: boolean | undefined;
}

/**
 * Renders a Turnstile widget into the element passed to `mount` (a callback ref) and reports its
 * token ("" until solved, or while a fresh one is on its way) and whether the
 * script failed to load. The widget swaps expired tokens by itself, so keep
 * its element mounted (it may be visually hidden) until the form is sent.
 * Tokens are single use: call `reset` after a failed submission.
 */
export const useTurnstile = ({
  active = true,
  locale,
  siteKey,
}: UseTurnstileOptions) => {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [token, setToken] = useState("");
  const [failed, setFailed] = useState(false);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const clear = () => {
      setToken("");
    };
    const mount = async (target: HTMLDivElement) => {
      try {
        const turnstile = await loadTurnstile();
        if (!cancelled) {
          setFailed(false);
          const options: TurnstileOptions = {
            callback: setToken,
            "error-callback": clear,
            "expired-callback": clear,
            "refresh-expired": "auto",
            sitekey: siteKey,
            size: "flexible",
            theme: "light",
          };
          if (locale !== undefined) {
            options.language = locale;
          }
          widget.current = turnstile.render(target, options);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    };
    if (active && element !== null) {
      void mount(element);
    }
    return () => {
      cancelled = true;
      clear();
      if (widget.current !== null) {
        window.turnstile?.remove(widget.current);
        widget.current = null;
      }
    };
  }, [active, element, locale, siteKey]);

  const reset = useCallback(() => {
    setToken("");
    if (widget.current !== null) {
      window.turnstile?.reset(widget.current);
    }
  }, []);

  return { failed, mount: setElement, reset, token };
};

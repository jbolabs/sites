import { useCallback, useEffect, useRef, useState } from "react";

import { loadTurnstile } from "../turnstile";

/**
 * Renders a Turnstile widget into the element given to `ref` and reports its
 * token ("" until solved or after it expires). Tokens are single use, so
 * `reset` asks the widget for a fresh one after a failed submission.
 */
export const useTurnstile = (siteKey: string) => {
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
          widget.current = turnstile.render(target, {
            callback: setToken,
            "error-callback": clear,
            "expired-callback": clear,
            sitekey: siteKey,
            size: "flexible",
            theme: "light",
          });
        }
      } catch {
        setFailed(true);
      }
    };
    if (element !== null) {
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
  }, [element, siteKey]);

  const reset = useCallback(() => {
    setToken("");
    if (widget.current !== null) {
      window.turnstile?.reset(widget.current);
    }
  }, []);

  return { failed, ref: setElement, reset, token };
};

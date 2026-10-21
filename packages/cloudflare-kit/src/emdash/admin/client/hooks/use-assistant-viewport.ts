import { useEffect } from "react";

/** Safari's keyboard resizes the visual viewport, while a fixed 100dvh sheet keeps its layout height. */
export const useAssistantViewport = (
  host: HTMLElement,
  enabled: boolean
): void => {
  useEffect(() => {
    const viewport = globalThis.visualViewport;
    const update = () => {
      if (viewport !== null) {
        host.style.setProperty(
          "--site-assistant-height",
          `${viewport.height}px`
        );
        host.style.setProperty(
          "--site-assistant-top",
          `${viewport.offsetTop}px`
        );
      }
    };
    if (enabled) {
      update();
      viewport?.addEventListener("resize", update);
      viewport?.addEventListener("scroll", update);
    }
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      host.style.removeProperty("--site-assistant-height");
      host.style.removeProperty("--site-assistant-top");
    };
  }, [enabled, host]);
};

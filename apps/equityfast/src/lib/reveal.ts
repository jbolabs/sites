/**
 * Scroll reveals for `[data-reveal]` and `[data-reveal-group]` (styles in
 * global.css). Elements already on screen at load are left alone, so the
 * first view never flashes; the rest are hidden and rise once as they enter.
 * Reduced motion skips it all.
 */
type RevealKey = "reveal" | "revealGroup";

const ROOT_MARGIN = "0px 0px -8% 0px";

/** Hides one element until it scrolls into view, then lets it rise once. */
const revealOnEntry = (element: HTMLElement, key: RevealKey) => {
  element.dataset[key] = "hidden";
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        element.dataset[key] = "shown";
        observer.disconnect();
      }
    },
    { rootMargin: ROOT_MARGIN }
  );
  observer.observe(element);
};

/** Starts below the fold, so hiding it now cannot flash anything the visitor sees. */
const belowFold = (element: HTMLElement) =>
  element.getBoundingClientRect().top >= window.innerHeight;

export const mountReveal = (): void => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  for (const element of document.querySelectorAll<HTMLElement>(
    "[data-reveal]"
  )) {
    if (belowFold(element)) {
      revealOnEntry(element, "reveal");
    }
  }
  for (const element of document.querySelectorAll<HTMLElement>(
    "[data-reveal-group]"
  )) {
    if (belowFold(element)) {
      revealOnEntry(element, "revealGroup");
    }
  }
};

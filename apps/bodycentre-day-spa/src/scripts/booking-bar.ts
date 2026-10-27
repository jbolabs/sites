/**
 * Shows the phone booking bar while neither the hero nor the closing call to
 * action is on screen, so there is always exactly one way to book in view.
 */
const bar = document.querySelector<HTMLElement>("[data-booking-bar]");
const zones = document.querySelectorAll<HTMLElement>("[data-hero], [data-cta]");
if (bar !== null && zones.length > 0) {
  const visible = new Set<Element>();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        visible.add(entry.target);
      } else {
        visible.delete(entry.target);
      }
    }
    bar.toggleAttribute("data-show", visible.size === 0);
  });
  for (const zone of zones) {
    observer.observe(zone);
  }
}

/**
 * Marks `[data-reveal]` elements `.is-visible` the first time they near the
 * viewport, then stops watching them (global.css owns the transition). Reveals
 * run once: content that has been seen never animates again.
 */
const targets = document.querySelectorAll<HTMLElement>("[data-reveal]");
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }
  },
  { rootMargin: "0px 0px -8% 0px" }
);
for (const target of targets) {
  observer.observe(target);
}

/**
 * The phone's status bar and browser chrome take their color from `theme-color`.
 * EmDash sets none, so they stayed the browser's own white or gray above the
 * site's tinted top bar. This keeps one meta tag in step with the top bar,
 * through the admin's own light/dark switch (an attribute, not the OS setting)
 * and onto the sign-in screens, which have no top bar.
 */
const TRANSPARENT = "rgba(0, 0, 0, 0)";

/** Theme colors are oklch; the meta tag gets plain sRGB, which every browser reads. */
const toRgb = (() => {
  const context = document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true });
  return (color: string): string => {
    if (context === null) {
      return color;
    }
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const [red = 0, green = 0, blue = 0] = context.getImageData(
      0,
      0,
      1,
      1
    ).data;
    return `rgb(${red}, ${green}, ${blue})`;
  };
})();

const topColor = (): string => {
  for (const element of [
    document.querySelector("[data-admin-header]"),
    document.querySelector("#admin-root > astro-island > div"),
    document.body,
  ]) {
    const color =
      element === null
        ? TRANSPARENT
        : getComputedStyle(element).backgroundColor;
    if (color !== TRANSPARENT) {
      return color;
    }
  }
  return TRANSPARENT;
};

export const installThemeColor = (): void => {
  const existing = document.querySelector<HTMLMetaElement>(
    "meta[name=theme-color]"
  );
  const meta = existing ?? document.createElement("meta");
  if (existing === null) {
    meta.name = "theme-color";
    document.head.append(meta);
  }
  let queued = false;
  const sync = () => {
    queued = false;
    const color = topColor();
    const content = color === TRANSPARENT ? "" : toRgb(color);
    if (content !== "" && meta.content !== content) {
      meta.content = content;
    }
  };
  const schedule = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(sync);
    }
  };
  // The mode switch is an attribute on <html>; screens swap in and out under <body>.
  new MutationObserver(schedule).observe(document.documentElement, {
    attributeFilter: ["class", "data-mode", "data-theme"],
  });
  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true,
  });
  sync();
};
